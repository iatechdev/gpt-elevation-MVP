// [QA-Claude-3] Mutaciones de #358 (solo qa/): es-240 PG sobre el worktree con main + #358 fusionados (sessions.js); revierte cada mutación.
const fs = require('fs'), cp = require('child_process'), path = require('path')
const B = (process.env.QA3_DIR || 'C:/Users/Usuario/tools/qa3') + '/wt/backend'; const F = path.join(B, 'routes/sessions.js'); const U = 'postgres://elevation:elevation_local@127.0.0.1:54341/postgres'
const run = () => { const r = cp.spawnSync('node', ['--test', 'test/integration/es-240-postgres.cjs'], { cwd: B, encoding: 'utf8', env: { ...process.env, ES240_TEST_DATABASE_URL: U } }); const o = (r.stdout || '') + (r.stderr || ''); const m = k => (o.match(new RegExp('# ' + k + ' (\\d+)')) || [])[1]; return { pass: m('pass'), fail: m('fail'), names: [...o.matchAll(/^\s+not ok \d+ - (.{0,80})/gm)].map(x => x[1]).slice(0, 2) } }
const ROLE = "if (req.user.role !== 'user') return res.status(403).json({ error: 'Users only.' });"
const M = [
  ['MU1 /profile sin verificar el rol', s => s.replace("router.get('/user/my-therapist/profile', async (req, res) => {\n  try {\n    " + ROLE, "router.get('/user/my-therapist/profile', async (req, res) => {\n  try {")],
  ['MU2 /sessions sin verificar el rol', s => s.replace("router.get('/user/my-therapist/sessions', async (req, res) => {\n  try {\n    " + ROLE, "router.get('/user/my-therapist/sessions', async (req, res) => {\n  try {")],
  ['MU3 /sessions usa el therapistId que manda el cliente', s => s.replace('res.json(await myTherapistSessions(req.user.id, await currentTherapistId(req.user.id)));', 'res.json(await myTherapistSessions(req.user.id, Number(req.query.therapistId) || await currentTherapistId(req.user.id)));')],
  ['MU4 las próximas no se filtran por el profesional vigente', s => s.replace("where: { patientId: userId, therapistId, status: 'scheduled'", "where: { patientId: userId, status: 'scheduled'")],
  ['MU5 las anteriores no se filtran por la persona (patientId)', s => s.replace("where: { patientId: userId, therapistId, status: 'completed' }", "where: { therapistId, status: 'completed' }")],
  ['MU6 las anteriores devuelven la nota privada del profesional', s => s.replace('patientMoodAfter: s.patientMoodAfter, status: s.status,', 'patientMoodAfter: s.patientMoodAfter, status: s.status, therapistNote: s.therapistNote,')],
  ['MU7 /profile usa el profesional que manda el cliente', s => s.replace('const { therapist } = await myTherapistProfile(req.user.id);\n    res.json({ therapist });', 'const { therapist } = await myTherapistProfile(Number(req.query.userId) || req.user.id);\n    res.json({ therapist });')],
  ['MU8 el vínculo retirado sigue mostrando sesiones (sin comprobar el vínculo)', s => s.replace("if (!therapistId) return { upcomingSessions: [], pastSessions: [] };", '')],
]
{ const c = run(); console.log('CONTROL sin mutar: pass=' + c.pass + ' fail=' + c.fail) }
for (const [name, fn] of M) {
  const orig = fs.readFileSync(F, 'utf8'); const mut = fn(orig)
  if (mut === orig) { console.log('SIN EFECTO (no aplicó):', name); continue }
  fs.writeFileSync(F, mut); const r = run(); fs.writeFileSync(F, orig)
  console.log(`${Number(r.fail) > 0 ? 'DETECTADA' : 'NO DETECTADA'} | ${name} | pass=${r.pass} fail=${r.fail} ${r.names.join(' ; ')}`)
}
