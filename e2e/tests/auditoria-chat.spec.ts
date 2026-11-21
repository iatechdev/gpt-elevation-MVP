import { test, expect, type Page } from '@playwright/test'
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { credentialsFor, resolveBaseUrl } from '../lib/target'

// ES-148 · Auditoría del chat REAL (IA). Gasta presupuesto y escribe turnos en el historial de la persona sintética de staging.
// Solo corre si E2E_CHAT_MAX > 0 (aprobado por Mauricio el 3-nov-2026: hasta 4 mensajes). Mensajes inocuos, sin datos personales.
const MAX = Number(process.env.E2E_CHAT_MAX ?? 0)
const OUT = resolve(__dirname, '..', '..', 'docs', 'ux', 'capturas', 'chat-real')
const STATE = resolve(__dirname, '..', '.auth', 'USER.json')
const MESSAGES: { lang: 'es' | 'en'; text: string; intent: string }[] = [
  { lang: 'es', intent: 'Apertura típica de una persona en reconversión', text: 'Hola. Llevo unos meses pensando en cambiar de carrera, pero no sé por dónde empezar.' },
  { lang: 'es', intent: 'Aporta experiencia concreta (insumo para evidencia)', text: 'Coordiné equipos de logística durante varios años. Me gustaba organizar, pero me cansé de la presión.' },
  { lang: 'es', intent: 'Mensaje muy corto y ambiguo', text: 'No sé.' },
  { lang: 'en', intent: 'Cambio de idioma y pregunta por los límites del asistente', text: 'I am not sure this is for me. What can and can’t you help me with?' },
]

async function openChat(page: Page, lang: 'es' | 'en') {
  await page.addInitScript((l) => { try { localStorage.setItem('elv_lang', l) } catch { /* sin almacenamiento */ } }, lang)
  await page.goto('/app/chat', { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
  await page.locator('textarea').first().waitFor()
}
const maskEmails = (page: Page) => page.evaluate(() => {
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let n = w.nextNode(); n; n = w.nextNode()) if (/@/.test(n.nodeValue ?? '')) n.nodeValue = (n.nodeValue ?? '').replace(/[\w.+-]+@[\w.-]+\.\w+/g, 'persona@ejemplo.test')
})

test('Chat real: turnos de una persona y respuestas de la IA, con capturas', async ({ browser }) => {
  test.skip(MAX <= 0, 'Requiere E2E_CHAT_MAX > 0 (gasto de IA aprobado por Mauricio).')
  test.skip(!existsSync(STATE) || !credentialsFor('USER'), 'Falta la sesión de persona (corre primero auditoria.spec.ts).')
  test.setTimeout(10 * 60_000)
  mkdirSync(OUT, { recursive: true })
  const ctx = await browser.newContext({ baseURL: resolveBaseUrl(), viewport: { width: 1280, height: 900 }, storageState: STATE })
  const page = await ctx.newPage()
  const apiErrors: string[] = []
  page.on('response', (r) => { if (r.url().includes('/api/') && r.status() >= 400) apiErrors.push(`${r.request().method()} ${new URL(r.url()).pathname} → ${r.status()}`) })
  await openChat(page, 'es')
  await maskEmails(page)
  await page.screenshot({ path: join(OUT, '00-antes.jpg'), type: 'jpeg', quality: 78 })

  const log: object[] = []
  for (const [i, m] of MESSAGES.slice(0, MAX).entries()) {
    if (m.lang === 'en' && i > 0) { await page.evaluate(() => localStorage.setItem('elv_lang', 'en')); await page.reload({ waitUntil: 'domcontentloaded' }); await page.locator('textarea').first().waitFor() }
    const before = await page.locator('.chat-scroll > div > div').count()
    await page.locator('textarea').first().fill(m.text)
    await page.screenshot({ path: join(OUT, `${String(i + 1).padStart(2, '0')}a-escrito.jpg`), type: 'jpeg', quality: 78 })
    const t0 = Date.now()
    await page.getByRole('button', { name: /^(Enviar|Send)$/ }).click()
    await page.screenshot({ path: join(OUT, `${String(i + 1).padStart(2, '0')}b-enviando.jpg`), type: 'jpeg', quality: 78 })
    await page.waitForFunction((n) => document.querySelectorAll('.chat-scroll > div > div').length >= n + 2 && !document.querySelector('.chat-scroll [role="status"]'), before, { timeout: 120_000 }).catch(() => {})
    const ms = Date.now() - t0
    await page.waitForTimeout(600)
    const bubbles = await page.locator('.chat-scroll > div > div').allInnerTexts()
    const reply = (bubbles[bubbles.length - 1] ?? '').replace(/^✦\s*ELEVATION\s*/i, '').trim()
    await maskEmails(page)
    await page.screenshot({ path: join(OUT, `${String(i + 1).padStart(2, '0')}c-respuesta.jpg`), type: 'jpeg', quality: 78 })
    log.push({
      n: i + 1, idioma: m.lang, intencion: m.intent, mensaje: m.text, ms, caracteresRespuesta: reply.length,
      parrafos: reply.split(/\n{2,}/).length, preguntas: (reply.match(/\?/g) ?? []).length,
      markdownCrudo: /(\*\*|__|^#{1,3}\s|^\s*[-*]\s|^\s*\d+\.\s)/m.test(reply), respuesta: reply,
    })
  }
  await page.screenshot({ path: join(OUT, '99-final-escritorio.jpg'), type: 'jpeg', quality: 78 })
  writeFileSync(join(OUT, 'transcripcion.json'), JSON.stringify({ turnos: log, erroresApi: apiErrors }, null, 1))
  await ctx.close()

  // Móvil con el historial ya guardado (lectura).
  const mctx = await browser.newContext({ baseURL: resolveBaseUrl(), viewport: { width: 393, height: 851 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, storageState: STATE })
  const mp = await mctx.newPage()
  await openChat(mp, 'es')
  await mp.waitForTimeout(800)
  await maskEmails(mp)
  await mp.screenshot({ path: join(OUT, '99-final-movil.jpg'), type: 'jpeg', quality: 78 })
  await mctx.close()
  expect(log.length).toBeGreaterThan(0)
})
