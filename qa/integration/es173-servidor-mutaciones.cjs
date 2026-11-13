// [QA-Claude] Mutaciones ES-173 servidor (PR #273, cabeza 379dc901). Árbol: C:/Users/Usuario/Documents/qa-pr-253
const fs = require('fs'); const F = 'C:/Users/Usuario/Documents/qa-pr-253/backend/utils/pilotFeedback.js'; const R = 'C:/Users/Usuario/Documents/qa-pr-253/backend/routes/pilotFeedback.js'; const m = process.argv[2];
const edit = (file, a, b) => { const s = fs.readFileSync(file, 'utf8'); if (s.split(a).length !== 2) throw new Error('no único/no encontrado ' + m + ': ' + a.slice(0, 80)); fs.writeFileSync(file, s.replace(a, () => b)); };
if (m === 'T1') edit(F, "return await consent.withConsent(userId, PURPOSE, async (transaction) => {", "return await (async (fn) => sequelize.transaction(fn))(async (transaction) => {"); // guardar sin comprobar el permiso
if (m === 'T2') edit(F, "const row = await PilotFeedback.findOne({ where: { UserId: userId, windowKey }, transaction, lock: transaction.LOCK.UPDATE });\n        if (row && row.lastRequestId", "const row = await PilotFeedback.findOne({ where: { UserId: userId, windowKey }, transaction });\n        if (row && row.lastRequestId"); // sin bloqueo de fila al guardar
if (m === 'T3') edit(F, "if (body.baseVersion !== current) throw", "if (false) throw"); // sin control de versión
if (m === 'T4') edit(F, "if (!hasExactKeys(value, ANSWER_KEYS)) throw invalid('invalid_answers');", "if (!isPlain(value)) throw invalid('invalid_answers');"); // acepta claves de más o de menos
if (m === 'T5') edit(F, "if (valueArea !== null && initialValue !== 'yes') throw invalid('invalid_answers');", ""); // valueArea sin initialValue=yes
if (m === 'T6') edit(F, "answers: {}, status: 'withdrawn'", "answers: row.answers, status: 'withdrawn'"); // retirar NO borra el contenido
if (m === 'T7') edit(F, "status: 'withdrawn', version: row.version + 1, lastRequestId: null }", "status: 'withdrawn', version: row.version + 1 }"); // retirar conserva el requestId
if (m === 'T8') edit(F, "const MIN_PEOPLE = 5;", "const MIN_PEOPLE = 4;"); // umbral de 4
if (m === 'T9') edit(F, "metrics.push(eligible >= MIN_PEOPLE && responded >= MIN_PEOPLE", "metrics.push(eligible >= MIN_PEOPLE"); // publica con menos de 5 respuestas
if (m === 'T10') edit(F, "AND u.role = 'user' AND u.active = true AND NOT EXISTS", "AND u.active = true AND NOT EXISTS"); // los no-persona cuentan
if (m === 'T11') edit(F, "AND c.status = 'granted' AND c.version >= :required", "AND c.version >= :required"); // el permiso revocado sigue contando
if (m === 'T12') edit(F, "AND ${def.alias}.status = 'active'", "AND ${def.alias}.status IN ('active','withdrawn')"); // las retiradas cuentan en los agregados
if (m === 'T13') edit(F, "if (row && row.lastRequestId === body.requestId) {", "if (false) {"); // sin idempotencia
if (m === 'T14') edit(F, "if (error instanceof UniqueConstraintError && attempt === 1) continue;", ""); // sin reintento ante la primera respuesta simultánea
if (m === 'T15') edit(F, "const WINDOWS = Object.freeze(['day7', 'day30']);", "const WINDOWS = Object.freeze(['day7', 'day30', 'day60']);"); // ventana de más
if (m === 'T16') edit(F, "AND NOT EXISTS (SELECT 1 FROM \"DeletionRequests\" d WHERE d.\"UserId\" = u.id)`,\n  { type: 'SELECT'", "`,\n  { type: 'SELECT'"); // la eliminación pendiente cuenta
if (m === 'T17') edit(R, "admin.get('/', handle(", "admin.get('/', (req, res, next) => next(), handle("); // (control: sin efecto)
if (m === 'T18') edit(F, "{ type: 'SELECT', replacements: { purpose: PURPOSE, required: consent.REQUIRED_VERSION[PURPOSE] } });\n  const eligible = Number(row.eligible);", "{ type: 'SELECT', replacements: { purpose: PURPOSE, required: consent.REQUIRED_VERSION[PURPOSE] } });\n  const eligible = Number(row.eligible) + (await sequelize.query('SELECT 0 AS n', { type: 'SELECT' })).length * 0;"); // (control: sin efecto)
if (m === 'T19') edit(F, "missing: eligible - responded", "missing: Math.max(0, eligible - responded) + 0"); // (control: equivalente)
if (m === 'T20') edit(F, "answers: active ? sameShape(row.answers) : null,", "answers: row ? sameShape(row.answers) : null,"); // devuelve answers aun retirada (con {}: rompe sameShape)
console.log('M apl ' + m);
