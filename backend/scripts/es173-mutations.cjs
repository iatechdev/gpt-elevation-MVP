// ES-173 · Mutaciones: cada una ROMPE a propósito un control de «Mi opinión» y la prueba de PostgreSQL real (test/integration/es-173-postgres.cjs) debe FALLAR.
// Si una mutación pasa («SOBREVIVE»), el control no está probado y el script termina con código ≠ 0. El archivo original se restaura siempre (también si se interrumpe).
// Uso:  ES173_TEST_DATABASE_URL=postgres://…@127.0.0.1:…/postgres node scripts/es173-mutations.cjs [filtro]      (solo en un clúster desechable en loopback; cada corrida tarda ~1 min)
const fs = require('node:fs'); const path = require('node:path'); const { spawnSync } = require('node:child_process');
const backend = path.resolve(__dirname, '..');
const URL_ = process.env.ES173_TEST_DATABASE_URL; if (!URL_ || !['127.0.0.1', 'localhost'].includes(new URL(URL_).hostname)) { console.error('Se requiere ES173_TEST_DATABASE_URL en loopback.'); process.exit(2); }
const U = 'utils/pilotFeedback.js';
// [nombre, archivo, texto original, texto mutado]. El original debe existir (si no, la mutación está obsoleta y el script falla).
const MUTATIONS = [
  ['M1 guardar sin comprobar el permiso', U, 'return await consent.withConsent(userId, PURPOSE, async (transaction) => {', 'return await (async (fn) => { const transaction = await sequelize.transaction(); try { const r = await fn(transaction); await transaction.commit(); return r; } catch (e) { await transaction.rollback(); throw e; } })(async (transaction) => {'],
  ['M2 sin control de versión al guardar', U, 'if (body.baseVersion !== current) throw new FeedbackError(409, \'version_conflict\'', 'if (false) throw new FeedbackError(409, \'version_conflict\''],
  ['M3 categorías repetidas permitidas', U, 'new Set(helpedBy).size !== helpedBy.length', 'false'],
  ['M4 respuesta completamente vacía permitida', U, 'if (initialValue === null && listened === null', 'if (false && initialValue === null && listened === null'],
  ['M5 retirar solo oculta (no sobrescribe el contenido)', U, "{ answers: {}, status: 'withdrawn'", "{ status: 'withdrawn'"],
  ['M6 umbral de 4 personas en vez de 5', U, 'const MIN_PEOPLE = 5;', 'const MIN_PEOPLE = 4;'],
  ['M7 agregados sin exigir permiso vigente', U, "AND c.status = 'granted' AND c.version >= :required", ''],
  ['M8 leer la respuesta de cualquier persona (sin titular)', U, 'PilotFeedback.findOne({ where: { UserId: userId, windowKey } });', 'PilotFeedback.findOne({ where: { windowKey } });'],
  ['M9 sin idempotencia por requestId', U, 'if (row && row.lastRequestId === body.requestId) {', 'if (false && row && row.lastRequestId === body.requestId) {'],
  ['M10 retirar ignora la versión', U, 'baseVersion !== (row ? row.version : 0)', 'false'],
  ['M11 sin reintento ante la primera respuesta simultánea', U, 'if (error instanceof UniqueConstraintError && attempt === 1) continue;', ''],
  ['M12 agregados publican aunque respondan menos de 5', U, 'eligible >= MIN_PEOPLE && responded >= MIN_PEOPLE', 'eligible >= MIN_PEOPLE'],
  ['M13 fuera de personalData.CORE (exportar/purgar)', 'utils/personalData.js', "['pilotFeedbacks', 'PilotFeedback', 'UserId',", "['pilotFeedbacksX', 'Consent', 'UserIdX',"],
  ['M14 ruta de la persona sin sesión', 'server.js', "verificarToken, require('./routes/pilotFeedback').person", "require('./routes/pilotFeedback').person"],
  ['M15 el permiso nuevo no es un propósito', 'utils/consent.js', '  pilot_feedback: { required: false },\n', ''],
  ['M16 permiso con versión de política ignorada', 'utils/consent.js', 'const isEffective = (row, purpose) => Boolean(row) && row.status === \'granted\' && row.version >= REQUIRED_VERSION[purpose];', 'const isEffective = (row, purpose) => Boolean(row) && row.status === \'granted\';'],
];
const only = process.argv[2]; const selected = MUTATIONS.filter(([name]) => !only || name.includes(only));
const originals = new Map(); const restore = () => { for (const [file, text] of originals) fs.writeFileSync(path.join(backend, file), text); originals.clear(); };
process.on('exit', restore); process.on('SIGINT', () => { restore(); process.exit(130); });
const run = () => spawnSync(process.execPath, ['--test', 'test/integration/es-173-postgres.cjs'], { cwd: backend, encoding: 'utf8', env: { ...process.env, ES173_TEST_DATABASE_URL: URL_ } });
let survived = 0;
for (const [name, file, before, after] of selected) {
  const full = path.join(backend, file); const text = fs.readFileSync(full, 'utf8'); const normal = text.replace(/\r\n/g, '\n');
  if (!normal.includes(before)) { console.log(`OBSOLETA   ${name}: el texto original ya no existe`); survived++; continue; }
  originals.set(file, text);
  fs.writeFileSync(full, (normal.split(before).join(after)).replace(/\n/g, text.includes('\r\n') ? '\r\n' : '\n'));
  const result = run(); restore();
  const failing = (result.stdout.match(/^\s*not ok \d+ - .{0,70}/gm) || []).filter((line) => !line.startsWith('not ok 1 ')).map((line) => line.trim().slice(0, 60));
  if (result.status === 0) { console.log(`SOBREVIVE  ${name}`); survived++; } else console.log(`DETECTADA  ${name}  → ${failing[0] || 'falla de arranque/otra'}`);
}
console.log(`\n${selected.length - survived}/${selected.length} mutaciones detectadas`);
process.exit(survived ? 1 : 0);
