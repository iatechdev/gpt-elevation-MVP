import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { pathToFileURL } from 'node:url'
import { join, resolve } from 'node:path'
import { mkdirSync } from 'node:fs'

// ES-148 · Verifica el prototipo de diseño final (docs/ux/diseno-final): sin claves de texto faltantes, sin axe grave/crítico,
// sin desborde horizontal, ES/EN, escritorio/móvil, claro/oscuro; flujos interactivos de punta a punta; y genera las imágenes. Sin red.
const DIR = resolve(__dirname, '..', '..', 'docs', 'ux', 'diseno-final')
const URL_ = pathToFileURL(join(DIR, 'index.html')).href
// [id de imagen, hash, escenario]
const SHOTS: [string, string, string][] = [
  ['land', 'land', 'new'], ['register', 'register', 'new'], ['register-plan', 'register/plan', 'new'], ['login', 'login', 'new'], ['login-error', 'login/error', 'new'], ['onboarding', 'onboarding', 'new'],
  ['home', 'home', 'new'], ['chat-vacio', 'chat', 'new'], ['chat', 'chat', 'active'], ['chat-evidencia', 'chat/evidence', 'active'], ['chat-error', 'chat/error', 'active'], ['chat-limite', 'chat/limit', 'active'],
  ['diary', 'diary', 'new'], ['diary-new', 'diary-new', 'new'],
  ['map', 'map', 'new'], ['map-nivel', 'map', 'leveled'], ['map-registrar', 'map/level', 'evidence'], ['map-ia', 'map/ai', 'evidence'],
  ['evidence', 'evidence', 'new'], ['evidence-lista', 'evidence', 'evidence'], ['evidence-new', 'evidence/new', 'new'],
  ['plans', 'plans', 'new'], ['plans-solicitar', 'plans/confirm-0', 'new'], ['plans-pendiente', 'plans', 'leveled'],
  ['next', 'next', 'new'], ['bridge', 'bridge', 'new'], ['pro', 'pro', 'new'], ['data', 'data', 'new'], ['data-eliminar', 'data/del', 'new'],
  ['therapist', 'therapist', 'new'], ['admin', 'admin', 'new'], ['states', 'states', 'new'],
]

async function show(page: Page, hash: string, scenario: string) {
  await page.evaluate(([h, s]) => { (window as any).PROTO.scenario(s); (window as any).PROTO.S.menu = false; location.hash = ''; (window as any).PROTO.go(h) }, [hash, scenario])
  await page.waitForTimeout(120)
}

test.setTimeout(20 * 60_000)
const benign = (s: string) => /ERR_FILE_NOT_FOUND|CORS policy|ERR_FAILED/.test(s) // favicon.ico y lectura de hojas de estilo de axe desde file://
for (const lang of ['es', 'en'] as const) for (const mobile of [false, true]) {
  test(`diseño final ${lang} ${mobile ? 'móvil' : 'escritorio'}: pantallas, axe, desborde, imágenes`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: mobile ? { width: 393, height: 851 } : { width: 1280, height: 800 }, deviceScaleFactor: mobile ? 2 : 1 })
    await ctx.addInitScript((l) => localStorage.setItem('elv_proto_lang', l), lang)
    const page = await ctx.newPage()
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    page.on('console', (m) => { if (m.type() === 'error' && !benign(m.text())) errors.push(m.text()) })
    await page.goto(URL_)
    await page.addStyleTag({ content: '.deck{position:static!important}' })
    mkdirSync(join(DIR, 'img'), { recursive: true })
    for (const theme of ['light', 'dark']) {
      await page.evaluate((th) => { document.documentElement.dataset.theme = th }, theme)
      for (const [id, hash, sc] of SHOTS) {
        await show(page, hash, sc)
        const body = await page.locator('#view').innerText()
        expect(body, `clave de texto faltante en ${id}`).not.toContain('⟦')
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
        expect(overflow, `desborde en ${id}`).toBeLessThanOrEqual(1)
        const r = await new AxeBuilder({ page }).include('#view').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
        const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
        expect(bad.map((v) => `${v.id}:${v.nodes.length}`), `axe ${id} ${theme}`).toEqual([])
        if (theme === 'light') await page.locator('#device').screenshot({ path: join(DIR, 'img', `${id}-${lang}-${mobile ? 'movil' : 'escritorio'}.jpg`), type: 'jpeg', quality: 80 })
      }
    }
    expect(errors).toEqual([])
    await ctx.close()
  })
}

