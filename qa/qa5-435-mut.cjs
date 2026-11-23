// [QA-Claude-5] #435: mutaciones propias sobre listShares (copia de trabajo de QA; se restaura con git). Corre la prueba NUEVA (es-303-postgres de la PR) y la ANTERIOR (main) contra cada mutante.
// Uso: ES303_TEST_DATABASE_URL=postgres://...@127.0.0.1:PUERTO/postgres node qa/qa5-435-mut.cjs   (cwd: backend/ del worktree de la PR; es-303-old.cjs = archivo de main)
const fs = require('fs'); const cp = require('child_process'); const F = 'utils/reviews.js'; const orig = fs.readFileSync(F, 'utf8')
const A = "reviewerName: names.get(row.reviewerId) ?? null"
const M = {
  m1_nombre_de_otro_revisor: [[A, "reviewerName: [...names.values()][0] ?? null"]],
  m2_sin_filtro_de_dueno: [["where: { UserId: userId }, order: [['id', 'DESC']], limit: 200 });\n  const ids", "where: {}, order: [['id', 'DESC']], limit: 200 });\n  const ids"]],
  m3_nombre_del_dueno: [[A, "reviewerName: names.get(row.UserId) ?? names.get(row.reviewerId) ?? null"]],
  m4_nombre_congelado: [["return rows.map((row) => ({ ...shareView(row), reviewerName: names.get(row.reviewerId) ?? null }));", "globalThis.__c = globalThis.__c || new Map(); for (const [k, v] of names) if (!globalThis.__c.has(k)) globalThis.__c.set(k, v); return rows.map((row) => ({ ...shareView(row), reviewerName: globalThis.__c.get(row.reviewerId) ?? null }));"]],
  m5_nombre_sin_recortar_vacio: [["typeof person.name === 'string' && person.name.trim() ? person.name : null", "person.name"]],
  m6_ids_ajenos_en_la_vista: [["attributes: ['id', 'name'] }) : [];", "attributes: ['id', 'name', 'email'] }) : [];"], ["return rows.map((row) => ({ ...shareView(row), reviewerName", "return rows.map((row) => ({ ...shareView(row), reviewerEmail: (people.find((p) => p.id === row.reviewerId) || {}).email, reviewerName"]],
}
const run = (file) => { const r = cp.spawnSync(process.execPath, ['--test', file], { encoding: 'utf8', env: process.env }); const out = r.stdout + r.stderr; const pass = (out.match(/^# pass (\d+)/m) || [])[1]; const fail = (out.match(/^# fail (\d+)/m) || [])[1]; const names = [...out.matchAll(/^\s+not ok \d+ - (.{0,70})/gm)].map((m) => m[1]); return { pass, fail, names } }
const only = process.env.ONLY ? process.env.ONLY.split(',') : null
try {
  for (const [id, reps] of Object.entries(M)) { if (only && !only.includes(id)) continue
    let s = orig; let ok = true; for (const [a, b] of reps) { if (!s.includes(a)) { ok = false; break } s = s.split(a).join(b) }
    if (!ok) { console.log(id + ': NO APLICA'); continue }
    fs.writeFileSync(F, s); const nuevo = run('test/integration/es-303-postgres.cjs'); const viejo = run('test/integration/es-303-old.cjs'); fs.writeFileSync(F, orig)
    console.log(`${id}: PRUEBA NUEVA fallos=${nuevo.fail} ${JSON.stringify(nuevo.names)} | PRUEBA ANTERIOR (main) fallos=${viejo.fail} ${JSON.stringify(viejo.names)}`) }
} finally { fs.writeFileSync(F, orig) }
