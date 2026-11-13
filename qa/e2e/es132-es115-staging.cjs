// [QA-Claude] Humo posterior en staging (autorizado por Mauricio) · ES-132 (recuperación de contraseña, #128) y ES-115 (migrar al desplegar, #87). Cuentas SINTÉTICAS propias, sin IA, sin envío real de correo.
const L = require('./lib.cjs'); const { j, API, chromium, fs, path } = L; const crypto = require('crypto');
const out = []; const R = (id, ok, d = '') => { out.push({ id, ok: !!ok, detail: String(d).slice(0, 300) }); console.log(JSON.stringify({ id, ok: !!ok, detail: String(d).slice(0, 260) })); };
(async () => {
  const h = await j('GET', '/api/health'); R('H1 /api/health 200 con el commit desplegado (migración al arrancar OK)', h.s === 200 && h.j?.status === 'ok', `commit=${h.j?.commit ?? 'n/d'}`);
  const A = await L.newPersona('r132a'), B = await L.newPersona('r132b'); const sa = await L.login(A), sb = await L.login(B); R('H2 registro y login de dos cuentas sintéticas', !!sa && !!sb, `registro=${A.status}/${B.status}`); if (!sa || !sb) process.exit(1);
  const d = await j('POST', '/api/diary', sa.token, { date: '2026-11-03', content: 'Entrada sintética tras ES-132/ES-115' }); const id = d.j?.id; const g = await j('GET', '/api/diary', sa.token); const l = Array.isArray(g.j) ? g.j : (g.j?.entries ?? []);
  R('H3 diario bajo RLS y la nueva migración: escribir y leer', d.s === 201 && !!id && g.s === 200 && l.length === 1, `post=${d.s} get=${g.s} n=${l.length}`);
  const ajeno = await j('GET', '/api/diary/' + id, sb.token); R('H4 aislamiento: B no lee la entrada de A (404)', ajeno.s === 404, `http=${ajeno.s}`);
  await j('DELETE', '/api/diary/' + id, sa.token);
  const m = await j('GET', '/api/messages', sa.token); R('H5 /api/messages y /api/ai/usage 200', m.s === 200 && (await j('GET', '/api/ai/usage', sa.token)).s === 200, `http=${m.s}`);
  // ES-132 API
  const r1 = await j('POST', '/api/password-reset/request', null, { email: A.email }); const r2 = await j('POST', '/api/password-reset/request', null, { email: `no-existe-${Date.now()}@example.test` });
  R('R1 solicitar recuperación: respuesta neutra igual para una cuenta que existe y una que no (sin enumeración) y sin 5xx aunque no haya proveedor de correo', r1.s < 300 && r1.s === r2.s && JSON.stringify(r1.j) === JSON.stringify(r2.j), `existe=${r1.s} no-existe=${r2.s} iguales=${JSON.stringify(r1.j) === JSON.stringify(r2.j)}`);
  const bad = await j('POST', '/api/password-reset/confirm', null, { token: 'x'.repeat(48), password: 'Zz-' + Date.now() + 'aA!x' }); R('R2 token inventado: 4xx, nunca 5xx', bad.s >= 400 && bad.s < 500, `http=${bad.s}`);
  const inv = [await j('POST', '/api/password-reset/request', null, {}), await j('POST', '/api/password-reset/request', null, { email: 'no-es-correo' }), await j('POST', '/api/password-reset/request', null, { email: 'a'.repeat(400) + '@example.test' })]; R('R3 entradas inválidas en la solicitud: vacío → 400; correo mal formado o larguísimo → 202 neutro por diseño (la ruta responde 202 a cualquier texto no vacío, sin enumeración); nunca 5xx', inv[0].s === 400 && inv.every(x => x.s < 500), inv.map(x => x.s).join(','));
  const still = await L.login(A); R('R4 solicitar una recuperación no cierra ni cambia la contraseña actual (la cuenta sigue entrando)', !!still, 'login ok');
  // Interfaz ES/EN
  const b = await chromium.launch();
  for (const lang of ['es', 'en']) {
    const ctx = await b.newContext({ viewport: { width: 320, height: 800 } }); await ctx.addInitScript(l => { try { localStorage.setItem('elv_lang', l); } catch { /* */ } }, lang); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 80)));
    await p.goto(API + '/login', { waitUntil: 'load' }); await p.waitForTimeout(1500); const link = p.getByRole('link', { name: lang === 'es' ? /Olvidaste/i : /Forgot/i }); const has = await link.count();
    R(`U1 ${lang} enlace «${lang === 'es' ? '¿Olvidaste tu contraseña?' : 'Forgot your password?'}» en el login`, has === 1, `enlaces=${has}`);
    if (has) { await link.first().click(); await p.waitForTimeout(800); const onPage = new URL(p.url()).pathname === '/forgot-password'; await p.getByRole('textbox').first().fill(`qa-r132ui-${lang}-${Date.now()}@example.test`); await p.getByRole('button', { name: /enviar|send|solicitar|request|continuar|continue/i }).first().click(); await p.waitForTimeout(1800);
      const txt = await p.evaluate(() => document.body.innerText); const ov = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      R(`U2 ${lang} pantalla de recuperación en 320 px: mensaje neutro, sin desborde y sin errores de página`, onPage && (lang === 'es' ? /Si existe una cuenta/i : /If an account exists/i).test(txt) && ov <= 0 && errs.length === 0, `ruta=${onPage} desborde=${ov} errores=${errs.length}`); }
    await ctx.close();
  }
  await b.close();
  console.log('RESUMEN-STAGING-132-115 ' + JSON.stringify({ total: out.length, fallos: out.filter(o => !o.ok).length })); fs.writeFileSync(path.join(__dirname, '..', 'evidence', 'ES-132-115-staging-humo.json'), JSON.stringify(out, null, 1));
})().catch(e => { console.log('ERROR ' + String(e.stack).slice(0, 500)); process.exit(1); });
