// [QA-Claude-5] #452: muestra bajo carga. 4 quemadores de CPU propios (se matan por PID al terminar); N iteraciones de las suites de la PR en modo normal y en PERF_STRICT=1.
// Uso: N=5 node qa/qa5-452-carga.cjs
const fs = require('fs'); const cp = require('child_process'); const B = (process.env.QA_TOOLS || '.') + '/qa5/main/backend'
const PW = fs.readFileSync((process.env.QA_TOOLS || '.') + '/qa5/pw.txt', 'utf8').trim(); const U = `postgres://qa5:${PW}@127.0.0.1:54361/postgres`
const env = (strict) => ({ ...process.env, PATH: (process.env.QA_TOOLS || '.') + '/node22;' + process.env.PATH, ES29_TEST_DATABASE_URL: U, ES282_TEST_DATABASE_URL: U, ES85_TEST_DATABASE_URL: U, NODE_PATH: (process.env.QA_TOOLS || '.') + '/qa5/stubs/node_modules', ...(strict ? { PERF_STRICT: '1' } : {}) })
const burners = Array.from({ length: 4 }, () => cp.spawn(process.execPath, ['-e', 'for(;;){Math.sqrt(Math.random())}'], { stdio: 'ignore' }))
console.log('quemadores PID', burners.map((b) => b.pid).join(','))
const files = ['test/es-384-barrera-seguimiento.test.cjs', 'test/es-304-detector-normalization.test.cjs', 'test/integration/es-29-postgres.cjs', 'test/integration/es-282-postgres.cjs', 'test/integration/es-85-postgres.cjs']
const N = Number(process.env.N || 5); let fails = { normal: 0, strict: 0 }
try { for (let i = 1; i <= N; i++) for (const strict of [false, true]) { const r = cp.spawnSync(process.execPath, ['--test', '--test-concurrency=1', ...files], { cwd: B, encoding: 'utf8', env: env(strict), timeout: 900000 }); const out = r.stdout + r.stderr; const t = /# tests (\d+)/.exec(out), p = /# pass (\d+)/.exec(out), f = /# fail (\d+)/.exec(out)
    if (r.status !== 0) fails[strict ? 'strict' : 'normal']++
    console.log(`iteración ${i} ${strict ? 'PERF_STRICT=1' : 'normal       '}: tests ${t && t[1]} pass ${p && p[1]} fail ${f && f[1]}${r.status !== 0 ? ' · ' + ((out.match(/PERF LENTO[^\n]{0,140}/) || out.match(/not ok \d+ - [^\n]{0,120}/) || [''])[0]) : ''}`) } }
finally { burners.forEach((b) => { try { process.kill(b.pid) } catch {} }); console.log('FIN fallos', JSON.stringify(fails)) }
