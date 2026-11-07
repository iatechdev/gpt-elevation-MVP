// QA-Claude-2 — ES-30 (#90): «Siguiente paso» en el registro (/app/onboarding) con backend real. Requiere backend (:8090) y vite (:5173).
const { chromium } = require(process.env.PLAYWRIGHT_MODULE)
const path = require('path'), fs = require('fs'); const OUT = process.env.OUT; fs.mkdirSync(OUT, { recursive: true })
const API = 'http://localhost:8090', UI = 'http://localhost:5173', PASS = require('crypto').randomBytes(12).toString('hex') + 'Aa1!'
let fails = 0; const ck = (n, ok, x = '') => { if (!ok) fails++; console.log(`${ok ? 'OK   ' : 'FALLA'} ${n} ${x}`) }
const j = async (m, p, t, b) => { const r = await fetch(API + p, { method: m, headers: { 'content-type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: b ? JSON.stringify(b) : undefined }); return r.json().catch(() => null) }
;(async () => {
  const b = await chromium.launch()
  for (const [entry, label, expectNext] of [['Mi espacio', 'personal', false], ['Mi siguiente paso', 'profesional', true], ['Quiero avanzar pronto', 'pronto', true]]) {
    for (const [lang, w] of [['es', 375], ['en', 1280]]) {
      if (lang === 'en' && entry !== 'Mi siguiente paso') continue
      const e = `qa-ob-${Date.now()}${Math.floor(Math.random() * 1e4)}@example.test`; await j('POST', '/api/register', null, { name: 'ob', email: e, password: PASS }); const t = (await j('POST', '/api/login', null, { email: e, password: PASS })).token
      const c = await b.newContext({ viewport: { width: w, height: 900 } }); await c.addInitScript(([t, l]) => { localStorage.setItem('elevation_token', t); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l) }, [t, lang]); const p = await c.newPage(); p.errs = []; p.on('pageerror', x => p.errs.push(x.message.slice(0, 100)))
      await p.goto(UI + '/app/onboarding', { waitUntil: 'networkidle' }); await p.waitForTimeout(800)
      const radios = p.locator('input[name=entry]'); const idx = ['Mi espacio', 'Mi siguiente paso', 'Quiero avanzar pronto'].indexOf(entry); await radios.nth(idx).check()
      await p.locator('#preferredLanguage').selectOption(lang); await p.locator('button[type=submit]').click(); await p.waitForTimeout(1500)
      const body = await p.locator('body').innerText(); const next = p.locator('section.context-next')
      console.log(`   ${label}/${lang}/${w}px → ${p.url().replace(UI, '')} | «Siguiente paso» visible: ${await next.count() === 1}`)
      if (expectNext) {
        ck(`F90-2 ${label}/${lang}: recuadro «Siguiente paso» visible`, await next.count() === 1 && /Siguiente paso|Next step/.test(await next.innerText()))
        const btns = next.locator('button'); ck(`F90-2 ${label}/${lang}: 2 botones ≥44 px`, await btns.count() === 2 && (await btns.evaluateAll(els => els.every(e => e.getBoundingClientRect().height >= 44))))
        const m = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth })); ck(`F90-2 ${label}/${lang}: sin desborde`, m.sw <= m.iw, `${m.sw}/${m.iw}`)
        if (lang === 'en') ck('F90-4 EN: textos del recuadro', /Open my map|Back to dashboard/.test(await next.innerText()) && !/Abrir|Volver/.test(await next.innerText()))
        await p.screenshot({ path: path.join(OUT, `onboarding-next-${label}-${lang}-${w}.png`), fullPage: true })
        await btns.first().click(); await p.waitForTimeout(1000); ck(`F90-2 ${label}/${lang}: «Abrir mi mapa» navega a /app/skill-map`, p.url().endsWith('/app/skill-map'), p.url().replace(UI, ''))
      } else {
        ck(`F90-2 ${label}: sin recuadro (la entrada personal va directo al inicio)`, await next.count() === 0 && /dashboard|chat|space/.test(p.url()), p.url().replace(UI, ''))
      }
      ck(`sin errores de página ${label}/${lang}`, p.errs.length === 0, p.errs.join('|')); await c.close()
    }
  }
  await b.close(); console.log(fails ? `\nFALLAS: ${fails}` : '\nTODO OK'); process.exit(fails ? 1 : 0)
})().catch(e => { console.error('EXCEPCIÓN', e.message); process.exit(3) })
