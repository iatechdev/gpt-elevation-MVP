// QA-Claude-2 — PR #346 (ES-346) mutaciones sobre el clon: FRONTEND=<clon>/frontend PLAYWRIGHT_MODULE=... AXE_PATH=... node qa/mut346.cjs
// Primero las pruebas estructurales (es-346, es-135, es-174); si sobrevive, build + el script de navegador del PR (es346-eliminar-sesion.cjs, 10 escenarios).
const fs = require('fs'), path = require('path'), http = require('http'), { execSync, spawn } = require('child_process'); const FE = path.resolve(process.env.FRONTEND); const P = (f) => path.join(FE, f)
const files = ['src/space/DataPage.tsx', 'src/shell/access.ts', 'src/access/farewell.ts', 'src/access/signOut.ts']; const orig = Object.fromEntries(files.map((f) => [f, fs.readFileSync(P(f), 'utf8')])); const restore = () => files.forEach((f) => fs.writeFileSync(P(f), orig[f]))
const sh = (cmd, env) => { try { execSync(cmd, { cwd: FE, stdio: 'pipe', timeout: 600000, shell: true, maxBuffer: 1e8, env: { ...process.env, ...env } }); return false } catch (e) { return true } }
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2' }
const serve = (dir, port) => new Promise((res) => { const s = http.createServer((q, r) => { let p; try { p = path.join(dir, decodeURIComponent(q.url.split('?')[0])) } catch { p = dir } if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(dir, 'index.html'); r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r) }).listen(port, () => res(s)) })
const M = async (name, file, a, b) => { restore(); const s = fs.readFileSync(P(file), 'utf8'); if (!s.includes(a)) { console.log(`M ${name}: SIN ANCLA «${a.slice(0, 40)}»`); return } fs.writeFileSync(P(file), s.replace(a, () => b))
  let r = sh('node --test test/es-346-cierre-sesion.test.mjs test/es-135-data.test.mjs test/es-174-mis-datos-plan.test.mjs'), how = 'por las pruebas estructurales'
  if (!r) { const out = path.join(FE, '..', '..', 'b346mut'); sh(`npx vite build --outDir "${out}" --emptyOutDir`, { VITE_BACKEND_URL: 'http://localhost:8090' }); const srv = await serve(out, 4363); r = sh('node scripts/es346-eliminar-sesion.cjs', { ES346_URL: 'http://localhost:4363' }); srv.close(); how = 'solo por el script de navegador' }
  console.log(`M ${name}: ${r ? 'DETECTADO ' + how : 'SOBREVIVE'}`); restore() }
const DP = 'src/space/DataPage.tsx', AC = 'src/shell/access.ts', FW = 'src/access/farewell.ts', SO = 'src/access/signOut.ts'
;(async () => {
  console.log('sin mutar:', sh('node --test test/es-346-cierre-sesion.test.mjs test/es-135-data.test.mjs test/es-174-mis-datos-plan.test.mjs') ? 'FALLA (mal)' : 'pasan')
  await M('a se quita la guarda alive.current antes de startFarewell', DP, 'if (alive.current) startFarewell(pathname)', 'startFarewell(pathname)')
  await M('b signOut ocurre antes de la marca', DP, 'if (alive.current) startFarewell(pathname)\n      await signOut(BACKEND)', 'await signOut(BACKEND)\n      if (alive.current) startFarewell(pathname)')
  await M('c no se borra la marca al desmontar', DP, 'alive.current = false; endFarewell()', 'alive.current = false')
  await M('d withFarewell vuelve «allow» cualquier decisión', AC, "(decision === 'login' && farewell ? 'allow' : decision)", "(farewell ? 'allow' : decision)")
  await M('e isFarewell por prefijo (subrutas también)', FW, 'path !== null && path === pathname', 'path !== null && pathname.startsWith(path)')
  await M('f se quita el cierre de sesión (signOut)', DP, 'await signOut(BACKEND)', '')
  await M('g la marca se guarda en localStorage', FW, 'export function startFarewell(pathname: string) { path = pathname }', "export function startFarewell(pathname: string) { path = pathname; localStorage.setItem('elevation_farewell', pathname) }")
  await M('h signOut sin tope de espera (el logout colgado bloquea)', SO, 'setTimeout(() => controller.abort(), SIGN_OUT_TIMEOUT_MS)', 'setTimeout(() => controller.abort(), 600000)')
  await M('i la marca vale para cualquier ruta', FW, 'path !== null && path === pathname', 'path !== null')
  await M('j solo se cierra la sesión si la pantalla sigue montada', DP, 'await signOut(BACKEND)', 'if (alive.current) await signOut(BACKEND)')
  restore(); console.log('clon restaurado')
})()
