// [QA-Claude] ES-117 · humo posterior en staging (autorizado por Mauricio). Solo cuentas SINTÉTICAS propias, SIN llamadas de IA. No imprime contraseñas.
const L = require('./lib.cjs'); const { j, fs, path } = L; const out = []; const R = (id, ok, d = '') => { out.push({ id, ok: !!ok, detail: String(d).slice(0, 300) }); console.log(JSON.stringify({ id, ok: !!ok, detail: String(d).slice(0, 250) })); };
(async () => {
  const h = await j('GET', '/api/health'); R('H1 /api/health 200', h.s === 200 && h.j?.status === 'ok', `http=${h.s}`);
  const pl = await j('GET', '/api/plans'); R('H2 /api/plans 200 (lectura pública)', pl.s === 200, `http=${pl.s}`);
  const A = await L.newPersona('r117a'), B = await L.newPersona('r117b'); const sa = await L.login(A), sb = await L.login(B); R('H3 registro y login de dos cuentas sintéticas A y B', !!sa && !!sb, `registro=${A.status}/${B.status}`);
  if (!sa || !sb) { process.exit(1); }
  const d = await j('POST', '/api/diary', sa.token, { date: '2026-11-03', content: 'Entrada sintética de QA tras ES-117' }); const id = d.j?.id; R('H4 escribir en el diario (INSERT con RLS activo)', d.s >= 200 && d.s < 300 && !!id, `http=${d.s}`);
  const g = await j('GET', '/api/diary', sa.token); const list = Array.isArray(g.j) ? g.j : (g.j?.entries ?? []); R('H5 leer el diario propio (SELECT)', g.s === 200 && list.length === 1, `http=${g.s} entradas=${list.length}`);
  const u = await j('PUT', '/api/diary/' + id, sa.token, { content: 'Entrada sintética editada' }); R('H6 editar la entrada (UPDATE)', u.s === 200, `http=${u.s}`);
  const ajeno = await j('GET', '/api/diary/' + id, sb.token); R('H7 aislamiento: la cuenta B no puede leer la entrada de A (404/403)', ajeno.s === 404 || ajeno.s === 403, `http=${ajeno.s}`);
  const ajenoDel = await j('DELETE', '/api/diary/' + id, sb.token); R('H8 aislamiento: B no puede borrar la entrada de A', ajenoDel.s === 404 || ajenoDel.s === 403, `http=${ajenoDel.s}`);
  const m = await j('GET', '/api/messages', sa.token); R('H9 /api/messages de cuenta nueva: 200 y vacío (sin crisis ni errores)', m.s === 200 && Array.isArray(m.j) && m.j.length === 0, `http=${m.s}`);
  const us = await j('GET', '/api/ai/usage', sa.token); R('H10 /api/ai/usage 200 (AiUsages/AiBudgetCounters legibles)', us.s === 200, `http=${us.s}`);
  const nt = await j('GET', '/api/messages', null); R('H11 sin token: rechazado (401/403)', nt.s === 401 || nt.s === 403, `http=${nt.s}`);
  const del = await j('DELETE', '/api/diary/' + id, sa.token); R('H12 borrar la entrada propia (DELETE)', del.s >= 200 && del.s < 300, `http=${del.s}`);
  const g2 = await j('GET', '/api/diary', sa.token); const l2 = Array.isArray(g2.j) ? g2.j : (g2.j?.entries ?? []); R('H13 el diario queda vacío tras borrar', g2.s === 200 && l2.length === 0, `entradas=${l2.length}`);
  console.log('RESUMEN-ES117-HUMO ' + JSON.stringify({ total: out.length, fallos: out.filter(o => !o.ok).length }));
  fs.writeFileSync(path.join(__dirname, '..', 'evidence', 'ES-117-staging-humo.json'), JSON.stringify(out, null, 1));
})().catch(e => { console.log('ERROR ' + String(e.stack).slice(0, 400)); process.exit(1); });
