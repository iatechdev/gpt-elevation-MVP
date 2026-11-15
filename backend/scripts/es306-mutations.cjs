// ES-306 · Mutaciones: cada una ROMPE a propósito un control del correo sin distinguir mayúsculas y la prueba de PostgreSQL real (test/integration/es-306-postgres.cjs) debe FALLAR.
// Si una mutación pasa («SOBREVIVE»), el control no está probado y el script termina con código ≠ 0. Los archivos originales se restauran siempre (también si se interrumpe).
// Uso:  ES306_TEST_DATABASE_URL=postgres://…@127.0.0.1:…/postgres node scripts/es306-mutations.cjs [filtro]      (solo en un clúster desechable en loopback; cada corrida tarda ~40 s; correr de una en una)
const fs = require('node:fs'); const path = require('node:path'); const { spawnSync } = require('node:child_process');
const backend = path.resolve(__dirname, '..');
const URL_ = process.env.ES306_TEST_DATABASE_URL; if (!URL_ || !['127.0.0.1', 'localhost'].includes(new URL(URL_).hostname)) { console.error('Se requiere ES306_TEST_DATABASE_URL en loopback.'); process.exit(2); }
const H = 'utils/emailNormalize.js'; const A = 'routes/auth.js'; const P = 'routes/passwordReset.js'; const M = 'migrations/20261114010000-es306-email-lower-unique.cjs';
const R = 'migrations/20261115010000-es306-email-index-repair.cjs'; const L = 'utils/loginAttempts.js';
const INDEX_OFF = [M, 'CREATE UNIQUE INDEX IF NOT EXISTS "${INDEX}" ON "Users" (lower(btrim("email")))', 'SELECT 1'];
// [nombre, [[archivo, texto original, texto mutado], …]]. Cada original debe existir (si no, la mutación está obsoleta y el script falla).
const MUTATIONS = [
  ['M1 registro compara el texto exacto (el defecto original); el índice de red solo no lo tapa', [[A, 'const existing = await findUserByEmail(User, email);', 'const existing = await User.findOne({ where: { email } });']]],
  ['M1b registro compara el texto exacto y sin índice de red', [[A, 'const existing = await findUserByEmail(User, email);', 'const existing = await User.findOne({ where: { email } });'], INDEX_OFF]],
  ['M2 el registro guarda el correo sin normalizar', [[A, 'email: normalizeEmail(email), password', 'email, password']]],
  ['M3 el login busca el texto exacto', [[A, 'const user = await findUserByEmail(User, email);', 'const user = await User.findOne({ where: { email } });']]],
  ['M4 la recuperación busca el texto exacto', [[P, 'const user = await findUserByEmail(User, email);', 'const user = await User.findOne({ where: { email } });']]],
  ['M5 la búsqueda no cubre cuentas antiguas con mayúsculas (sin lower)', [[H, "return User.findOne({ ...options, where: sqlWhere(fn('lower', fn('btrim', col('email'))), normalized), order: [['id', 'ASC']] });", 'return null;']]],
  ['M6 la búsqueda no recorta espacios', [[H, 'where: { email: rawEmail.trim() }', 'where: { email: rawEmail }'], [H, "return typeof value === 'string' ? value.trim().toLowerCase() : value;", "return typeof value === 'string' ? value.toLowerCase() : value;"]]],
  ['M7 la búsqueda no baja a minúsculas', [[H, "return typeof value === 'string' ? value.trim().toLowerCase() : value;", "return typeof value === 'string' ? value.trim() : value;"]]],
  ['M8 la migración crea el índice aunque haya duplicados', [[M, 'if (groups.length) {', 'if (false) {']]],
  ['M9 la migración no es idempotente', [[M, 'CREATE UNIQUE INDEX IF NOT EXISTS', 'CREATE UNIQUE INDEX']]],
  ['M10 la migración no crea el índice nunca', [INDEX_OFF]],
  ['M11 el aviso de duplicados imprime ids sin agrupar y filtra correos', [[M, "`[${g.ids.join(',')}]`", '`${g.ids.join(\',\')} (correo ${g.ids.length})`'], [M, 'array_agg("id" ORDER BY "id") AS "ids"', 'array_agg("id" ORDER BY "id") AS "ids", min("email") AS "mail"'], [M, 'return rows.map((row) => ({ accounts: row.accounts, ids: row.ids }));', 'return rows.map((row) => ({ accounts: row.accounts, ids: row.ids, mail: row.mail }));'], [M, 'Ids por grupo:', 'Correo ${groups[0].mail} Ids por grupo:']]],
  ['M12 el down no exige permiso explícito', [[M, "require('../scripts/guard-down.cjs')('20261114010000-es306-email-lower-unique');", '']]],
  ['M14 la búsqueda de respaldo no recorta el valor guardado (solo lower)', [[H, "fn('lower', fn('btrim', col('email')))", "fn('lower', col('email'))"]]],
  ['M15 el índice único no cubre btrim (ni en la migración original ni en la reparación, que si no lo corregiría)', [[M, 'ON "Users" (lower(btrim("email")))', 'ON "Users" (lower("email"))'], [R, 'ON "Users" (lower(btrim("email")))', 'ON "Users" (lower("email"))']]],
  ['M16 las invitaciones no recortan el valor guardado', [['routes/invitations.js', "if (await User.findOne({ where: sqlWhere(fn('lower', fn('btrim', col('email'))), email) }))", "if (await User.findOne({ where: sqlWhere(fn('lower', col('email')), email) }))"]]],
  ['M13 los duplicados no cuentan el correo con espacios', [[M, 'GROUP BY lower(btrim("email"))', 'GROUP BY lower("email")']]],
  ["M25 E306-4 el reemplazo no es transaccional (si falla el CREATE queda sin índice único)", [[R, "return sequelize.transaction(async (transaction) => {", "return (async (transaction) => {"], [R, "return { action: 'replaced', groups: [] };\n  });", "return { action: 'replaced', groups: [] };\n  })();"]]],
  ['M17 E306-1 el catch del registro trata cualquier fallo como «ya registrado»', [[A, "if (error && error.name === 'SequelizeUniqueConstraintError')", 'if (error)']]],
  ['M18 E306-2 la búsqueda con duplicados antiguos elige la cuenta más NUEVA', [[H, "order: [['id', 'ASC']]", "order: [['id', 'DESC']]"]]],
  ['M19 E306-3 el bloqueo de correos inexistentes distingue mayúsculas', [[L, ".update(String(email ?? '').trim().toLowerCase())", ".update(String(email ?? '').trim())"]]],
  ['M20 E306-4 la reparación nunca reemplaza el índice viejo', [[R, 'if (groups.length) {', 'if (true) {']]],
  ['M21 E306-4 la reparación reemplaza el índice aunque haya duplicados', [[R, 'if (groups.length) {', 'if (false) {']]],
  ['M22 E306-4 la reparación vuelve a recrear un índice que ya es correcto (no idempotente)', [[R, 'if (/btrim/i.test(rows[0].indexdef))', 'if (false)']]],
  ['M23 E306-4 la reparación deja el índice nuevo sin btrim', [[R, 'CREATE UNIQUE INDEX "${INDEX}" ON "Users" (lower(btrim("email")))', 'CREATE UNIQUE INDEX "${INDEX}" ON "Users" (lower("email"))']]],
  ['M24 E306-4 el aviso de la reparación imprime ids sin agrupar y filtra correos', [[R, "Ids por grupo: ${groups.map((g) => `[${g.ids.join(',')}]`).join(' ')}", "Ids por grupo: ${groups.map((g) => g.ids.join(',')).join(' ')} correo ${groups[0].accounts}@"]]],
];
const only = process.argv[2]; const selected = MUTATIONS.filter(([name]) => !only || name.includes(only));
const originals = new Map(); const restore = () => { for (const [file, text] of originals) fs.writeFileSync(path.join(backend, file), text); originals.clear(); };
process.on('exit', restore); process.on('SIGINT', () => { restore(); process.exit(130); });
const run = () => spawnSync(process.execPath, ['--test', 'test/integration/es-306-postgres.cjs'], { cwd: backend, encoding: 'utf8', env: { ...process.env, ES306_TEST_DATABASE_URL: URL_ } });
let survived = 0;
for (const [name, edits] of selected) {
  let obsolete = false;
  for (const [file, before, after] of edits) {
    const full = path.join(backend, file); const text = fs.readFileSync(full, 'utf8'); const normal = text.replace(/\r\n/g, '\n');
    if (!normal.includes(before)) { console.log(`OBSOLETA   ${name}: el texto original ya no existe en ${file}`); obsolete = true; break; }
    if (!originals.has(file)) originals.set(file, text);
    fs.writeFileSync(full, normal.split(before).join(after).replace(/\n/g, text.includes('\r\n') ? '\r\n' : '\n'));
  }
  if (obsolete) { restore(); survived++; continue; }
  const result = run(); restore();
  const failing = (result.stdout.match(/^\s*not ok \d+ - .{0,70}/gm) || []).filter((line) => !line.startsWith('not ok 1 ')).map((line) => line.trim().slice(0, 60));
  if (result.status === 0) { console.log(`SOBREVIVE  ${name}`); survived++; } else console.log(`DETECTADA  ${name}  → ${failing[0] || 'falla de arranque/otra'}`);
}
console.log(`\n${selected.length - survived}/${selected.length} mutaciones detectadas`);
process.exit(survived ? 1 : 0);
