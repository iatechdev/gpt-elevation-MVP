import { test, type Page } from '@playwright/test'
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { resolveBaseUrl } from '../lib/target'

// ES-148 · Auditoría con ESCRITURA en staging (aprobada por Mauricio el 3-nov-2026): una evidencia sintética confirmada, un nivel registrado y retirado,
// y una solicitud de plan. Cuenta de persona SINTÉTICA, texto inocuo. Solo corre con E2E_ESCRITURA=1. No llama a la IA (no usa el análisis con IA).
const OUT = resolve(__dirname, '..', '..', 'docs', 'ux', 'capturas', 'escritura')
const STATE = resolve(__dirname, '..', '.auth', 'USER.json')
const obs: { paso: string; ok: boolean; ms: number; nota?: string }[] = []
const shot = async (p: Page, n: string) => {
  await p.evaluate(() => { const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); for (let x = w.nextNode(); x; x = w.nextNode()) if (/@/.test(x.nodeValue ?? '')) x.nodeValue = (x.nodeValue ?? '').replace(/[\w.+-]+@[\w.-]+\.\w+/g, 'persona@ejemplo.test') }).catch(() => {})
  await p.screenshot({ path: join(OUT, n + '.jpg'), type: 'jpeg', quality: 78, fullPage: true })
}
async function paso(p: Page, nombre: string, fn: () => Promise<void>, nota?: () => Promise<string>) {
  const t0 = Date.now()
  try { await fn(); obs.push({ paso: nombre, ok: true, ms: Date.now() - t0, nota: nota ? await nota() : undefined }) }
  catch (e) { obs.push({ paso: nombre, ok: false, ms: Date.now() - t0, nota: String((e as Error).message).split('\n')[0] }) }
}

