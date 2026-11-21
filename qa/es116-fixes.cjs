// QA-Claude-2 — verifica las correcciones de #88 (H-88-02 clave «new», H-88-03 edición durante el guardado) con backend real.
// Env: TOKEN (admin sintético), PLAYWRIGHT_MODULE.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE)
const API = 'http://localhost:8090', UI = 'http://localhost:5173', TK = process.env.TOKEN; let fails = 0; const ck = (n, ok, x = '') => { if (!ok) fails++; console.log(`${ok ? 'OK   ' : 'FALLA'} ${n} ${x}`) }
const call = async (m, p, b) => { const r = await fetch(API + p, { method: m, headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + TK }, body: b ? JSON.stringify(b) : undefined }); return { s: r.status, j: await r.json().catch(() => null) } }
;(async () => {
  let d = await call('POST', '/api/admin/skill-catalog'); if (d.s === 409) { const l = (await call('GET', '/api/admin/skill-catalog')).j.catalogs.find(c => c.status === 'draft'); d = { j: l } } const id = d.j.id
  const base = (await call('GET', `/api/admin/skill-catalog/${id}`)).j.skills[0]
  const put = (k, o) => call('PUT', `/api/admin/skill-catalog/${id}/skills/${k}`, { type: base.type, labels: base.labels, rubric: base.rubric, ...o })
  for (const k of ['new', 'New', 'NEW']) { const r = await put(k, {}); ck(`H-88-02 servidor: clave «${k}» rechazada sin 5xx`, r.s >= 400 && r.s < 500, `HTTP ${r.s} ${r.j?.code || ''}`) }
  const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: 1280, height: 900 } }); await c.addInitScript(t => { localStorage.setItem('elevation_token', t); localStorage.setItem('elevation_role', 'admin'); localStorage.setItem('elv_lang', 'es') }, TK); const p = await c.newPage(); const puts = []; p.on('request', r => r.method() === 'PUT' && puts.push(r.url()))
  await p.goto(`${UI}/admin/skill-catalog/${id}`, { waitUntil: 'networkidle' }); await p.waitForTimeout(600)
  await p.getByRole('link', { name: /Añadir habilidad/ }).click().catch(async () => { await p.getByRole('button', { name: /Añadir habilidad/ }).click() }); await p.waitForTimeout(500)
  await p.locator('#skcat-key').fill('new'); await p.locator('input[id*="label-es"]').first().fill('x'); await p.getByRole('button', { name: 'Guardar' }).click(); await p.waitForTimeout(700)
  ck('H-88-02 cliente: clave «new» → error en línea y NO envía', puts.length === 0 && /clave/i.test(await p.locator('body').innerText()), JSON.stringify((await p.locator('[role=alert]').allInnerTexts()).slice(0, 1)))
  await p.goto(`${UI}/admin/skill-catalog/${id}/skills/${base.skillKey}`, { waitUntil: 'networkidle' }); await p.waitForTimeout(700)
  await p.route('**/api/admin/skill-catalog/*/skills/*', async r => { if (r.request().method() === 'PUT') await new Promise(x => setTimeout(x, 1500)); await r.continue() })
  const en = p.locator('input[id*="label-en"]').first(); await en.fill('Nombre EN uno'); await p.getByRole('button', { name: 'Guardar' }).click(); await p.waitForTimeout(400)
  ck('H-88-03 durante el guardado el campo está deshabilitado', await en.isDisabled()); await p.waitForTimeout(2600)
  ck('H-88-03 al terminar el valor guardado es el escrito', (await en.inputValue()) === 'Nombre EN uno' && ((await call('GET', `/api/admin/skill-catalog/${id}`)).j.skills.find(s => s.skillKey === base.skillKey)).labels.en === 'Nombre EN uno')
  await b.close(); console.log(fails ? `\nFALLAS: ${fails}` : '\nTODO OK'); process.exit(fails ? 1 : 0)
})().catch(e => { console.error('EXCEPCIÓN', e.message); process.exit(3) })
