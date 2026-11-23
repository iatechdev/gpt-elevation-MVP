// Mutaciones de #385 sobre tools/qa5/m385/backend/migrations/20261118020000-es288-requestid-unico.cjs. Uso: node qa5-mut385.cjs N1..N7
const fs = require('fs'); const F = (process.env.QA_TOOLS || '.') + '/qa5/m385/backend/migrations/20261118020000-es288-requestid-unico.cjs'
const muts = {
  N1: s => s.replace("      await sequelize.query(`LOCK TABLE \"${target.table}\" IN SHARE ROW EXCLUSIVE MODE`, { transaction });\n", ""),
  N2: s => s.replace("left(\"requestId\", 50) || '~dup' || \"id\"", "left(\"requestId\", 50) || '~dup'"),                       // marca no única
  N3: s => s.replace("ORDER BY \"id\") AS \"n\"", "ORDER BY \"id\" DESC) AS \"n\""),                                                         // conserva la MÁS NUEVA
  N4: s => s.replace("if (duplicates.length) {", "if (false) {"),                                                                            // sin resolver duplicados
  N5: s => s.replace("where: `\"requestId\" IS NOT NULL AND \"status\" = 'completed'` }", "where: `\"requestId\" IS NOT NULL` }"),         // índice sin status (también en la detección)
  N6: s => s.replace("`UPDATE \"${target.table}\" SET \"requestId\" = left(\"requestId\", 50) || '~dup' || \"id\" WHERE \"id\" IN (:ids)`", "`DELETE FROM \"${target.table}\" WHERE \"id\" IN (:ids)`"),   // borra duplicados
  N7: s => s.replace("left(\"requestId\", 50)", "left(\"requestId\", 60)"),                                                                // no cabe en 64
}
const f = muts[process.argv[2]]; const a = fs.readFileSync(F, 'utf8').split('\r\n').join('\n'); const b = f(a); if (a === b) { console.log(process.argv[2], 'NO APLICA'); process.exit(3) } fs.writeFileSync(F, b)
