// ES-169 (PR1): /app/my-therapist («Mi profesional») en navegador real (Chromium), API simulada, datos sintéticos.
// Mide: vocabulario «profesional» (sin «terapeuta»/«therapist» en la pantalla), sin emojis, ánimo en palabras, errores con «Reintentar» en la carga principal y en «Compartir»,
// y la accesibilidad (axe WCAG 2.x A/AA, un h1, sin desborde, objetivos >= 24 px) en ES/EN × 390/1360 × claro/oscuro del sistema (la pantalla es clara por diseño: se mide y se declara).
// No corre en CI; evidencia del PR. Uso: `npx vite build && npx vite preview --port 5299 --strictPort` y luego
//   PLAYWRIGHT_MODULE=<playwright> AXE_PATH=<axe.min.js> BASE=http://localhost:5299 node scripts/es169-check.cjs
const fs = require('fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8')
const BASE = process.env.BASE || 'http://localhost:5299'
let failures = 0
const report = (ok, label, extra = '') => { if (!ok) failures++; console.log((ok ? 'OK    ' : 'FALLA ') + label + (extra ? ' ' + extra : '')) }
const T = {
  es: { title: 'Mi profesional', none: 'Aún no tienes un profesional asignado', find: 'Buscar mi profesional', loadError: 'No pudimos cargar la información de tu profesional ni de tus sesiones.', retry: 'Reintentar',
    share: 'Compartir mis datos con mi profesional', shareError: 'No pudimos cargar tu permiso de compartir con tu profesional.', mood: 'Ánimo al terminar: Bien (4/5)', moodLow: 'Ánimo al terminar: Muy mal (1/5)', change: '¿Quieres cambiar de profesional?', old: /terapeut/i },
  en: { title: 'My professional', none: 'You don’t have a professional assigned yet', find: 'Find my professional', loadError: 'We could not load your professional’s information or your sessions.', retry: 'Try again',
    share: 'Share my data with my professional', shareError: 'We could not load your permission to share with your professional.', mood: 'Mood at the end: Good (4/5)', moodLow: 'Mood at the end: Very low (1/5)', change: 'Want to change professional?', old: /therapist/i },
}
const future = mins => new Date(Date.now() + mins * 60000).toISOString()
const withPro = () => ({
  therapist: { id: 9, name: 'Profesional Sintético', email: 'pro@example.test', profile: { specialties: 'Orientación en transiciones', approach: 'Reflexivo', languages: 'Español, inglés', bio: 'Acompaño pasos pequeños.' } },
  upcomingSessions: [{ id: 1, scheduledAt: future(600), duration: 50, meetingUrl: 'https://example.test/room', status: 'scheduled' }],
  pastSessions: [{ id: 5, scheduledAt: '2026-10-20T15:00:00.000Z', patientMoodAfter: 4, status: 'completed' }, { id: 6, scheduledAt: '2026-10-10T15:00:00.000Z', patientMoodAfter: 1, status: 'completed' }],
})

async function open(browser, { width, lang, scheme, data = withPro(), failMain = 0, failConsent = 0 }) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  const state = { mainCalls: 0, consentCalls: 0, pageErrors: [] }
  page.on('pageerror', e => state.pageErrors.push(e.message))
  await page.route('**/api/**', async route => {
    const req = route.request(); const p = new URL(req.url()).pathname
    if (p === '/api/session') return route.fulfill({ json: { role: 'user', onboardingCompleted: true } })
    if (p === '/api/sessions/user/my-therapist' && req.method() === 'GET') { state.mainCalls++; return state.mainCalls <= failMain ? route.fulfill({ status: 500, json: {} }) : route.fulfill({ json: data }) }
    if (p === '/api/consents') { state.consentCalls++; return state.consentCalls <= failConsent ? route.fulfill({ status: 500, json: {} }) : route.fulfill({ json: { consents: [{ purpose: 'necessary', status: 'granted' }, { purpose: 'therapist_sharing', status: 'granted', applicable: !!data.therapist }] } }) }
    return route.fulfill({ json: {} })
  })
  await page.addInitScript(l => { localStorage.setItem('elevation_token', 'synthetic-browser-token'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l) }, lang)
  await page.goto(BASE + '/app/my-therapist', { waitUntil: 'networkidle' })
  await page.locator('h1').first().waitFor()
  return { ctx, page, state }
}
async function axeAndLayout(page, label) {
  await page.addScriptTag({ content: axeSource })
  const axe = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }).then(r => r.violations.map(v => v.id + ':' + v.nodes.length)))
  const r = await page.evaluate(() => ({
    h1: document.querySelectorAll('h1').length, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    small: [...document.querySelectorAll('a[href], button, select, textarea, input')].filter(el => { const b = el.getBoundingClientRect(); const s = getComputedStyle(el); return b.width > 1 && b.height > 1 && s.visibility !== 'hidden' && (b.width < 24 || b.height < 24) }).map(el => el.tagName.toLowerCase() + ' «' + (el.getAttribute('aria-label') || el.innerText || '').trim().slice(0, 28) + '» ' + Math.round(el.getBoundingClientRect().width) + 'x' + Math.round(el.getBoundingClientRect().height)),
  }))
  report(r.h1 === 1 && r.overflow <= 0 && axe.length === 0, label, `h1=${r.h1} desborde=${r.overflow} axe=[${axe}]`)
  report(r.small.length === 0, `${label}: objetivos >= 24 px`, `pequeños=[${r.small}]`)
}
const bodyText = page => page.locator('body').innerText()
const EMOJI = /\p{Extended_Pictographic}/u

