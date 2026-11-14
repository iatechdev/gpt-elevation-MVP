// [QA-Claude] Mutaciones ES-306 (PR #278). Árbol: C:/Users/Usuario/Documents/qa-pr-253
const fs = require('fs'); const B = 'C:/Users/Usuario/Documents/qa-pr-253/backend/'; const m = process.argv[2];
const edit = (file, a, b) => { const p = B + file; const s = fs.readFileSync(p, 'utf8'); if (s.split(a).length !== 2) throw new Error('no único/no encontrado ' + m + ': ' + a.slice(0, 80)); fs.writeFileSync(p, s.replace(a, () => b)); };
const H = 'utils/emailNormalize.js'; const A = 'routes/auth.js'; const P = 'routes/passwordReset.js'; const M = 'migrations/20261114010000-es306-email-lower-unique.cjs';
const IDX = 'CREATE UNIQUE INDEX IF NOT EXISTS "${INDEX}" ON "Users" (lower(btrim("email")))';
if (m === 'Z1') edit(A, 'email: normalizeEmail(email), password', 'email, password'); // no guarda normalizado
if (m === 'Z2') { edit(A, 'const existing = await findUserByEmail(User, email);', 'const existing = await User.findOne({ where: { email } });'); edit(M, IDX, 'SELECT 1'); } // registro exacto y sin índice de red
if (m === 'Z3') edit(A, 'const user = await findUserByEmail(User, email); // ES-306: sin importar mayúsculas', 'const user = await User.findOne({ where: { email } });'); // login exacto
if (m === 'Z4') edit(P, 'const user = await findUserByEmail(User, email); // ES-306: sin importar mayúsculas', 'const user = await User.findOne({ where: { email } });'); // recuperación exacta
if (m === 'Z5') edit(H, "return User.findOne({ ...options, where: sqlWhere(fn('lower', fn('btrim', col('email'))), normalized), order: [['id', 'ASC']] });", 'return null;'); // sin respaldo lower
if (m === 'Z6') edit(H, 'where: { email: rawEmail.trim() }', 'where: { email: rawEmail }'); // exacto sin recortar (la normalización sigue)
if (m === 'Z7') edit(H, "return typeof value === 'string' ? value.trim().toLowerCase() : value;", "return typeof value === 'string' ? value.trim() : value;"); // no minusculiza
if (m === 'Z8') edit(M, 'if (groups.length) {', 'if (false) {'); // índice aun con duplicados
if (m === 'Z9') edit(M, 'CREATE UNIQUE INDEX IF NOT EXISTS', 'CREATE UNIQUE INDEX'); // no idempotente
if (m === 'Z10') edit(M, "      return { created: false, groups };", "      await sequelize.query(`DELETE FROM \"Users\" WHERE id IN (SELECT unnest((array_agg(id ORDER BY id))[2:]) FROM \"Users\" GROUP BY lower(btrim(email)) HAVING count(*) > 1)`, { transaction });\n      return { created: false, groups };"); // borra duplicados
if (m === 'Z11') { edit(M, 'array_agg("id" ORDER BY "id") AS "ids"', 'array_agg("id" ORDER BY "id") AS "ids", min("email") AS "mail"'); edit(M, 'return rows.map((row) => ({ accounts: row.accounts, ids: row.ids }));', 'return rows.map((row) => ({ accounts: row.accounts, ids: row.ids, mail: row.mail }));'); edit('scripts/es306-email-duplicates.cjs', 'ids=${group.ids.join(\',\')}`', 'ids=${group.ids.join(\',\')} ${group.mail}`'); } // el informe imprime correos
if (m === 'Z12') edit(M, "require('../scripts/guard-down.cjs')('20261114010000-es306-email-lower-unique');", ''); // down sin guarda
if (m === 'Z13') edit(H, "return User.findOne({ ...options, where: sqlWhere(fn('lower', fn('btrim', col('email'))), normalized), order: [['id', 'ASC']] });", "return User.findOrCreate({ where: sqlWhere(fn('lower', fn('btrim', col('email'))), normalized), defaults: { name: 'x', email: normalized, password: 'x', role: 'user' } }).then((r) => r[0]);"); // el helper crea
if (m === 'Z14') edit(H, "where: sqlWhere(fn('lower', fn('btrim', col('email'))), normalized)", "where: { email: { [require('sequelize').Op.iLike]: normalized } }"); // ILIKE con comodines
if (m === 'Z15') edit(H, "order: [['id', 'ASC']]", "order: [['id', 'DESC']]"); // elige la más nueva
if (m === 'Z16') edit(A, "if (error && error.name === 'SequelizeUniqueConstraintError') return", 'if (error) return'); // catch ancho
if (m === 'Z17') edit('utils/loginAttempts.js', ".trim().toLowerCase())", ".trim())"); // clave del bloqueo sin lower
if (m === 'Z18') edit(M, 'GROUP BY lower(btrim("email"))', 'GROUP BY "email"'); // grupos por texto exacto
if (m === 'Z19') edit('scripts/es306-email-duplicates.cjs', "process.exitCode = 2;", "process.exitCode = 0;"); // informe siempre 0
if (m === 'Z20') edit(A, 'const existing = await findUserByEmail(User, email);', 'const existing = await findUserByEmail(User, req.body.email.toUpperCase());'); // busca otro texto (control: equivalente por lower)
if (m === 'Z21') edit(H, "where: sqlWhere(fn('lower', fn('btrim', col('email'))), normalized)", "where: sqlWhere(fn('lower', col('email')), normalized)"); // respaldo sin btrim (el P1 original)
if (m === 'Z22') edit('routes/invitations.js', "if (await User.findOne({ where: sqlWhere(fn('lower', fn('btrim', col('email'))), email) })) {", "if (await User.findOne({ where: sqlWhere(fn('lower', col('email')), email) })) {"); // invitar: sin btrim
if (m === 'Z23') edit('routes/invitations.js', "if (await User.findOne({ where: sqlWhere(fn('lower', fn('btrim', col('email'))), row.email) })) return", "if (await User.findOne({ where: sqlWhere(fn('lower', col('email')), row.email) })) return"); // aceptar: sin btrim
if (m === 'Z24') edit(M, 'ON "Users" (lower(btrim("email")))', 'ON "Users" (lower("email"))'); // índice sin btrim
console.log('M apl ' + m);
