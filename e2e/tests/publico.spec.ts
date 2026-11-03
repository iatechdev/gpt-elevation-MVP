import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { resolveBaseUrl } from '../lib/target'

// ES-147 · Pruebas base de UX/UI sobre las pantallas PÚBLICAS (sin iniciar sesión, sin escribir datos).
const LANGS = ['es', 'en'] as const
const PAGES = [
  { name: 'landing', path: '/' },
  { name: 'acceso', path: '/login' },
]

async function open(page: Page, path: string, lang: 'es' | 'en') {
  // Idioma como lo guarda la aplicación (LanguageProvider): elv_lang.
  await page.addInitScript((l) => { try { localStorage.setItem('elv_lang', l) } catch { /* sin almacenamiento */ } }, lang)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  const response = await page.goto(path, { waitUntil: 'networkidle' })
  expect(response?.status(), `HTTP de ${path}`).toBeLessThan(400)
  return errors
}

for (const lang of LANGS) {
  for (const { name, path } of PAGES) {
    test.describe(`${name} · ${lang} @${lang}`, () => {
      test('carga con contenido y sin errores de consola', async ({ page }) => {
        const errors = await open(page, path, lang)
        await expect(page.locator('h1, h2').first()).toBeVisible()
        await expect(page.locator('html')).toHaveAttribute('lang', lang)
        expect(errors, `errores de consola/página:\n${errors.join('\n')}`).toEqual([])
      })

      test('sin desborde horizontal', async ({ page }) => {
        await open(page, path, lang)
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
        expect(overflow, 'píxeles de desborde horizontal').toBeLessThanOrEqual(1)
      })

      test('el teclado llega a un control con foco visible', async ({ page }) => {
        await open(page, path, lang)
        await page.keyboard.press('Tab')
        const focused = page.locator(':focus')
        await expect(focused).toHaveCount(1)
        await expect(focused).toBeVisible()
        const outline = await focused.evaluate((el) => {
          const s = getComputedStyle(el)
          return { outlineStyle: s.outlineStyle, outlineWidth: parseFloat(s.outlineWidth), boxShadow: s.boxShadow }
        })
        const visible = (outline.outlineStyle !== 'none' && outline.outlineWidth > 0) || outline.boxShadow !== 'none'
        expect(visible, 'el control enfocado debe mostrar un indicador de foco').toBeTruthy()
      })

      test('accesibilidad automática (axe): sin violaciones graves ni críticas', async ({ page }, info) => {
        await open(page, path, lang)
        const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
        const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
        await info.attach('axe-violaciones', {
          body: JSON.stringify(results.violations.map((v) => ({ id: v.id, impact: v.impact, ayuda: v.help, nodos: v.nodes.length })), null, 2),
          contentType: 'application/json',
        })
        expect(serious.map((v) => `${v.id} (${v.impact}, ${v.nodes.length} nodos)`), 'violaciones graves/críticas').toEqual([])
      })
    })
  }
}

test('el destino de las pruebas está permitido (localhost o staging)', () => {
  expect(() => resolveBaseUrl()).not.toThrow()
})

test('la configuración se niega a apuntar a otro host', () => {
  expect(() => resolveBaseUrl('https://www.ejemplo.com')).toThrow(/no está permitido/)
  expect(() => resolveBaseUrl('http://backend-staging-x.up.railway.app')).toThrow(/no está permitido/)
  expect(() => resolveBaseUrl('http://localhost:5173')).not.toThrow()
})
