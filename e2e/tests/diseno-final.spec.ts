import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { pathToFileURL } from 'node:url'
import { join, resolve } from 'node:path'
import { mkdirSync } from 'node:fs'

// ES-148 · Verifica el prototipo de diseño final (docs/ux/diseno-final): sin claves de texto faltantes, sin axe grave/crítico,
// sin desborde horizontal, ES/EN, escritorio/móvil, claro/oscuro; y genera las imágenes. No usa red.
const DIR = resolve(__dirname, '..', '..', 'docs', 'ux', 'diseno-final')
const URL_ = pathToFileURL(join(DIR, 'index.html')).href
const IDS = ['land', 'login', 'login-error', 'onboarding', 'home', 'chat', 'chat-pending', 'chat-limit', 'diary', 'diary-new', 'map', 'map-evidence',
  'evidence', 'evidence-new', 'next', 'bridge', 'pro', 'data', 'data-delete', 'therapist', 'admin', 'states']

test.setTimeout(15 * 60_000)
for (const lang of ['es', 'en'] as const) for (const mobile of [false, true]) {
  test(`diseño final ${lang} ${mobile ? 'móvil' : 'escritorio'}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: mobile ? { width: 393, height: 851 } : { width: 1280, height: 800 }, deviceScaleFactor: mobile ? 2 : 1 })
    await ctx.addInitScript((l) => localStorage.setItem('elv_proto_lang', l), lang)
    const page = await ctx.newPage()
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(URL_)
    await page.addStyleTag({ content: '.deck{position:static!important}' })
    if (mobile) await page.evaluate(() => document.getElementById('device')!.classList.add('m'))
    mkdirSync(join(DIR, 'img'), { recursive: true })
    for (const theme of ['light', 'dark']) {
      await page.evaluate((th) => { document.documentElement.dataset.theme = th }, theme)
      for (const id of IDS) {
        await page.evaluate((i) => { location.hash = i }, id)
        await page.waitForTimeout(80)
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
