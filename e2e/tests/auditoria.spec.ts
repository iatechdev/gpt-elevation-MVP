import { test, type Browser, type BrowserContext, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { credentialsFor, resolveBaseUrl } from '../lib/target'

// ES-148 · Auditoría de UX/UI: recorre CADA pantalla por perfil, en ES/EN y escritorio/móvil, y captura estados.
// Solo LECTURA: no envía mensajes a la IA, no crea ni borra datos. Un acceso por rol; la sesión se reutiliza (storageState en e2e/.auth, ignorado por Git).
// Los correos visibles se enmascaran antes de cada captura. Resultado automático: docs/ux/capturas/hallazgos-auto.json.
type Role = 'USER' | 'THERAPIST' | 'ADMIN' | 'SUPERADMIN'
const OUT = resolve(process.env.E2E_CAPTURE_DIR ?? join(__dirname, '..', '..', 'docs', 'ux', 'capturas'))
const AUTH = resolve(__dirname, '..', '.auth')
const LANGS = (process.env.E2E_LANGS ?? 'es,en').split(',') as ('es' | 'en')[]
const VIEWS = [
  { name: 'escritorio', viewport: { width: 1280, height: 800 }, mobile: false },
  { name: 'movil', viewport: { width: 393, height: 851 }, mobile: true },
]

const PUBLIC = ['/', '/login', '/forgot-password', '/reset-password', '/profesionales', '/pricing']
const ROUTES: Record<Role, string[]> = {
  USER: ['/app/dashboard', '/app/onboarding', '/app/checkin', '/app/chat', '/app/compass', '/app/exercises', '/app/diary', '/app/diary/new',
    '/app/space/tools', '/app/progress', '/app/skill-map', '/app/evidence', '/app/evidence/new', '/app/evidence/resume-skills',
    '/app/context/resumes', '/app/next-step', '/app/next-step/experiments', '/app/next-step/plan', '/app/route-catalog', '/app/bridge',
    '/app/my-therapist', '/app/feedback', '/app/data', '/facilitation', '/app/professional-reviews'],
  THERAPIST: ['/therapist/dashboard'],
  ADMIN: ['/admin/dashboard', '/admin/prompts', '/admin/content', '/admin/users', '/admin/metrics', '/admin/manifest', '/admin/pilot-metrics'],
  SUPERADMIN: ['/admin/dashboard', '/admin/prompts', '/admin/content', '/admin/users', '/admin/metrics', '/admin/manifest', '/admin/pilot-metrics', '/admin/skill-catalog', '/admin/route-catalog'],
}
// Estados forzados (simulados en el navegador; no tocan el servidor): error 500 de la API y carga lenta.
const STATE_ROUTES: Partial<Record<Role, string[]>> = {
  USER: ['/app/dashboard', '/app/skill-map', '/app/evidence', '/app/diary', '/app/next-step', '/app/compass'],
  THERAPIST: ['/therapist/dashboard'],
  ADMIN: ['/admin/users'],
}

interface Row { rol: string; ruta: string; idioma: string; vista: string; estado: string; captura: string; rutaFinal: string; http: number | null; h1: string; ms: number; desborde: number; consola: string[]; peticionesFallidas: string[]; axe: { id: string; impacto: string; nodos: number }[]; sinNombre: number }
const rows: Row[] = []
const slug = (p: string) => (p === '/' ? 'inicio' : p.replace(/^\//, '').replace(/[\/:]/g, '-'))

// Enmascara correos visibles (datos personales) en el DOM antes de capturar.
async function mask(page: Page) {
  await page.evaluate(() => {
    const re = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let n = w.nextNode(); n; n = w.nextNode()) if (/@/.test(n.nodeValue ?? '')) n.nodeValue = (n.nodeValue ?? '').replace(re, 'persona@ejemplo.test')
    document.querySelectorAll<HTMLInputElement>('input').forEach((i) => { if (/@/.test(i.value)) i.value = 'persona@ejemplo.test' })
  }).catch(() => {})
}

async function visit(ctx: BrowserContext, role: string, route: string, lang: string, view: string, estado: string, opts: { delay?: number; fail?: boolean; axe?: boolean } = {}) {
  const page = await ctx.newPage()
  const consola: string[] = []; const fallidas: string[] = []
  page.on('console', (m) => { if (m.type() === 'error') consola.push(m.text().slice(0, 160)) })
  page.on('pageerror', (e) => consola.push('pageerror: ' + e.message.slice(0, 160)))
  page.on('response', (r) => { if (r.status() >= 400 && r.url().includes('/api/') && !opts.fail) fallidas.push(`${r.request().method()} ${new URL(r.url()).pathname} → ${r.status()}`) })
  if (opts.fail) await page.route('**/api/**', (r) => r.request().method() === 'GET' ? r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"Error simulado"}' }) : r.continue())
  if (opts.delay) await page.route('**/api/**', async (r) => { await new Promise((ok) => setTimeout(ok, opts.delay)); await r.continue().catch(() => {}) })
  const t0 = Date.now()
  let http: number | null = null
  try {
    const resp = await page.goto(route, { waitUntil: opts.delay ? 'commit' : 'domcontentloaded', timeout: 30_000 })
    http = resp?.status() ?? null
    if (opts.delay) await page.waitForTimeout(900)
    else await page.waitForLoadState('networkidle', { timeout: 7_000 }).catch(() => {}) // algunas pantallas mantienen conexiones abiertas
  } catch { /* se registra igualmente */ }
  const ms = Date.now() - t0
  await page.waitForTimeout(400)
  await mask(page)
  const dir = join(OUT, role.toLowerCase(), `${lang}-${view}`); mkdirSync(dir, { recursive: true })
  const file = `${slug(route)}${estado === 'normal' ? '' : '__' + estado}.png`
  await page.screenshot({ path: join(dir, file), fullPage: !opts.delay }).catch(() => {})
  const info = await page.evaluate(() => ({
    h1: (document.querySelector('h1')?.textContent ?? '').trim().slice(0, 80),
    desborde: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    sinNombre: Array.from(document.querySelectorAll('button,a[href],input,select,textarea')).filter((e) => {
      const el = e as HTMLInputElement
      return !(el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.textContent?.trim() || el.placeholder || el.getAttribute('title') || el.labels?.length || el.querySelector('img[alt]'))
    }).length,
  })).catch(() => ({ h1: '', desborde: 0, sinNombre: 0 }))
  let axe: Row['axe'] = []
  if (opts.axe) {
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze().catch(() => null)
    axe = r ? r.violations.map((v) => ({ id: v.id, impacto: String(v.impact), nodos: v.nodes.length })) : []
  }
  rows.push({ rol: role, ruta: route, idioma: lang, vista: view, estado, captura: `${role.toLowerCase()}/${lang}-${view}/${file}`, rutaFinal: new URL(page.url()).pathname, http, h1: info.h1, ms, desborde: info.desborde, consola, peticionesFallidas: fallidas, axe, sinNombre: info.sinNombre })
  await page.close()
}

async function ctxFor(browser: Browser, lang: string, v: (typeof VIEWS)[number], state?: string) {
  const ctx = await browser.newContext({ baseURL: resolveBaseUrl(), viewport: v.viewport, isMobile: v.mobile, hasTouch: v.mobile, deviceScaleFactor: v.mobile ? 2 : 1, storageState: state })
  await ctx.addInitScript((l) => { try { localStorage.setItem('elv_lang', l) } catch { /* sin almacenamiento */ } }, lang)
  return ctx
}

test.describe.configure({ mode: 'serial' })
test.setTimeout(30 * 60_000)
test.afterAll(() => { mkdirSync(OUT, { recursive: true }); writeFileSync(join(OUT, `hallazgos-auto-${process.env.E2E_TAG ?? 'todo'}.json`), JSON.stringify(rows, null, 1)) })

test('Público: cada pantalla, ES/EN, escritorio/móvil, más estados de acceso', async ({ browser }) => {
  test.skip(process.env.E2E_ONLY !== undefined && process.env.E2E_ONLY !== 'PUBLICO')
  for (const lang of LANGS) for (const v of VIEWS) {
    const ctx = await ctxFor(browser, lang, v)
    for (const r of PUBLIC) await visit(ctx, 'publico', r, lang, v.name, 'normal', { axe: true })
    // Estados del acceso: formulario vacío enviado y credenciales inventadas (2 intentos por combinación, bajo el límite de 10/min).
    const page = await ctx.newPage()
    await page.goto('/login', { waitUntil: 'networkidle' })
    const dir = join(OUT, 'publico', `${lang}-${v.name}`); mkdirSync(dir, { recursive: true })
    await page.click('button[type="submit"]'); await page.waitForTimeout(600)
    await page.screenshot({ path: join(dir, 'login__vacio-enviado.png') })
    await page.fill('input[type="email"]', 'no-existe@ejemplo.test'); await page.fill('input[type="password"]', 'clave-incorrecta-123')
    await page.click('button[type="submit"]'); await page.waitForTimeout(2500)
    await page.screenshot({ path: join(dir, 'login__error-credenciales.png') })
    await page.close()
    await ctx.close()
  }
  const ctx = await ctxFor(await browser, 'es', VIEWS[0]); await visit(ctx, 'publico', '/ruta-que-no-existe', 'es', 'escritorio', 'normal'); await ctx.close()
})

for (const role of ['USER', 'THERAPIST', 'ADMIN', 'SUPERADMIN'] as Role[]) {
  test(`${role}: recorrido completo`, async ({ browser }) => {
    test.skip(process.env.E2E_ONLY !== undefined && process.env.E2E_ONLY !== role)
    const creds = credentialsFor(role)
    test.skip(!creds, `Faltan E2E_${role}_EMAIL / E2E_${role}_PASSWORD`)
    mkdirSync(AUTH, { recursive: true })
    const state = join(AUTH, `${role}.json`)
    if (!existsSync(state)) { // un solo acceso por rol
      const c = await ctxFor(browser, 'es', VIEWS[0]); const p = await c.newPage()
      await p.goto('/login', { waitUntil: 'networkidle' })
      await p.fill('input[type="email"]', creds!.email); await p.fill('input[type="password"]', creds!.password)
      await p.click('button[type="submit"]')
      await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20_000 })
      await p.waitForLoadState('networkidle')
      await c.storageState({ path: state }); await c.close()
    }
    for (const lang of LANGS) for (const v of VIEWS) {
      const ctx = await ctxFor(browser, lang, v, state)
      for (const r of ROUTES[role]) await visit(ctx, role, r, lang, v.name, 'normal', { axe: true })
      if (lang === 'es') for (const r of STATE_ROUTES[role] ?? []) {
        await visit(ctx, role, r, lang, v.name, 'error', { fail: true })
        await visit(ctx, role, r, lang, v.name, 'cargando', { delay: 4000 })
      }
      // Detalle de la persona asignada al terapeuta (primer enlace), si existe.
      if (role === 'THERAPIST') {
        const p = await ctx.newPage(); await p.goto('/therapist/dashboard', { waitUntil: 'networkidle' })
        const href = await p.evaluate(() => document.querySelector('a[href*="/therapist/patient/"]')?.getAttribute('href') ?? '')
        await p.close()
        if (href) await visit(ctx, role, href, lang, v.name, 'normal', { axe: true })
      }
      await ctx.close()
    }
  })
}
