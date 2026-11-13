// [QA-Claude] Mutaciones ES-296 — cabeza 37d6e255 (PR #257). Árbol: C:/Users/Usuario/Documents/qa-pr-253
const fs = require('fs'); const B = 'C:/Users/Usuario/Documents/qa-pr-253/backend/utils/'; const m = process.argv[2];
const file = (n) => fs.readFileSync(B + n, 'utf8'); const save = (n, s) => fs.writeFileSync(B + n, s);
const edit = (n, a, b) => { const s = file(n); if (s.split(a).length !== 2) throw new Error('no único/no encontrado ' + m + ': ' + a.slice(0, 70)); save(n, s.replace(a, () => b)); };
const EV = 'evidence.js', CO = 'consent.js';
const HOOK = "      if (status === 'revoked' && String(purpose).startsWith('insights_')) await require('./evidence').markSourceRevoked(userId, purpose, transaction);\n";
if (m === 'N1') edit(CO, HOOK, ''); // sin gancho
if (m === 'N2') edit(EV, ' && !sourceRevoked(row));', ');'); // el motor no filtra
if (m === 'N3') edit(EV, "    if (!origins.some((o) => o && o.type === 'chat_turn' && !o.sourceRevokedAt)) continue; // idempotente\n", ''); // no idempotente
if (m === 'N4') edit(EV, "if (purpose !== 'insights_chat') return 0;", "if (!String(purpose).startsWith('insights_')) return 0;"); // cualquier insights_* marca
if (m === 'N5') edit(EV, "status: 'confirmed', hasChatOrigin: true }, transaction, lock: Transaction.LOCK.UPDATE });\n  const at", "status: 'confirmed', hasChatOrigin: true }, transaction });\n  const at"); // sin bloqueo de versiones
const inFn = (a, b) => { const s = file(EV); const i = s.indexOf('async function markSourceRevoked'); const j = s.indexOf('const sourceRevoked =', i); const body = s.slice(i, j); if (body.split(a).length !== 2) throw new Error('no único en markSourceRevoked ' + m + ': ' + a.slice(0, 60)); save(EV, s.slice(0, i) + body.replace(a, () => b) + s.slice(j)); };
if (m === 'N6') inFn("if (!ev || ev.currentVersion !== row.version) continue;", 'if (!ev) continue;'); // marca también versiones antiguas
if (m === 'N7') edit(EV, "    await DerivedInvalidation.create({ UserId: userId, sourceType: 'evidence', sourceId: ev.id, reason: 'source_revoked' }, { transaction });\n", ''); // sin invalidación de lo derivado
if (m === 'N8') edit(EV, "  if (sourceRevoked(row)) { out.needsReview = true; out.reviewReason = 'source_revoked'; }", "  if (sourceRevoked(row)) { out.needsReview = true; out.reviewReason = 'source_revoked'; out.sourceRevokedAt = (row.origins.find((o) => o.sourceRevokedAt) || {}).sourceRevokedAt; }"); // fuga del campo interno
if (m === 'N9') edit(EV, "await row.update({ origins: origins.map((o) => (o && o.type === 'chat_turn' && !o.sourceRevokedAt ? { ...o, sourceRevokedAt: at } : o)) }, { transaction });", "await row.update({ origins: origins.map((o) => (o && o.type === 'chat_turn' && !o.sourceRevokedAt ? { ...o, sourceRevokedAt: at } : o)) });"); // marca fuera de la transacción
if (m === 'N10') inFn("where: { id: row.EvidenceId, UserId: userId, deletedAt: null }", "where: { id: row.EvidenceId, deletedAt: null }"); // sin filtrar por dueño
if (m === 'N11') inFn("where: { UserId: userId, status: 'confirmed', hasChatOrigin: true }", "where: { status: 'confirmed', hasChatOrigin: true }"); // sin filtrar por persona en la búsqueda (marca a todas)
if (m === 'N12') edit(EV, "const sourceRevoked = (row) => (Array.isArray(row.origins) ? row.origins : []).some((o) => o && o.sourceRevokedAt);", "const sourceRevoked = (row) => false;"); // lectura ignora la marca
if (m === 'N13') { inFn("where: { id: row.EvidenceId, UserId: userId, deletedAt: null }", "where: { id: row.EvidenceId, deletedAt: null }"); inFn("where: { UserId: userId, status: 'confirmed', hasChatOrigin: true }", "where: { status: 'confirmed', hasChatOrigin: true }"); }
console.log('M apl ' + m);
