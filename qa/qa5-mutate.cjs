// Aplica UNA mutación a la copia tools/qa5/mut (nunca al código del PR en sí). Uso: node qa5-mutate.cjs M1..M7
const fs = require('fs');
const M = (process.env.QA_TOOLS || '.') + '/qa5/mut/backend/utils/';
const R = M + 'resumes.js'; const S = M + 'skillMap.js'; const L = M + 'resumeSkills.js';
const muts = {
  M1: [R, (s) => s.replace("  await markDraftsForReview(userId, id, transaction);\n", '')],
  M2: [R, (s) => s.replace('    await markDraftsForReview(userId, row.id, transaction);\n', '')],
  M3: [S, (s) => s.replace("sourceType: ['evidence', 'resume']", "sourceType: ['evidence']")],
  M4: [R, (s) => s.replace("if (!row || row.status !== 'draft') continue;", 'if (!row) continue;')],
  M5: [R, (s) => s.replace(/o\.type === 'resume' && o\.id === resumeId && !o\.sourceRevokedAt/g, '!o.sourceRevokedAt')],
  M6: [R, (s) => s.replace(' && !o.sourceRevokedAt)) continue; // idempotente', ')) continue; // idempotente').replace("(o && o.type === 'resume' && o.id === resumeId && !o.sourceRevokedAt ?", "(o && o.type === 'resume' && o.id === resumeId ?")],
  M8: [R, (s) => s.replace("order: [['id', 'ASC']], transaction, lock: transaction ? Transaction.LOCK.UPDATE : undefined });", "order: [['id', 'ASC']], transaction });")],
  M9: [M + 'evidence.js', (s) => s.replace("if (resume && out.origin.needsReview && row.status === 'draft' && existingResumes)", "if (false)")],
  M7: [L, (s) => s.replace('if (skill.resumeVersion === null || alive.has(skill.resumeVersion)) continue;', 'if (skill.resumeVersion === null) continue;')],
};
const [file, fn] = muts[process.argv[2]];
const a = fs.readFileSync(file, 'utf8'); const b = fn(a);
if (a === b) { console.log(process.argv[2], 'NO APLICA'); process.exit(3); }
fs.writeFileSync(file, b);