test('flujos interactivos de punta a punta (ES, escritorio)', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  await ctx.addInitScript(() => localStorage.setItem('elv_proto_lang', 'es'))
  const page = await ctx.newPage()
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(URL_)

  // 1) Crear cuenta: valida las reglas y el consentimiento; con datos correctos llega a «Tu cuenta está lista».
  await show(page, 'register', 'new')
  await page.getByRole('button', { name: 'Crear cuenta' }).click()
  await expect(page.getByRole('alert')).toContainText('Revisa los datos')
  await page.fill('#rn', 'Persona de prueba'); await page.fill('#re', 'persona@ejemplo.test'); await page.fill('#rp', 'abc')
  await expect(page.locator('.checks li.ok')).toHaveCount(1) // solo «una minúscula» cumple
  await page.fill('#rp', 'Clave-Segura-2026')
  await expect(page.locator('.checks li.ok')).toHaveCount(5)
  await page.getByLabel(/Entiendo que Elevation/).check()
  await page.getByRole('button', { name: 'Crear cuenta' }).click()
  await expect(page.getByRole('heading', { name: 'Tu cuenta está lista' })).toBeVisible()

  // 2) Conversación: enviar un mensaje, ver «preparando respuesta» y la respuesta; guardar un mensaje como evidencia y confirmarla.
  await show(page, 'chat', 'new')
  await page.fill('#m', 'Coordiné equipos de logística durante varios años y me gustaba organizar.')
  await page.getByRole('button', { name: /^Enviar/ }).click()
  await expect(page.locator('.typing')).toBeVisible()
  await expect(page.locator('.turn.ai').first()).toBeVisible({ timeout: 5000 })
  await expect(page.locator('.turn.ai .ask').first()).toBeVisible() // la pregunta final se destaca
  await page.getByRole('button', { name: 'Guardar como evidencia' }).first().click()
  const drawer = page.getByRole('dialog')
  await expect(drawer.getByRole('heading', { name: 'Borrador de evidencia' })).toBeVisible()
  await expect(drawer.getByRole('button', { name: 'Continuar' })).toBeVisible()
  await drawer.getByRole('button', { name: 'Continuar' }).click()
  await drawer.getByLabel('Tu parte').fill('Asigné turnos y resolví cuellos de botella.')
  await drawer.getByLabel(/Qué hiciste, paso a paso/).fill('Planifiqué rutas')
  await drawer.getByRole('button', { name: 'Continuar' }).click()
  await drawer.getByLabel('Lo que entregaste').fill('Entregas a tiempo.')
  await drawer.getByLabel('Sí, y lo puedo describir').check()
  await drawer.getByRole('button', { name: 'Confirmar evidencia' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Evidencia guardada' })).toBeVisible()

  // 3) Mapa: registrar un nivel con esa evidencia y verlo en el radar y en la lista; luego retirarlo.
  await page.evaluate(() => { (window as any).PROTO.go('map') })
  const petal = page.getByRole('button', { name: /^Comunicación: Sin evaluar/ })
  await petal.focus(); await page.keyboard.press('Enter') // el radar se opera con teclado
  await page.getByRole('button', { name: 'Registrar mi nivel' }).click()
  await page.getByRole('dialog').getByRole('checkbox').first().check()
  await page.getByRole('dialog').getByRole('button', { name: 'Continuar' }).click()
  await page.getByRole('dialog').getByLabel(/Nivel 2/).check()
  await page.getByRole('dialog').getByRole('button', { name: 'Continuar' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Guardar mi nivel' }).click()
  await expect(page.getByRole('button', { name: /^Comunicación: Nivel 2/ })).toBeVisible()
  await page.getByRole('button', { name: 'Retirar mi nivel' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Sí, retirar' }).click()
  await expect(page.getByRole('button', { name: /^Comunicación: Sin evaluar/ })).toBeVisible()

  // 4) Planes: solicitar un plan, ver el estado «En revisión»; no hay campos de pago.
  await show(page, 'plans', 'new')
  await page.getByRole('button', { name: /Solicitar este plan/ }).first().click()
  await expect(page.getByRole('dialog').locator('input')).toHaveCount(0)
  await page.getByRole('button', { name: 'Enviar solicitud' }).click()
  await expect(page.getByText('El plan aún no está activado')).toBeVisible()
  expect(errors).toEqual([])
  await ctx.close()
})
