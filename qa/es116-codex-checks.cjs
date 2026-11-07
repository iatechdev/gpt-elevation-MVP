// QA-Claude-2 — ES-116 (#88): verifica de forma independiente 2 observaciones del revisor automático (Codex). Backend real.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE)
const API = 'http://localhost:8090', UI = 'http://localhost:5173', TK = process.env.TOKEN
const call = async (m, p, b) => { const r = await fetch(API + p, { method: m, headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + TK }, body: b ? JSON.stringify(b) : undefined }); return { s: r.status, j: await r.json().catch(() => null) } }
;(async () => {
  const d = await call('POST', '/api/admin/skill-catalog'); const id = d.j.id
  const det = (await call('GET', `/api/admin/skill-catalog/${id}`)).j; const base = det.skills[0]
  const put = (k, o) => call('PUT', `/api/admin/skill-catalog/${id}/skills/${k}`, { type: base.type, labels: base.labels, rubric: base.rubric, ...o })
  const nw = await put('new', { labels: { es: 'Habilidad llamada new', en: 'Skill named new' } }); console.log('clave «new» aceptada por el servidor:', nw.s)
  const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: 1280, height: 900 } }); await c.addInitScript(t => { localStorage.setItem('elevation_token', t); localStorage.setItem('elevation_role', 'admin'); localStorage.setItem('elv_lang', 'es') }, TK)
  const p = await c.newPage()
  await p.goto(`${UI}/admin/skill-catalog/${id}`, { waitUntil: 'networkidle' }); await p.waitForTimeout(600)
  const row = p.locator('tr', { hasText: 'Habilidad llamada new' }); await row.getByRole('link', { name: /Editar/ }).click().catch(async () => { await row.getByRole('button', { name: /Editar/ }).click() }); await p.waitForTimeout(800)
  console.log('(a) URL', p.url().replace(UI, ''), '| clave en el formulario =', JSON.stringify(await p.locator('#skcat-key').inputValue()), '| nombre ES =', JSON.stringify(await p.locator('input[id*="label-es"]').first().inputValue()))
  // (b) escribir mientras se guarda
  await p.goto(`${UI}/admin/skill-catalog/${id}/skills/${base.skillKey}`, { waitUntil: 'networkidle' }); await p.waitForTimeout(600)
  await p.route('**/api/admin/skill-catalog/*/skills/*', async r => { if (r.request().method() === 'PUT') await new Promise(x => setTimeout(x, 1500)); await r.continue() })
  const en = p.locator('input[id*="label-en"]').first(); await en.fill('Nombre EN uno'); const src = p.locator('input[id*="source"], #skcat-source').first()
  await p.getByRole('button', { name: 'Guardar' }).click(); await p.waitForTimeout(300)
  const dis = await en.isDisabled(); await en.fill('Nombre EN dos (escrito mientras guarda)').catch(() => {}); await p.waitForTimeout(2800)
  console.log('(b) campo deshabilitado mientras guarda =', dis, '| valor final =', JSON.stringify(await en.inputValue()), '| en servidor =', JSON.stringify(((await call('GET', `/api/admin/skill-catalog/${id}`)).j.skills.find(s => s.skillKey === base.skillKey)).labels.en))
  await b.close()
})().catch(e => { console.error('EXCEPCIÓN', e.message); process.exit(3) })
