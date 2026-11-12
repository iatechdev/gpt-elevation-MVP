const SUT = 'C:/Users/Usuario/Documents/qa-pr-221/backend'; const { startRealApi } = require(SUT + '/test/support/realApi.cjs'); process.chdir(SUT);
const hooks = []; const t = { after: (f) => hooks.push(f) };
(async () => {
  const { q, mkUser, http, provider } = await startRealApi(t, { envVar: 'QA159_DB', prefix: 'qa159n' });
  const admin = await mkUser('admin'); const a = await mkUser('user');
  await http(a, 'POST', '/api/mood/checkin', { mood: 1 }); for (let d = 1; d <= 6; d++) await q('INSERT INTO "MoodLogs" ("UserId", date, checkin_mood, "createdAt", "updatedAt") VALUES ($1,$2,2,now(),now())', [a.id, '2026-10-0' + d]);
  const list = await http(admin, 'GET', '/api/admin/usuarios'); const rows = Array.isArray(list.body) ? list.body : (list.body.usuarios || list.body.users || []); const mine = rows.find((u) => u.id === a.id);
  console.log('ADMIN lista /api/admin/usuarios → fila de la persona (que no compartió con nadie):', list.status, JSON.stringify(mine && { id: mine.id, moodPromedio: mine.moodPromedio, sesiones: mine.sesiones }));
  const st = await http(admin, 'GET', '/api/admin/usuarios/' + a.id + '/stats'); console.log('ADMIN stats de la persona:', st.status, JSON.stringify(st.body).slice(0, 300));
  const before = provider.requests.length; const rec = await http(a, 'POST', '/api/recommendations/generate', { lang: 'es' }); const prompt = provider.requests.slice(before).join(' ');
  console.log('RECOMENDACIONES /generate:', rec.status, '| llamadas a la IA:', provider.requests.length - before, '| el prompt incluye el ánimo medio:', /Average mood \(1-5 scale\): [0-9]/.test(prompt), '|', (prompt.match(/Average mood[^\\]{0,40}/) || [''])[0]);
  for (const h of hooks.reverse()) await h(); process.exit(0);
})().catch((e) => { console.error('FATAL', e.stack); process.exit(1); });
