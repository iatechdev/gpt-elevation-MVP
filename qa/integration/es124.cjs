// [QA-Claude] ES-124 · PR #110 (voseo → tuteo). Local, Postgres real, proveedor SIMULADO, datos SINTÉTICOS.
// Uso: QA_SUT=<clon> QA_API=<servidor> DATABASE_URL=<base> OUT=<carpeta> node qa/integration/es124.cjs
const fs = require('fs'); const path = require('path'); const { createRequire } = require('module');
const E = process.env; const req = createRequire(path.join(E.QA_SUT, 'backend', 'package.json')); const { Client } = req('pg');
const { chromium } = require('C:/Users/Usuario/tools/playwright/node_modules/playwright'); const API = E.QA_API; const OUT = E.OUT; fs.mkdirSync(OUT, { recursive: true }); const stamp = Date.now();
const out = []; const check = (id, ok, d = '') => { out.push({ id, ok: !!ok }); console.log(JSON.stringify({ id, ok: !!ok, detail: String(d).slice(0, 300) })); };
// Formas voseantes (acentuadas) y vocabulario típico. «haces/tienes/puedes» (tuteo) NO cuentan.
const VOSEO = /(?<![\p{L}])(vos|tenés|podés|querés|sabés|sentís|preferís|decís|hacés|llegás|aprobás|rechazás|sos|Seleccioná|Generá|Escribí|Explicá|Comunicá|Agregá|Creá|Encontrá|Establecé|Reflexioná|Seguí|Intentá|Volvé|Esperá|Tomá|Mirá|Contá|Elegí|Revisá|Probá|Guardá|Completá|Cambiá|Ingresá|Subí|Descargá|Buscá|Poné|Vení|Hablá|Dejá|Ayudá|Respondé|Confirmá|Fijate|Decime|Contame|Mostrame|Avisame)(?![\p{L}])/u;
const ES_LEAK = /(Enviar|Conversación|Diario|Mensaje|Guardar|Pausar|Cerrar|Mi progreso|Mi terapeuta|Iniciar sesión|Registrarse|Contraseña|Usuarios|Contenido)/;
(async () => {
  const db = new Client({ connectionString: E.DATABASE_URL, ssl: false }); await db.connect();
  const j = async (m, p, t, b) => { const r = await fetch(API + p, { method: m, headers: { ...(t ? { Authorization: 'Bearer ' + t } : {}), ...(b ? { 'content-type': 'application/json' } : {}) }, body: b ? JSON.stringify(b) : undefined }); const x = await r.text(); let o = null; try { o = JSON.parse(x); } catch { /* */ } return { s: r.status, j: o }; };
  const mk = async (tag, role) => { const email = `qa110-${tag}-${stamp}@example.test`, password = 'Qa110-' + stamp + tag + 'aA!'; await j('POST', '/api/register', null, { name: 'QA110 ' + tag, email, password }); if (role !== 'user') await db.query('update "Users" set role=$1 where email=$2', [role, email]); const l = await j('POST', '/api/login', null, { email, password }); const id = (await db.query('select id from "Users" where email=$1', [email])).rows[0].id; return { email, password, token: l.j?.token, id }; };
  const U = await mk('u', 'user'), A = await mk('a', 'admin'), S = await mk('s', 'superadmin'), V = await mk('v', 'user');
  // V4: errores del backend (código HTTP y texto)
  const e1 = await j('POST', '/api/admin/usuarios', A.token, { name: 'x', email: `qa110-x-${stamp}@example.test`, password: 'Aa1!aaaaaaaa', role: 'superadmin' });
  const e2 = await j('PUT', `/api/admin/usuarios/${A.id}`, A.token, { active: false });
  const e3 = await j('PUT', `/api/admin/usuarios/${V.id}`, A.token, { role: 'superadmin' });
  const e4 = await j('DELETE', `/api/admin/usuarios/${S.id}`, S.token);
  try { const PP = req(path.join(E.QA_SUT, 'backend', 'PricingPlan.js')); await PP.create({ slug: 'qa' + String(stamp).slice(-8), name_es: 'Plan QA', name_en: 'QA plan', price: 0, isActive: true, features: [], limits: {} }); } catch (e) { console.log(JSON.stringify({ id: 'info semilla de plan', detail: String(e).slice(0, 160) })); }
  const plans = (await j('GET', '/api/plans')).j; const planId = Array.isArray(plans) ? plans[0]?.id : plans?.plans?.[0]?.id;
  const r1 = planId ? await j('POST', '/api/plan-requests', V.token, { planId }) : { s: 'sin planes' }; const r2 = planId ? await j('POST', '/api/plan-requests', V.token, { planId }) : { s: 'sin planes' };
  const tu = s => /tienes|puedes|Espera/.test(s || '') && !VOSEO.test(s || '');
  check('V4a admin crea rol privilegiado → 403 con texto en tuteo', e1.s === 403 && tu(e1.j?.error), `${e1.s} ${e1.j?.error}`);
  check('V4b admin modifica su propio usuario → 403 con tuteo', e2.s === 403 && tu(e2.j?.error), `${e2.s} ${e2.j?.error}`);
  check('V4c admin asigna rol privilegiado → 403 con tuteo', e3.s === 403 && tu(e3.j?.error), `${e3.s} ${e3.j?.error}`);
  check('V4d superadmin se elimina a sí mismo → 403 con tuteo', e4.s === 403 && tu(e4.j?.error), `${e4.s} ${e4.j?.error}`);
  if (planId) check('V4e segunda solicitud de plan pendiente → 4xx con tuteo («tienes… Espera»)', r1.s < 300 && r2.s >= 400 && r2.s < 500 && tu(r2.j?.error), `${r1.s}/${r2.s} ${r2.j?.error}`); else check('V4e solicitud de plan duplicada (no hay planes sembrados: no verificable)', false, 'sin planes');
  const bad = await Promise.all([j('POST', '/api/admin/usuarios', A.token, { name: 1, email: null, password: [], role: {} }), j('PUT', '/api/admin/usuarios/abc', A.token, { role: 5 }), j('POST', '/api/plan-requests', V.token, { planId: 'x' })]);
  check('V4f entradas inválidas en las mismas rutas: sin 5xx', bad.every(b => b.s < 500), bad.map(b => b.s).join(','));
  // Sesiones de navegador (una por rol)
  const b = await chromium.launch(); const ss = {};
  for (const [k, c] of [['u', U], ['a', A]]) { const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p = await ctx.newPage(); await p.goto(API + '/login', { waitUntil: 'networkidle' }); await p.fill('input[type=email]', c.email); await p.fill('input[type=password]', c.password); await p.keyboard.press('Enter'); await p.waitForTimeout(2500); ss[k] = await ctx.storageState(); await ctx.close(); }
  const PAGES = [['u', '/app/dashboard'], ['u', '/app/progress'], ['u', '/app/my-therapist'], ['u', '/app/chat'], ['a', '/admin/dashboard'], ['a', '/admin/users'], ['a', '/admin/content'], ['a', '/admin/prompts'], ['a', '/admin/metrics']];
  const seen = new Set();
  for (const [w, h] of [[1440, 900], [320, 568]]) for (const lang of ['es', 'en']) {
    for (const [role, route] of PAGES) {
      const ctx = await b.newContext({ viewport: { width: w, height: h }, storageState: ss[role] }); const p = await ctx.newPage(); const tag = `${w}-${lang}${route.replace(/\//g, '_')}`; const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 100)));
      await p.goto(API + route, { waitUntil: 'networkidle' }); await p.waitForTimeout(1200);
      const eb = p.getByRole('button', { name: lang === 'en' ? 'EN' : 'ES', exact: true }).first(); if (await eb.count()) { await eb.click().catch(() => {}); await p.waitForTimeout(700); }
      // abrir lo que esconde textos: estado de ánimo, modal de emparejamiento
      if (route === '/app/dashboard') { const m = p.locator('button', { hasText: /😊|🙂/ }).first(); if (await m.count()) { await m.click().catch(() => {}); await p.waitForTimeout(900); } }
      let text = await p.innerText('body'); let extra = '';
      if (route === '/app/dashboard' || route === '/app/my-therapist') { const mb = p.locator('button', { hasText: /(Encuentra|Buscar|Find|Match).{0,20}(terapeuta|therapist)|🤝/ }).first(); if (await mb.count()) { await mb.click().catch(() => {}); await p.waitForTimeout(1200); extra = await p.innerText('body'); text += '\n' + extra; } }
      const sw = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1); const keys = /\b[a-z]+(_[a-z0-9]+){1,}\b|\b[a-z]+\.[a-z]+\.[a-z]+\b/.exec(text.replace(/https?:\S+/g, ''));
      if (!seen.has(tag)) { seen.add(tag); if (w === 1440 || route === '/app/dashboard') await p.screenshot({ path: path.join(OUT, tag + '.png'), fullPage: true }); }
      if (lang === 'es') { const v = VOSEO.exec(text); check(`V2 ${tag}: sin voseo visible`, !v, v ? text.slice(Math.max(0, v.index - 40), v.index + 40).replace(/\n/g, ' ') : ''); }
      else { const l = ES_LEAK.exec(text.replace(/\b(Mi progreso)\b/g, '$1')); check(`V3 ${tag}: EN sin texto de interfaz en español`, !l, l ? text.slice(Math.max(0, l.index - 40), l.index + 40).replace(/\n/g, ' ') : ''); }
      check(`V6 ${tag}: sin scroll horizontal y sin errores de página`, !sw && errs.length === 0, JSON.stringify({ sw, errs }));
      if (keys && lang === 'es' && w === 1440) console.log(JSON.stringify({ id: `info clave i18n sospechosa ${tag}`, texto: keys[0] }));
      await ctx.close();
    }
  }
  await b.close(); await db.end();
  console.log('RESUMEN ' + JSON.stringify({ total: out.length, ok: out.filter(o => o.ok).length, fallos: out.filter(o => !o.ok).map(o => o.id) }));
})().catch(e => { console.log(JSON.stringify({ id: 'ERROR del script', ok: false, detail: String(e).slice(0, 300) })); process.exit(1); });
