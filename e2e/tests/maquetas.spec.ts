import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { pathToFileURL } from 'node:url'
import { join, resolve } from 'node:path'
import { mkdirSync } from 'node:fs'

// ES-148 · Verifica las maquetas estáticas de docs/ux/maquetas (sin red): sin errores, sin axe grave, navegables con teclado, y genera las imágenes.
const DIR = resolve(__dirname, '..', '..', 'docs', 'ux', 'maquetas')
const URL_ = pathToFileURL(join(DIR, 'index.html')).href
const SCREENS = ['home', 'chat', 'map', 'evidence', 'states']

for (const lang of ['es', 'en'] as const) {
  for (const mobile of [false, true]) {
    test.setTimeout(150_000)
    test(`maqueta ${lang} ${mobile ? 'móvil' : 'escritorio'}: axe, teclado e imágenes`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: mobile ? { width: 393, height: 851 } : { width: 1280, height: 800 }, deviceScaleFactor: mobile ? 2 : 1 })
      const page = await ctx.newPage()
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      await page.goto(URL_)
      await page.addStyleTag({ content: '.deck{position:static!important}' })
      if (lang === 'en') await page.locator('#bLang').click()
      for (const theme of ['light', 'dark']) {
        if (theme === 'dark') await page.locator('#bTheme').click()
        for (const id of SCREENS) {
          await page.getByRole('tab').nth(SCREENS.indexOf(id)).click()
          const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
          const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
          expect(bad.map((v) => `${v.id}:${v.nodes.length}`), `axe ${id} ${theme}`).toEqual([])
          if (theme === 'light') {
            mkdirSync(join(DIR, 'img'), { recursive: true })
            await page.locator('#frame').screenshot({ path: join(DIR, 'img', `${id}-${lang}-${mobile ? 'movil' : 'escritorio'}.png`) })
          }
        }
      }
      await page.keyboard.press('Tab')
      await expect(page.locator(':focus')).toHaveCount(1)
      expect(errors).toEqual([])
      await ctx.close()
    })
  }
}
