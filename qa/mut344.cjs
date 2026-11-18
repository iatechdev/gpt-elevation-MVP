// QA-Claude-2 — PR #338 (ES-344) mutaciones sobre el clon: node qa/mut344.cjs <clon>/backend  (requiere QA_PG). Primero la prueba del PR; si sobrevive, mi prueba de carrera (qa/e344-carrera.cjs).
const fs = require('fs'), path = require('path'), { execSync } = require('child_process'); const BE = process.argv[2], P = f => path.join(BE, f), here = __dirname
const run = (cmd, env) => { try { execSync(cmd, { cwd: BE, stdio: 'pipe', timeout: 600000, shell: true, maxBuffer: 1e8, env: { ...process.env, ...env } }); return false } catch (e) { return true } }
const files = ['promptVault.js', 'migrations/20261118010000-es344-prompt-isactive-consistency.cjs']; const orig = Object.fromEntries(files.map(f => [f, fs.readFileSync(P(f), 'utf8')])); const restore = () => files.forEach(f => fs.writeFileSync(P(f), orig[f]))
const M = (name, file, a, b) => { restore(); let s = fs.readFileSync(P(file), 'utf8'); const pairs = Array.isArray(a) ? a : [[a, b]]; for (const [x, y] of pairs) { if (!s.includes(x)) { console.log(`M ${name}: SIN ANCLA`); return } s = s.replace(x, () => y) } fs.writeFileSync(P(file), s)
  let r = run('node --test test/integration/es-344-postgres.cjs', { ES344_TEST_DATABASE_URL: process.env.QA_PG + '/postgres' }), how = 'por la prueba del PR'
  if (!r) { r = run(`node ${path.join(here, 'e344-carrera.cjs')}`, { BACKEND: BE, ROUNDS: '150' }); how = 'solo por mi prueba de carrera' }
  console.log(`M ${name}: ${r ? 'DETECTADO ' + how : 'SOBREVIVE'}`); restore() }
const V = 'promptVault.js', MG = 'migrations/20261118010000-es344-prompt-isactive-consistency.cjs'
M('a rejectPrompt sin el bloqueo de la clave (lee y escribe sin transacción)', V, [
  ["withKeyLockTx(versionId, async (proposed, transaction) => {\n  if (proposed.status !== 'pending_review') throw new PromptReviewError('not_pending');\n  await proposed.update({\n    status: 'rejected',",
   "(async (id) => { const proposed = await PromptVault.findByPk(id); if (!proposed) throw new PromptReviewError('not_found'); const transaction = undefined;\n  if (proposed.status !== 'pending_review') throw new PromptReviewError('not_pending');\n  await proposed.update({\n    status: 'rejected',"],
  ["  }, { transaction });\n});\n\n// ============================================\n// 🔁 ROLLBACK", "  }, { transaction });\n})(versionId);\n\n// ============================================\n// 🔁 ROLLBACK"]])
M('b rechazar ya no pone isActive=false', V, "    status: 'rejected',\n    isActive: false,\n    rejected_by: superAdminEmail,", "    status: 'rejected',\n    rejected_by: superAdminEmail,")
M('c se restaura el respaldo por isActive en getActivePrompt', V, "  const record = await PromptVault.findOne({ where: { key: promptKey, status: 'active' } });", "  let record = await PromptVault.findOne({ where: { key: promptKey, status: 'active' } });\n  if (!record) record = await PromptVault.findOne({ where: { key: promptKey, isActive: true }, order: [['version', 'DESC']] });")
M('d el bloqueo de la clave ya no toma las filas (sin FOR UPDATE)', V, "lock: transaction.LOCK.UPDATE, transaction", "transaction")
M('e aprobar ya no archiva la activa anterior con isActive=false', V, "    { status: 'approved', isActive: false },\n    { where: { key: proposed.key, status: 'active' }, transaction }", "    { status: 'approved' },\n    { where: { key: proposed.key, status: 'active' }, transaction }")
M('f la migración no corrige nada', MG, 'SET "isActive" = false WHERE ${WHERE}', 'SET "isActive" = false WHERE false')
M('g la migración ignora status NULL (<> en vez de IS DISTINCT FROM)', MG, `"status" IS DISTINCT FROM 'active'`, `"status" <> 'active'`)
M('h la migración también apaga la versión activa', MG, `const WHERE = \`"status" IS DISTINCT FROM 'active' AND "isActive" IS TRUE\``, 'const WHERE = `"isActive" IS TRUE`')
restore(); console.log('clon restaurado')
