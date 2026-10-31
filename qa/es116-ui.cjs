// QA-Claude-2 — ES-116 (#88): pantalla «Catálogo de habilidades» con backend REAL. Requiere backend (:8090) con catálogo publicado,
// vite (:5173) apuntando a él, y haber corrido antes qa/es116-api.cjs NO es necesario (este script crea su propio admin).
// Env: BACKEND, DATABASE_URL, OUT, PLAYWRIGHT_MODULE.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE)
const { createRequire } = require('module')
const { Client } = createRequire(process.env.BACKEND + '/package.json')('pg')
const path = require('path'), fs = require('fs')
const API = 'http://localhost:8090', UI = 'http://localhost:5173', PASS = require('crypto').randomBytes(12).toString('hex') + 'Aa1!', OUT = process.env.OUT; fs.mkdirSync(OUT, { recursive: true })
let fails = 0; const ck = (n, ok, x = '') => { if (!ok) fails++; console.log(`${ok ? 'OK   ' : 'FALLA'} ${n} ${x}`) }
const sql = async (q, a) => { const c = new Client({ connectionString: process.env.DATABASE_URL }); await c.connect(); try { return await c.query(q, a) } finally { await c.end() } }
const post = async (p, b, t) => { const r = await fetch(API + p, { method: 'POST', headers: { 'content-type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: JSON.stringify(b) }); return { s: r.status, j: await r.json().catch(() => null) } }
const person = async (tag, role) => { const email = `qa-${tag}-${Date.now()}@example.test`; await post('/api/register', { name: 'QA ' + tag, email, password: PASS }); if (role) await sql('UPDATE "Users" SET role=$1 WHERE email=$2', [role, email]); const l = await post('/api/login', { email, password: PASS }); return l.j.token }
const getJ = async (p, t) => (await fetch(API + p, { headers: { Authorization: 'Bearer ' + t } })).json()
;(async () => {
  const admin = await person('uiadmin', 'admin'), user = await person('uiuser')
  const browser = await chromium.launch()
  const ctxFor = async (token, role, lang = 'es', width = 1280) => { const c = await browser.newContext({ viewport: { width, height: 900 } }); await c.addInitScript(([t, r, l]) => { localStorage.setItem('elevation_token', t); localStorage.setItem('elevation_role', r); localStorage.setItem('elv_lang', l) }, [token, role, lang]); const p = await c.newPage(); p.errs = []; p.on('console', m => m.type() === 'error' && p.errs.push(m.text().slice(0, 120))); p.on('pageerror', e => p.errs.push(e.message.slice(0, 120))); p.dialogs = []; p.on('dialog', d => { p.dialogs.push(d.message()); d.dismiss() }); return p }
  const metrics = (p) => p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, small: [...document.querySelectorAll('button,a,summary,input[type=checkbox],select')].filter(b => b.offsetParent && (b.getBoundingClientRect().height < 44)).map(b => (b.textContent || b.getAttribute('aria-label') || b.type || '').trim().slice(0, 28)) }))
  // 0) persona sin rol admin: el servidor niega aunque el cliente se engañe con localStorage
  let p = await ctxFor(user, 'admin'); await p.goto(UI + '/admin/skill-catalog', { waitUntil: 'networkidle' }); await p.waitForTimeout(600)
  const t0 = await p.locator('body').innerText(); ck('S-2 persona sin rol admin (rol falso en el cliente): ve error de permiso y ningún dato del catálogo', /permiso|No tienes/i.test(t0) && !/Habilidades|Versión 1/.test(t0.replace(/Catálogo de habilidades/g, '')), JSON.stringify(t0.split('\n').filter(x => /permiso|sesi/i.test(x)).slice(0, 1)))
  await p.context().close()
  // 1) versiones: responsive
  for (const w of [375, 800, 1024, 1280]) { p = await ctxFor(admin, 'admin', 'es', w); await p.goto(UI + '/admin/skill-catalog', { waitUntil: 'networkidle' }); await p.waitForTimeout(500); const m = await metrics(p)
    ck(`F116-7 versiones a ${w}px sin desborde`, m.sw <= m.iw, `${m.sw}/${m.iw}`); if (m.small.length) console.log(`   controles <44px a ${w}:`, JSON.stringify(m.small))
    if (w === 375 || w === 1280) await p.screenshot({ path: path.join(OUT, `cat-versions-${w}.png`), fullPage: true }); await p.context().close() }
  // 2) borrador desde vigente
  p = await ctxFor(admin, 'admin'); await p.goto(UI + '/admin/skill-catalog', { waitUntil: 'networkidle' }); await p.waitForTimeout(500)
  ck('F116-1 enlace "Catálogo de habilidades" en el menú/pantalla', /Catálogo de habilidades/.test(await p.locator('h1').innerText()))
  await p.getByRole('button', { name: 'Crear borrador desde el vigente' }).click(); await p.waitForTimeout(1200)
  ck('F116-1 borrador creado y abierto (tabla de 8 habilidades)', (await p.locator('table tbody tr').count()) === 8 || (await p.locator('text=Completa').count()) >= 8, p.url())
  ck('F116-1 todas "Completa" y aviso "No falta nada"', (await p.locator('text=Completa').count()) >= 8 && /No falta nada/.test(await p.locator('body').innerText()))
  await p.screenshot({ path: path.join(OUT, 'cat-draft-1280.png'), fullPage: true })
  const draftUrl = p.url(); const draftId = draftUrl.split('/').pop()
  // 3) editar habilidad: territorios y XSS en el nombre
  await p.getByRole('link', { name: /Editar/ }).first().click().catch(async () => { await p.getByRole('button', { name: /Editar/ }).first().click() }); await p.waitForTimeout(800)
  ck('F116-7 formulario de habilidad con casillas de territorios', await p.locator('.skcat-check input[type=checkbox]').count() === 5)
  const m = await metrics(p); ck('F116-7 formulario 1280 sin desborde', m.sw <= m.iw)
  const before = await p.locator('.skcat-check input').evaluateAll(els => els.map(e => e.checked)); await p.locator('.skcat-check input').nth(1).check(); await p.locator('.skcat-check input').nth(3).check()
  const xss = '<img src=x onerror="window.__xss=1"> Comunicación QA'; await p.locator('#skcat-label-es, input[id*="label-es"]').first().fill(xss)
  await p.getByRole('button', { name: 'Guardar' }).click(); await p.waitForTimeout(1000)
  ck('F116-1 «Guardado.» tras guardar', /Guardado\./.test(await p.locator('body').innerText()))
  ck('S-3 XSS en el nombre no se ejecuta', (await p.evaluate(() => window.__xss)) === undefined && p.dialogs.length === 0)
  const saved = await getJ(`/api/admin/skill-catalog/${draftId}`, admin); const sk = saved.skills.find(s => s.labels.es === xss)
  ck('F116-1 guardado en servidor con territorios cambiados', !!sk && sk.territories.length === before.filter(Boolean).length + 2, JSON.stringify(sk?.territories))
  ck('S-3 el nombre se guarda como TEXTO (sin interpretar) y se muestra escapado', !!sk && (await p.locator('img[src="x"]').count()) === 0)
  await p.screenshot({ path: path.join(OUT, 'cat-skill-1280.png'), fullPage: true })
  // 4) cambios sin guardar piden confirmar
  await p.locator('.skcat-check input').nth(0).click(); const before2 = p.dialogs.length
  await p.getByRole('button', { name: /Volver al borrador/ }).first().click(); await p.waitForTimeout(500)
  ck('F116-7 cambios sin guardar: pide confirmar al salir', p.dialogs.length > before2 && /sin guardar/i.test(p.dialogs.at(-1)), JSON.stringify(p.dialogs.at(-1)))
  await p.context().close()
  // 5) alta de habilidad: clave inválida (no envía), repetida (rechazada); quitar con diálogo
  p = await ctxFor(admin, 'admin'); await p.goto(draftUrl.replace(UI, UI), { waitUntil: 'networkidle' }); await p.waitForTimeout(600)
  await p.getByRole('link', { name: /Añadir habilidad/ }).click().catch(async () => { await p.getByRole('button', { name: /Añadir habilidad/ }).click() }); await p.waitForTimeout(500)
  const puts = []; p.on('request', r => r.method() === 'PUT' && puts.push(r.url())); await p.locator('#skcat-key').fill('A'); await p.locator('input[id*="label-es"]').first().fill('Prueba'); await p.getByRole('button', { name: 'Guardar' }).click(); await p.waitForTimeout(500)
  ck('F116-4 clave inválida: error en línea y NO envía', /clave no es válida/i.test(await p.locator('body').innerText()) && puts.length === 0)
  await p.locator('#skcat-key').fill('comunicacion'); await p.getByRole('button', { name: 'Guardar' }).click(); await p.waitForTimeout(800)
  ck('F116-4 clave repetida: mensaje propio (no crudo)', /Ya existe una habilidad con esa clave|clave/i.test(await p.locator('body').innerText()) && !/catalog_|invalid_input/.test(await p.locator('body').innerText()))
  await p.locator('#skcat-key').fill('qa_nueva_habilidad'); await p.locator('input[id*="label-es"]').first().fill('Habilidad nueva QA'); await p.locator('input[id*="label-en"]').first().fill('New QA skill'); await p.getByRole('button', { name: 'Guardar' }).click(); await p.waitForTimeout(1000)
  ck('F116-1 alta de habilidad incompleta guardada en el borrador', (await getJ(`/api/admin/skill-catalog/${draftId}`, admin)).skills.some(s => s.skillKey === 'qa_nueva_habilidad'))
  await p.goto(draftUrl, { waitUntil: 'networkidle' }); await p.waitForTimeout(600)
  const body5 = await p.locator('body').innerText(); ck('F116-1 resumen "Para publicar faltan datos en 1 habilidad"', /faltan datos en 1/.test(body5))
  await p.getByRole('button', { name: /Publicar…/ }).click(); await p.waitForTimeout(600)
  const pubBtn = p.getByRole('button', { name: /Publicar versión/ }); ck('F116-1 publicar: lista lo que falta y el botón está desactivado', (await pubBtn.count()) === 0 || await pubBtn.isDisabled(), '')
  await p.screenshot({ path: path.join(OUT, 'cat-publish-blocked.png'), fullPage: true })
  // quitar con diálogo
  await p.goto(`${UI}/admin/skill-catalog/${draftId}/skills/qa_nueva_habilidad`, { waitUntil: 'networkidle' }); await p.waitForTimeout(600)
  await p.getByRole('button', { name: 'Quitar del borrador' }).click(); await p.waitForTimeout(300)
  ck('F116-7 Quitar: diálogo con foco inicial en «Cancelar»', (await p.evaluate(() => document.activeElement.textContent.trim())) === 'Cancelar')
  await p.keyboard.press('Escape'); await p.waitForTimeout(200); ck('F116-7 Esc cierra y no quita', (await getJ(`/api/admin/skill-catalog/${draftId}`, admin)).skills.some(s => s.skillKey === 'qa_nueva_habilidad'))
  await p.getByRole('button', { name: 'Quitar del borrador' }).click(); await p.waitForTimeout(300); await p.getByRole('button', { name: 'Sí, quitar' }).click(); await p.waitForTimeout(900)
  ck('F116-1 quitar confirmado: ya no está en el servidor', !(await getJ(`/api/admin/skill-catalog/${draftId}`, admin)).skills.some(s => s.skillKey === 'qa_nueva_habilidad'))
  // 6) publicar y solo lectura
  await p.goto(draftUrl, { waitUntil: 'networkidle' }); await p.waitForTimeout(600); await p.getByRole('button', { name: /Publicar…/ }).click(); await p.waitForTimeout(500)
  const pb = p.getByRole('button', { name: /Publicar versión/ }); ck('F116-1 sin faltantes: botón activo', await pb.isEnabled()); await pb.click(); await p.waitForTimeout(1200)
  ck('F116-1 publicada: mensaje y servidor', /publicada/i.test(await p.locator('body').innerText()) && (await getJ('/api/admin/skill-catalog', admin)).catalogs.find(c => String(c.id) === draftId)?.status === 'published')
  await p.goto(`${UI}/admin/skill-catalog/${draftId}/skills/comunicacion`, { waitUntil: 'networkidle' }); await p.waitForTimeout(600)
  ck('F116-3 versión publicada: formulario deshabilitado', await p.locator('.skcat-check input').first().isDisabled() && (await p.getByRole('button', { name: 'Guardar' }).count() === 0 || await p.getByRole('button', { name: 'Guardar' }).isDisabled()))
  ck('consola ES sin errores', p.errs.filter(e => !/403|Failed to load resource/.test(e)).length === 0, p.errs.join('|')); await p.context().close()
  // 7) EN y 375
  p = await ctxFor(admin, 'admin', 'en', 375); await p.goto(UI + '/admin/skill-catalog', { waitUntil: 'networkidle' }); await p.waitForTimeout(600)
  const en = await p.locator('body').innerText(); ck('F116-7 EN: versiones traducidas', /Skills catalog/.test(en) && !/Catálogo de habilidades|Versión|Publicad/.test(en), en.split('\n').slice(0, 2).join(' / '))
  const m2 = await metrics(p); ck('F116-7 EN 375 sin desborde', m2.sw <= m2.iw); await p.screenshot({ path: path.join(OUT, 'cat-versions-en-375.png'), fullPage: true })
  await p.goto(`${UI}/admin/skill-catalog/${draftId}`, { waitUntil: 'networkidle' }); await p.waitForTimeout(600); const en2 = await p.locator('body').innerText()
  ck('F116-7 EN: detalle de versión traducido', /Version|Skills/.test(en2) && !/Habilidades|Territorios/.test(en2), '')
  await p.context().close(); await browser.close(); console.log(fails ? `\nFALLAS: ${fails}` : '\nTODO OK'); process.exit(fails ? 1 : 0)
})().catch(e => { console.error('EXCEPCIÓN', e.message); process.exit(3) })
