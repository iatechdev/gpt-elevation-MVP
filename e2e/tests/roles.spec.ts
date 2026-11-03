import { test, expect, type Page } from '@playwright/test'
import { credentialsFor } from '../lib/target'

// ES-147 · Acceso por perfil (persona, terapeuta, administrador, superadministrador) con cuentas SINTÉTICAS de staging.
// Las credenciales llegan solo por variables de entorno (E2E_<ROL>_EMAIL / E2E_<ROL>_PASSWORD); nunca se imprimen.
// En serie y solo en escritorio: el acceso está limitado a 10 por minuto por dirección y el envío real al chat consume IA.
test.describe.configure({ mode: 'serial' })
test.beforeEach(({}, info) => { test.skip(info.project.name !== 'escritorio', 'Solo se ejecuta en escritorio (evita accesos repetidos y gasto de IA).') })

const MARKER = `[e2e-${Date.now()}]`
const MESSAGE = `Hola, ¿cómo estás? ${MARKER}`

async function login(page: Page, role: 'USER' | 'THERAPIST' | 'ADMIN' | 'SUPERADMIN') {
  const creds = credentialsFor(role)
  test.skip(!creds, `Faltan E2E_${role}_EMAIL / E2E_${role}_PASSWORD`)
  await page.addInitScript(() => { try { localStorage.setItem('elv_lang', 'es') } catch { /* sin almacenamiento */ } })
  await page.goto('/login', { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', creds!.email)
  await page.fill('input[type="password"]', creds!.password)
  await page.click('button[type="submit"]')
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20_000 })
  await page.waitForLoadState('networkidle')
}

const token = (page: Page) => page.evaluate(() => localStorage.getItem('elevation_token') ?? '')

test('Persona: acceso, y un envío sin confirmar (429) se conserva al recargar y se recupera sin perderse', async ({ page }) => {
  await login(page, 'USER')
  expect(new URL(page.url()).pathname).toMatch(/^\/app\//)

  // 1) Simula el fallo 429 del servidor SIN llegar a él (no gasta IA): el envío queda "sin confirmar".
  await page.route('**/api/chat', (route) => route.request().method() === 'POST'
    ? route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ error: 'Demasiadas solicitudes.' }) })
    : route.continue())
  await page.goto('/app/chat?mode=compass', { waitUntil: 'networkidle' })
  await page.fill('textarea', MESSAGE)
  await page.getByRole('button', { name: 'Enviar' }).click()
  await expect(page.locator('.space-pending')).toContainText(MESSAGE)

  // 2) Al recargar, el texto sigue ahí (no se pierde) y la pantalla avisa que lo recuperó.
  await page.reload({ waitUntil: 'networkidle' })
  await expect(page.locator('.space-pending')).toContainText(MESSAGE)
  await expect(page.getByText('Recuperamos tu mensaje sin confirmar.')).toBeVisible()

  // 3) Sin el 429: "Consultar estado" (el servidor nunca vio ese envío) permite reintentar el MISMO mensaje, que ahora sí llega (1 llamada real a IA).
  await page.unroute('**/api/chat')
  await page.getByRole('button', { name: 'Consultar estado' }).click()
  await page.getByRole('button', { name: 'Reintentar el mismo envío' }).click()
  await expect(page.locator('.space-pending')).toHaveCount(0, { timeout: 60_000 })
  await expect(page.getByText(MARKER).first()).toBeVisible()
})

test('Terapeuta: ve a su persona asignada y NO puede leer el chat de ella ni entrar a administración', async ({ page }) => {
  await login(page, 'THERAPIST')
  expect(new URL(page.url()).pathname).toBe('/therapist/dashboard')
  await expect(page.getByText('QA Persona').first()).toBeVisible()

  // Aislamiento verificado en el servidor (la ruta /app/chat es una pantalla; los datos son lo que importa).
  const auth = { Authorization: `Bearer ${await token(page)}` }
  const mine = await page.request.get('/api/messages', { headers: auth })
  expect(mine.status()).toBe(200)
  expect(await mine.text(), 'el terapeuta no debe recibir mensajes de la persona').not.toContain(MARKER)
  expect((await page.request.get('/api/admin/usuarios', { headers: auth })).status(), 'API de administración').toBeGreaterThanOrEqual(401)

  await page.goto('/admin/dashboard', { waitUntil: 'networkidle' })
  expect(new URL(page.url()).pathname, 'el terapeuta no debe quedarse en administración').not.toMatch(/^\/admin/)

  // Observación (no falla): la pantalla /app/chat sí abre para el terapeuta, con SU propio historial.
  test.info().annotations.push({ type: 'observación', description: 'El terapeuta puede abrir /app/chat (su chat propio); la separación de datos se verifica por API.' })
})

test('Administrador: no puede crear cuentas de superadministrador ni de junta', async ({ page }) => {
  await login(page, 'ADMIN')
  expect(new URL(page.url()).pathname).toBe('/admin/dashboard')
  await page.goto('/admin/users', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /Crear usuario/ }).click()
  const options = (await page.locator('select option').allTextContents()).map((t) => t.trim().toLowerCase())
  expect(options).toContain('therapist')
  expect(options, 'un administrador no debe poder crear superadmin').not.toContain('superadmin')
  expect(options, 'un administrador no debe poder crear junta').not.toContain('board')
})

test('Superadministrador: acceso global, catálogos y creación de cualquier rol', async ({ page }) => {
  await login(page, 'SUPERADMIN')
  expect(new URL(page.url()).pathname).toBe('/admin/dashboard')
  await page.goto('/admin/skill-catalog', { waitUntil: 'networkidle' })
  expect(new URL(page.url()).pathname).toBe('/admin/skill-catalog')
  await page.goto('/admin/route-catalog', { waitUntil: 'networkidle' })
  expect(new URL(page.url()).pathname).toBe('/admin/route-catalog')
  await page.goto('/admin/users', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /Crear usuario/ }).click()
  const options = (await page.locator('select option').allTextContents()).map((t) => t.trim().toLowerCase())
  expect(options).toEqual(expect.arrayContaining(['user', 'therapist', 'admin', 'superadmin', 'board']))
})