;(async () => {
  const browser = await chromium.launch()
  for (const lang of ['es', 'en']) for (const width of [390, 1360]) for (const scheme of ['light', 'dark']) {
    const t = T[lang]; const tag = `${lang} ${width}px ${scheme}`
    {
      const { ctx, page } = await open(browser, { width, lang, scheme })
      await page.getByText(t.share, { exact: true }).waitFor()
      const text = await bodyText(page)
      report(await page.locator('h1').innerText() === t.title, `título «${t.title}» ${tag}`)
      report(!t.old.test(text) && !EMOJI.test(text), `sin vocabulario anterior ni emojis en la pantalla ${tag}`, (text.match(t.old) || [])[0] || '')
      report(text.includes(t.mood) && text.includes(t.moodLow) && text.includes(t.change), `ánimo en palabras («${t.mood}») y «${t.change}» ${tag}`)
      await axeAndLayout(page, `Mi profesional (con profesional) ${tag}`)
      await ctx.close()
    }
    {
      const { ctx, page } = await open(browser, { width, lang, scheme, data: { therapist: null, upcomingSessions: [], pastSessions: [] } })
      await page.getByText(t.none, { exact: true }).waitFor()
      const text = await bodyText(page)
      report(!t.old.test(text) && !EMOJI.test(text) && text.includes(t.find), `sin profesional: «${t.none}» / «${t.find}», sin emojis ${tag}`)
      await axeAndLayout(page, `Mi profesional (sin profesional) ${tag}`)
      await ctx.close()
    }
  }
  for (const [lang, width, scheme] of [['es', 1360, 'light'], ['en', 390, 'dark']]) {
    const t = T[lang]; const tag = `${lang} ${width}px ${scheme}`
    {
      const { ctx, page, state } = await open(browser, { width, lang, scheme, failMain: 1 })
      await page.getByText(t.loadError, { exact: true }).waitFor()
      report(await page.getByRole('alert').filter({ hasText: t.loadError }).count() === 1 && await page.getByText(t.share, { exact: true }).count() === 0, `error de carga con alerta y sin contenido a medias ${tag}`)
      await axeAndLayout(page, `Mi profesional (error de carga) ${tag}`)
      await page.getByRole('button', { name: t.retry, exact: true }).click()
      await page.getByText('Profesional Sintético', { exact: true }).waitFor()
      report(state.mainCalls === 2 && await page.getByText(t.loadError).count() === 0, `«${t.retry}» vuelve a pedir los datos y muestra la pantalla ${tag}`)
      await ctx.close()
    }
    {
      const { ctx, page, state } = await open(browser, { width, lang, scheme, failConsent: 1 })
      await page.getByText(t.shareError, { exact: true }).waitFor()
      report(await page.getByText('Profesional Sintético', { exact: true }).isVisible(), `si falla «Compartir», el resto de la pantalla sigue y se dice el error ${tag}`)
      await axeAndLayout(page, `Mi profesional (error en Compartir) ${tag}`)
      await page.getByRole('button', { name: t.retry, exact: true }).click()
      await page.getByText(t.share, { exact: true }).waitFor()
      report(state.consentCalls === 2, `«${t.retry}» en «Compartir» relee el permiso ${tag}`)
      report(state.pageErrors.length === 0, `sin errores de página ${tag}`, state.pageErrors.join(' | '))
      await ctx.close()
    }
  }
  await browser.close()
  console.log(failures ? `\n${failures} FALLAS` : '\nTODO OK')
  process.exit(failures ? 1 : 0)
})().catch(e => { console.error(e); process.exit(2) })
