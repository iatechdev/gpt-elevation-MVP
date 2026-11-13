// [QA-Claude] Humo posterior en staging (autorizado por Mauricio) · #127 ES-136 «Cerrar sesión» y #131 ES-142 (parte sin IA). Cuentas SINTÉTICAS propias, SIN llamadas de IA.
const L = require('./lib.cjs'); const { j, API, chromium, fs, path } = L; const crypto = require('crypto');
const out = []; const R = (id, ok, d = '') => { out.push({ id, ok: !!ok, detail: String(d).slice(0, 300) }); console.log(JSON.stringify({ id, ok: !!ok, detail: String(d).slice(0, 250) })); };
(async () => {
  const h = await j('GET', '/api/health'); R('H1 /api/health 200', h.s === 200, `http=${h.s} commit=${h.j?.commit ?? 'n/d'}`);
  // #131 sin IA
  const A = await L.newPersona('r131'), sa = await L.login(A); if (!sa) { console.log('ERROR sin sesión'); process.exit(1); }
  const m = await j('GET', '/api/messages', sa.token); R('S1 #131 /api/messages de cuenta nueva: 200, vacío y sin campo truncated', m.s === 200 && Array.isArray(m.j) && m.j.length === 0 && !JSON.stringify(m.j).includes('truncated'), `http=${m.s}`);
  const t = await j('GET', '/api/chat/turns/' + crypto.randomUUID(), sa.token); R('S2 #131 GET turno inexistente: 404 (no 500) y sin contenido', t.s === 404, `http=${t.s}`);
  const e1 = await j('POST', '/api/chat', sa.token, { message: '', requestId: crypto.randomUUID() }); R('S3 #131 POST /api/chat con mensaje vacío: 4xx sin llamar a la IA', e1.s >= 400 && e1.s < 500, `http=${e1.s}`);
  const e2 = await j('POST', '/api/chat', sa.token, { message: 'x', requestId: 'x y!' }); R('S4 #131 POST /api/chat con requestId inválido: 4xx', e2.s >= 400 && e2.s < 500, `http=${e2.s}`);
  const e3 = await j('GET', '/api/chat/turns/%27%3B--', sa.token); R('S5 #131 id de turno malicioso: 4xx, nunca 500', e3.s >= 400 && e3.s < 500, `http=${e3.s}`);
  const e4 = await j('GET', '/api/messages', null); R('S6 sin token: 401/403', e4.s === 401 || e4.s === 403, `http=${e4.s}`);
  // #127 navegador
  const b = await chromium.launch();
  for (const lang of ['es', 'en']) {
    const P = await L.newPersona('r127' + lang), s = await L.login(P); if (!s) { R(`C0 ${lang} sesión`, false); continue; }
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
    await ctx.addInitScript(([l, ss]) => { try { localStorage.setItem('elv_lang', l); if (!sessionStorage.getItem('i')) { localStorage.setItem('elevation_token', ss.token); localStorage.setItem('elevation_role', ss.role); localStorage.setItem('elevation_name', ss.name || ''); sessionStorage.setItem('i', '1'); } } catch { /* */ } }, [lang, s]);
    const p = await ctx.newPage(); const lg = []; p.on('request', q => { if (/\/api\/logout$/.test(q.url())) lg.push(q.method()); }); const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 100)));
    await p.goto(API + '/app/dashboard', { waitUntil: 'load' }); await p.waitForTimeout(2500);
    const label = lang === 'es' ? 'Cerrar sesión' : 'Sign out'; const btn = p.getByRole('button', { name: label, exact: true }); const visible = await btn.count() > 0;
    R(`C1 #127 ${lang}: «${label}» visible en el dashboard`, visible, `botones=${await btn.count()}`);
    if (visible) {
      await btn.first().click(); await p.waitForTimeout(900); const skip = p.getByRole('button', { name: lang === 'es' ? 'Saltar' : /Skip/ }); if (await skip.count()) { await skip.first().click(); } else if (await btn.count() > 1) { await btn.last().click(); } await p.waitForTimeout(2500);
      const path1 = new URL(p.url()).pathname; const tok = await p.evaluate(() => !!localStorage.getItem('elevation_token')).catch(() => 'n/d');
      R(`C2 #127 ${lang}: cerrar sesión llama POST /api/logout una vez, limpia el token y vuelve a la portada`, lg.length === 1 && lg[0] === 'POST' && tok === false && path1 === '/', `logout=${lg.join(',')} token=${tok} ruta=${path1}`);
      const after = await j('GET', '/api/messages', s.token); R(`C3 #127 ${lang}: el token anterior queda revocado en el servidor (401)`, after.s === 401, `http=${after.s}`);
    }
    R(`C4 #127 ${lang}: sin errores de página`, errs.length === 0, errs.join(' | ')); await ctx.close();
  }
  await b.close();
  console.log('RESUMEN-STAGING ' + JSON.stringify({ total: out.length, fallos: out.filter(o => !o.ok).length }));
  fs.writeFileSync(path.join(__dirname, '..', 'evidence', 'ES-127-131-staging-humo.json'), JSON.stringify(out, null, 1));
})().catch(e => { console.log('ERROR ' + String(e.stack).slice(0, 500)); process.exit(1); });
