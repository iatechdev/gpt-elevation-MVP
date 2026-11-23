// [QA-Claude-5] #452 (ES-383): mutaciones propias del CÓDIGO de la aplicación (copia de trabajo de QA en tools/qa5/main, restaurada con git). Cada una se ejecuta en modo normal (corrección) y, si escapa, en PERF_STRICT=1.
// Uso: ONLY=<id> PW=... node qa/qa5-452-mut.cjs
const fs = require('fs'); const cp = require('child_process'); const B = (process.env.QA_TOOLS || '.') + '/qa5/main/backend'
const PW = fs.readFileSync((process.env.QA_TOOLS || '.') + '/qa5/pw.txt', 'utf8').trim(); const U = `postgres://qa5:${PW}@127.0.0.1:54361/postgres`
const env = (strict) => ({ ...process.env, PATH: (process.env.QA_TOOLS || '.') + '/node22;' + process.env.PATH, ES29_TEST_DATABASE_URL: U, ES282_TEST_DATABASE_URL: U, ES85_TEST_DATABASE_URL: U, NODE_PATH: (process.env.QA_TOOLS || '.') + '/qa5/stubs/node_modules', ...(strict ? { PERF_STRICT: '1' } : {}) })
const run = (file, strict) => { const r = cp.spawnSync(process.execPath, ['--test', file], { cwd: B, encoding: 'utf8', env: env(strict), timeout: 420000 }); const out = (r.stdout || '') + (r.stderr || ''); return { failed: r.status !== 0, why: (/error: \|?-?\s*\n?\s*(.*)/.exec(out) || [])[1] || (out.match(/not ok \d+ - .{0,100}/) || [''])[0], lento: (out.match(/PERF LENTO[^\n]{0,120}/) || [''])[0] } }
const M = [
  ['1_sin_tope_de_nodos', 'utils/aiClient.js', "if ((nodes += 1) > MAX_CONTENT_NODES) throw new AiInputRejectedError('too_many_nodes');", "if ((nodes += 1) > 1e12) throw new AiInputRejectedError('too_many_nodes');", 'test/es-384-barrera-seguimiento.test.cjs'],
  ['2a_memoria_nunca_se_guarda', 'utils/safety.js', 'memo.set(key, { level: result.level, lang: result.lang });', '', 'test/es-304-detector-normalization.test.cjs'],
  ['2b_memoria_nunca_se_consulta', 'utils/safety.js', 'if (cached) return { level: cached.level, lang: cached.lang };', '', 'test/es-304-detector-normalization.test.cjs'],
  ['3_altas_de_la_misma_persona_en_paralelo', 'utils/skillMap.js', 'const run = previous.then(fn, fn);', 'const run = Promise.resolve().then(fn);', 'test/integration/es-29-postgres.cjs'],
  ['4_login_inexistente_sin_bcrypt', 'routes/auth.js', 'const validPassword = await bcrypt.compare(password, user ? user.password : DECOY_HASH);', 'const validPassword = user ? await bcrypt.compare(password, user.password) : false;', 'test/integration/es-282-postgres.cjs'],
  ['5_hash_senuelo_de_otro_costo', 'routes/auth.js', "bcrypt.hashSync('es220-señuelo-que-nunca-coincide', 10)", "bcrypt.hashSync('es220-señuelo-que-nunca-coincide', 4)", 'test/integration/es-282-postgres.cjs'],
  ['6_login_existente_mas_lento_con_el_mismo_bcrypt', 'routes/auth.js', 'const validPassword = await bcrypt.compare(password, user ? user.password : DECOY_HASH);', 'if (user) await new Promise((r) => setTimeout(r, 900)); const validPassword = await bcrypt.compare(password, user ? user.password : DECOY_HASH);', 'test/integration/es-282-postgres.cjs'],
]
for (const [id, rel, a, b, test] of M) { if (process.env.ONLY && !id.startsWith(process.env.ONLY)) continue; const f = B + '/' + rel; const orig = fs.readFileSync(f, 'utf8'); if (!orig.includes(a)) { console.log(id + ': NO APLICA'); continue }
  fs.writeFileSync(f, orig.split(a).join(b)); let n, s
  try { n = run(test, false); if (!n.failed) s = run(test, true) } finally { fs.writeFileSync(f, orig); cp.spawnSync('git', ['checkout', '--', rel], { cwd: B }) }
  console.log(`${id}: modo normal ${n.failed ? 'DETECTADA' : 'ESCAPÓ'}${n.failed ? ' · ' + n.why.slice(0, 140) : ''}${s ? ` | PERF_STRICT=1 ${s.failed ? 'DETECTADA' : 'ESCAPÓ'}${s.failed ? ' · ' + (s.lento || s.why).slice(0, 140) : ''}` : ''}`) }
