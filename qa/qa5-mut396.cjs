// Mutaciones de seguridad de #396 sobre tools/qa5/m396/backend/utils. Uso: node qa5-mut396.cjs Q1..Q10
const fs = require('fs'); const U = (process.env.QA_TOOLS || '.') + '/qa5/m396/backend/utils/'; const I = U + 'reviewInvites.js', R = U + 'reviews.js'
const muts = {
  Q1: [I, s => s.replace("findActive(userId, rawCode, reviewerOf, { transaction, lock: true })", "findActive(userId, rawCode, reviewerOf, { transaction, lock: false })")],            // sin bloqueo FOR UPDATE: canje doble posible
  Q2: [I, s => s.replace("if (!row || statusOf(row) !== 'active' || row.reviewerId === userId) throw inviteNotFound();", "if (!row || row.reviewerId === userId) throw inviteNotFound();")],         // acepta usados/vencidos/anulados
  Q3: [I, s => s.replace("|| row.reviewerId === userId) throw inviteNotFound();", ") throw inviteNotFound();")],                                                              // un revisor puede canjear su propio código
  Q4: [I, s => s.replace("tokenHash: hashCode(raw), requestId", "tokenHash: raw, requestId")],                                                                                   // guarda el código en claro
  Q5: [I, s => s.replace("takeUserAttempt(userId); takeIpAttempt(ip); // ANTES de buscar: el mismo tope para cualquier código", "")],                                                // lookup sin topes
  Q6: [I, s => s.replace("const reviewer = await reviewerOf(row.reviewerId, transaction);", "const reviewer = await reviewerOf(row.reviewerId);")],                              // sin la conexión de la transacción
  Q7: [I, s => s.replace("if (!reviewer) throw inviteNotFound();\n  return { row, reviewer };", "return { row, reviewer: reviewer || { id: row.reviewerId, name: 'x' } };")],               // no exige revisor activo
  Q8: [R, s => s.replace("if (body && typeof body === 'object' && !Array.isArray(body) && Object.prototype.hasOwnProperty.call(body, 'reviewerId')) throw USE_INVITE();", "")],      // reabre reviewerId
  Q9: [I, s => s.replace("return { reviewer: { name: reviewer.name }, expiresAt: row.expiresAt };", "return { reviewer: { name: reviewer.name, id: reviewer.id }, expiresAt: row.expiresAt };")], // lookup filtra id del revisor
  Q10: [I, s => s.replace("await row.update({ usedAt: new Date(clock()), usedByUserId: userId }, { transaction });", "await row.update({ usedByUserId: userId }, { transaction });")],              // no marca usado
  Q11: [I, s => s.replace("const inviteView = (row) => ({ id: row.id, status: statusOf(row), createdAt: row.createdAt, expiresAt: row.expiresAt, usedAt: row.usedAt, revokedAt: row.revokedAt });", "const inviteView = (row) => ({ id: row.id, status: statusOf(row), createdAt: row.createdAt, expiresAt: row.expiresAt, usedAt: row.usedAt, revokedAt: row.revokedAt, usedByUserId: row.usedByUserId });")],
}
const [f, fn] = muts[process.argv[2]]; const a = fs.readFileSync(f, 'utf8').split('\r\n').join('\n'); const b = fn(a); if (a === b) { console.log(process.argv[2], 'NO APLICA'); process.exit(3) } fs.writeFileSync(f, b)
