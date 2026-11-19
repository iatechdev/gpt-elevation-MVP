// QA-Claude-2 — PR #366 V2: la pantalla REAL de administración de planes (/admin/content, pestaña Planes) con planes heredados fuera de lista y el servidor del PR.
// Uso: PLAYWRIGHT_MODULE=... BASE=http://localhost:4361 TOKEN_FILE=<json con token de admin> OUT=<carpeta> node qa/e366-pantalla.cjs
const fs = require('fs'); const { chromium } = require(process.env.PLAYWRIGHT_MODULE); const BASE = process.env.BASE; const OUT = process.env.OUT || '.'; const tok = JSON.parse(fs.readFileSync(process.env.TOKEN_FILE, 'utf8')).token; const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const NL = String.fromCharCode(10); const flat = (t) => t.split(NL).join(' | ')
;(async () => { const br = await chromium.launch(); const c = await br.newContext({ viewport: { width: 1360, height: 1200 } }); const p = await c.newPage(); const calls = []
  await p.addInitScript(([t]) => { localStorage.setItem('elevation_token', t); localStorage.setItem('elevation_role', 'admin'); localStorage.setItem('elevation_name', 'Admin QA'); localStorage.setItem('elv_lang', 'es') }, [tok])
  p.on('response', async (r) => { const u = new URL(r.url()); const m = r.request().method(); if (/\/api\/admin\/pricing/.test(u.pathname) && m !== 'GET') calls.push(`${m} ${u.pathname} → ${r.status()} ${(await r.text().catch(() => '')).slice(0, 160)} | cuerpo enviado: ${(r.request().postData() || '').slice(0, 260)}`) })
  await p.goto(BASE + '/admin/content', { waitUntil: 'load' }); await sleep(3500)
  await p.getByText('PLANES', { exact: false }).first().click().catch(() => {}); await sleep(2500)
  const main = await p.evaluate(() => (document.querySelector('main') || document.body).innerText); console.log('PLANES:', flat(main).slice(0, 700))
  console.log('BOTONES:', JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('button')].map((b) => (b.innerText || b.getAttribute('aria-label') || '').trim().split(String.fromCharCode(10)).join(' ').slice(0, 40)).filter(Boolean))))
  await p.screenshot({ path: OUT + '/planes.png' }).catch(() => {})
  const SLUGS = ['legacy-usd', 'legacy-jpy']; for (let idx = 0; idx < SLUGS.length; idx++) { const slug = SLUGS[idx]; const edit = p.getByRole('button', { name: /Editar|Edit/i }).nth(idx); if (!(await edit.count())) { console.log(slug, ': no encontré «Editar»'); continue }
    await edit.click(); await sleep(900); const form = await p.evaluate(() => ({ currency: (document.querySelector('#plan-currency') || {}).value, currencyShown: document.querySelector('#plan-currency') ? document.querySelector('#plan-currency').selectedOptions[0]?.textContent : null, period: (document.querySelector('#plan-period') || {}).value, periodShown: document.querySelector('#plan-period') ? document.querySelector('#plan-period').selectedOptions[0]?.textContent : null }))
    console.log(slug, '· formulario de edición:', JSON.stringify(form)); const name = p.locator('#plan-name-es, input[id*=name-es], input[id*=nombre]').first(); if (await name.count()) { await name.fill('Renombrado ' + slug) }
    const before = calls.length; await p.getByRole('button', { name: /Guardar|Save/i }).first().click().catch((e) => console.log('guardar:', String(e).slice(0, 80))); await sleep(1800)
    console.log(slug, '· tras guardar → llamadas:', JSON.stringify(calls.slice(before))); const msg = await p.evaluate(() => [...document.querySelectorAll('[role=alert], [role=status], .error, [id$=-error]')].map((e) => e.innerText.trim()).filter(Boolean).join(' || ')); console.log(slug, '· mensaje visible:', msg.slice(0, 220) || '(ninguno)')
    await p.screenshot({ path: OUT + '/editar-' + slug + '.png' }).catch(() => {})
    // el truco: elegir otro valor y volver, o elegir valores válidos
    if (await p.locator('#plan-currency').count()) { await p.selectOption('#plan-currency', 'USD'); await p.selectOption('#plan-period', 'month'); const b2 = calls.length; await p.getByRole('button', { name: /Guardar|Save/i }).first().click().catch(() => {}); await sleep(1800); console.log(slug, '· con USD/month elegidos en los desplegables → ', JSON.stringify(calls.slice(b2))) }
    await p.keyboard.press('Escape').catch(() => {}); await p.reload({ waitUntil: 'load' }); await sleep(3000); await p.getByText('PLANES', { exact: false }).first().click().catch(() => {}); await sleep(2000) }
  await br.close() })()