test('Escritura en staging: evidencia, nivel y solicitud de plan', async ({ browser }) => {
  test.skip(process.env.E2E_ESCRITURA !== '1', 'Fase 1: requiere E2E_ESCRITURA=1 (aprobado por Mauricio).')
  test.skip(!existsSync(STATE), 'Falta la sesión de persona.')
  test.setTimeout(8 * 60_000)
  mkdirSync(OUT, { recursive: true })
  const ctx = await browser.newContext({ baseURL: resolveBaseUrl(), viewport: { width: 1280, height: 900 }, storageState: STATE })
  await ctx.addInitScript(() => localStorage.setItem('elv_lang', 'es'))
  const p = await ctx.newPage()
  p.setDefaultTimeout(8000)
  const apiLog: string[] = []
  p.on('response', (r) => { if (r.url().includes('/api/') && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(r.request().method())) apiLog.push(`${r.request().method()} ${new URL(r.url()).pathname} → ${r.status()}`) })

  // 1) Evidencia
  await paso(p, 'Abrir «Nueva evidencia»', async () => { await p.goto('/app/evidence/new', { waitUntil: 'domcontentloaded' }); await p.locator('#title').waitFor(); await shot(p, '01-evidencia-vacia') },
    async () => `campos visibles: ${await p.locator('form input, form textarea, form select').count()}`)
  await paso(p, 'Llenar los campos obligatorios', async () => {
    await p.fill('#title', 'Coordinación de turnos de logística (prueba)')
    await p.fill('#situation', 'Prueba de auditoría de diseño con datos ficticios: un equipo de logística necesitaba reorganizar sus turnos.')
    await p.fill('#responsibility', 'Yo propuse y coordiné el nuevo calendario de turnos (texto ficticio).')
    await p.fill('#actions-0', 'Reuní las restricciones del equipo y armé el calendario (texto ficticio).')
    await p.fill('#delivered', 'Un calendario de turnos aceptado por el equipo (texto ficticio).')
    await p.getByLabel('Lo conozco', { exact: true }).check()
    await p.fill('#effectText', 'El equipo usó el calendario durante el mes (texto ficticio).')
    await p.selectOption('#autonomy', 'autonomous')
    await shot(p, '02-evidencia-llena')
  })
  await paso(p, 'Guardar borrador', async () => { await p.getByRole('button', { name: 'Guardar borrador' }).click(); await p.waitForTimeout(1500); await shot(p, '03-borrador-guardado') }, async () => (await p.locator('[role=status],[role=alert]').allInnerTexts()).join(' | ').slice(0, 200))
  await paso(p, 'Revisar para confirmar', async () => { await p.getByRole('button', { name: 'Revisar para confirmar' }).click(); await p.waitForTimeout(600); await shot(p, '04-revisar') })
  await paso(p, 'Confirmar evidencia', async () => {
    await p.getByLabel('He revisado esta evidencia.').check()
    await p.getByRole('button', { name: 'Confirmar evidencia' }).click(); await p.waitForTimeout(1800); await shot(p, '05-evidencia-confirmada')
  }, async () => (await p.locator('[role=status],[role=alert]').allInnerTexts()).join(' | ').slice(0, 200))

  // 2) Nivel en el mapa
  await paso(p, 'Abrir el mapa y elegir una capacidad', async () => {
    await p.goto('/app/skill-map', { waitUntil: 'domcontentloaded' }); await p.waitForLoadState('networkidle', { timeout: 7000 }).catch(() => {})
    await shot(p, '06-mapa-con-evidencia')
    const cap = p.getByRole('button', { name: /^Comunicación/ }).first(); await cap.focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(500); await shot(p, '07-capacidad-elegida')
  })
  await paso(p, 'Registrar mi nivel (3 pasos)', async () => {
    await p.getByRole('button', { name: 'Registrar mi nivel' }).first().click(); await p.waitForTimeout(800); await shot(p, '08-registrar-nivel-formulario')
    await p.locator('input[type=checkbox]').first().check()
    await p.locator('input[name="skill-map-level"]').nth(1).check()
    await p.fill('#skill-map-note', 'Nota de prueba (ficticia).')
    await shot(p, '09-registrar-nivel-lleno')
    await p.getByRole('button', { name: 'Guardar mi nivel' }).click(); await p.waitForTimeout(2000); await shot(p, '10-nivel-guardado')
  }, async () => (await p.locator('[role=status],[role=alert]').allInnerTexts()).join(' | ').slice(0, 200))
  await paso(p, 'Retirar mi nivel', async () => {
    await p.getByRole('button', { name: 'Retirar mi nivel' }).first().click(); await p.waitForTimeout(500); await shot(p, '11-retirar-confirmacion')
    await p.getByRole('button', { name: 'Sí, retirar' }).click(); await p.waitForTimeout(1800); await shot(p, '12-nivel-retirado')
  })

  // 3) Solicitud de plan
  await paso(p, 'Ver planes con sesión', async () => { await p.goto('/pricing', { waitUntil: 'domcontentloaded' }); await p.waitForLoadState('networkidle', { timeout: 7000 }).catch(() => {}); await shot(p, '13-planes') })
  await paso(p, 'Solicitar un plan', async () => {
    await p.getByRole('button', { name: /Solicitar este plan/ }).first().click(); await p.waitForTimeout(400); await shot(p, '14-solicitar-paso-1')
    const confirm = p.getByRole('button', { name: /Enviar solicitud|Confirmar/ }); if (await confirm.count()) { await confirm.first().click() }
    await p.waitForTimeout(2000); await shot(p, '15-solicitud-resultado')
  }, async () => (await p.locator('[role=status],[role=alert]').allInnerTexts()).join(' | ').slice(0, 300))
  await paso(p, 'Plan en el panel tras la solicitud', async () => { await p.goto('/app/dashboard', { waitUntil: 'domcontentloaded' }); await p.waitForLoadState('networkidle', { timeout: 7000 }).catch(() => {}); await shot(p, '16-panel-despues') })

  writeFileSync(join(OUT, 'observaciones.json'), JSON.stringify({ pasos: obs, llamadasDeEscritura: apiLog }, null, 1))
  await ctx.close()
})

