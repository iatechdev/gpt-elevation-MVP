import { test } from '@playwright/test'
import { mkdirSync, existsSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { resolveBaseUrl } from '../lib/target'

// ES-148 · Registro y planes (solo lectura): formulario de registro (sin enviar), validación de clave y /pricing sin sesión y con sesión de persona.
// NO envía el registro ni solicita planes. Escribe docs/ux/capturas/registro-planes/.
const OUT = resolve(__dirname, '..', '..', 'docs', 'ux', 'capturas', 'registro-planes')
const STATE = resolve(__dirname, '..', '.auth', 'USER.json')
const VIEWS = [{ n: 'escritorio', v: { width: 1280, height: 800 }, m: false }, { n: 'movil', v: { width: 393, height: 851 }, m: true }]

test('Registro y planes: capturas y medidas', async ({ browser }) => {
  test.setTimeout(10 * 60_000)
  mkdirSync(OUT, { recursive: true })
  const notas: Record<string, unknown> = {}
  for (const lang of ['es', 'en'] as const) for (const v of VIEWS) {
    const shot = async (page: import('@playwright/test').Page, name: string, full = true) => page.screenshot({ path: join(OUT, `${name}-${lang}-${v.n}.jpg`), type: 'jpeg', quality: 78, fullPage: full })
    const mk = async (state?: string) => {
      const ctx = await browser.newContext({ baseURL: resolveBaseUrl(), viewport: v.v, isMobile: v.m, hasTouch: v.m, deviceScaleFactor: v.m ? 2 : 1, storageState: state })
      await ctx.addInitScript((l) => { try { localStorage.setItem('elv_lang', l) } catch { /* sin almacenamiento */ } }, lang)
      return ctx
    }
    // Registro
    let ctx = await mk(); let page = await ctx.newPage()
    await page.goto('/login?mode=register', { waitUntil: 'domcontentloaded' }); await page.waitForLoadState('networkidle', { timeout: 7000 }).catch(() => {})
    await shot(page, 'registro-vacio')
    const fields = await page.evaluate(() => Array.from(document.querySelectorAll('form input, form select, form textarea')).map((e) => ({ tipo: (e as HTMLInputElement).type, id: e.id, obligatorio: (e as HTMLInputElement).required })))
    const checks = await page.evaluate(() => document.querySelectorAll('form input[type=checkbox]').length)
    notas[`registro-${lang}-${v.n}`] = { campos: fields, casillas: checks, textoPolitica: /pol[ií]tica|privacy|t[eé]rminos|terms/i.test(document_text(await page.locator('form').innerText())) }
    await page.fill('input[type=password]', 'abc')
    await page.waitForTimeout(300)
    await shot(page, 'registro-clave-debil')
    await ctx.close()
    // Planes: sin sesión y con sesión (solo lectura)
    ctx = await mk(); page = await ctx.newPage()
    await page.goto('/pricing', { waitUntil: 'domcontentloaded' }); await page.waitForLoadState('networkidle', { timeout: 7000 }).catch(() => {})
    await shot(page, 'planes-sin-sesion')
    await ctx.close()
    if (existsSync(STATE)) {
      ctx = await mk(STATE); page = await ctx.newPage()
      await page.goto('/pricing', { waitUntil: 'domcontentloaded' }); await page.waitForLoadState('networkidle', { timeout: 7000 }).catch(() => {})
      await shot(page, 'planes-con-sesion')
      notas[`planes-${lang}-${v.n}`] = { botones: await page.getByRole('button').allInnerTexts(), enlaces: (await page.getByRole('link').allInnerTexts()).slice(0, 12) }
      await ctx.close()
    }
  }
  writeFileSync(join(OUT, 'medidas.json'), JSON.stringify(notas, null, 1))
})
const document_text = (s: string) => s