// Fase 2: completar el borrador existente (editar → revisar → confirmar) y registrar/retirar un nivel. No crea más evidencias ni solicitudes.
test('Escritura fase 2: completar el borrador, confirmarlo y registrar/retirar un nivel', async ({ browser }) => {
  const FASE = process.env.E2E_ESCRITURA
  test.skip(FASE !== '2' && FASE !== '3', 'Fase 2/3: requiere E2E_ESCRITURA=2 o 3.')
  test.skip(!existsSync(STATE), 'Falta la sesión de persona.')
  test.setTimeout(8 * 60_000)
  mkdirSync(OUT, { recursive: true })
  obs.length = 0
  const ctx = await browser.newContext({ baseURL: resolveBaseUrl(), viewport: { width: 1280, height: 900 }, storageState: STATE })
  await ctx.addInitScript(() => localStorage.setItem('elv_lang', 'es'))
  const p = await ctx.newPage(); p.setDefaultTimeout(8000)
  const apiLog: string[] = []
  p.on('response', (r) => { if (r.url().includes('/api/') && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(r.request().method())) apiLog.push(`${r.request().method()} ${new URL(r.url()).pathname} → ${r.status()}`) })
  const status = async () => (await p.locator('[role=status],[role=alert]').allInnerTexts()).join(' | ').slice(0, 250)
  await paso(p, 'Abrir el borrador para editarlo', async () => { await p.goto('/app/evidence', { waitUntil: 'domcontentloaded' }); await p.getByRole('link', { name: 'Editar' }).first().click(); await p.locator('#title').waitFor(); await shot(p, '20-editar-borrador') })
  if (FASE === '2') await paso(p, 'Completar efecto observado y autonomía', async () => {
    await p.getByLabel('Lo conozco', { exact: true }).check()
    await p.fill('#effectText', 'El equipo usó el calendario durante el mes (texto ficticio).')
    await p.selectOption('#autonomy', 'autonomous'); await shot(p, '21-borrador-completo')
  })
  if (FASE === '2') await paso(p, 'Guardar y revisar para confirmar', async () => {
    const save = p.getByRole('button', { name: /Guardar borrador|Guardar/ }); if (await save.count()) { await save.first().click(); await p.waitForTimeout(1500); await shot(p, '22-tras-guardar') }
  }, status)
  await paso(p, 'Confirmar evidencia', async () => {
    const rev = p.getByRole('button', { name: 'Revisar para confirmar' }); if (await rev.count()) { await rev.click(); await p.waitForTimeout(500); await shot(p, '23-revisar') }
    await p.getByLabel('He revisado esta evidencia.').check(); await p.getByRole('button', { name: 'Confirmar evidencia' }).click(); await p.waitForTimeout(1800); await shot(p, '24-confirmada')
  }, status)
  await paso(p, 'Mapa: capacidad y registrar nivel', async () => {
    await p.goto('/app/skill-map', { waitUntil: 'domcontentloaded' }); await p.waitForLoadState('networkidle', { timeout: 7000 }).catch(() => {}); await shot(p, '25-mapa-con-evidencia')
    const cap = p.getByRole('button', { name: /^Comunicación/ }).first(); await cap.focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(500); await shot(p, '26-capacidad-elegida')
    await p.getByRole('button', { name: 'Registrar mi nivel' }).first().click(); await p.waitForTimeout(900); await shot(p, '27-registrar-nivel')
    await p.locator('input[type=checkbox]').first().check(); await p.locator('input[name="skill-map-level"]').nth(1).check(); await p.fill('#skill-map-note', 'Nota de prueba (ficticia).'); await shot(p, '28-nivel-lleno')
    await p.getByRole('button', { name: 'Guardar mi nivel' }).click(); await p.waitForTimeout(2000); await shot(p, '29-nivel-guardado')
  }, status)
  await paso(p, 'Retirar mi nivel', async () => {
    await p.getByRole('button', { name: 'Retirar mi nivel' }).first().click(); await p.waitForTimeout(500); await shot(p, '30-retirar-confirmacion')
    await p.getByRole('button', { name: 'Sí, retirar' }).click(); await p.waitForTimeout(1800); await shot(p, '31-nivel-retirado')
  })
  writeFileSync(join(OUT, 'observaciones-fase' + FASE + '.json'), JSON.stringify({ pasos: obs, llamadasDeEscritura: apiLog }, null, 1))
  await ctx.close()
})
