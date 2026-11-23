// [QA-Claude-5] #427: MUTACIONES propias. Aplica cada mutación al código del PR (copia de trabajo local de QA, se restaura con git), construye, sirve y ejecuta la comprobación que debe detectarla. Backend real.
// Uso: node qa/qa5-427-mut.cjs  (env PLAYWRIGHT_MODULE, DATABASE_URL, API, NODE_PATH como las demás)
const fs = require('fs'); const cp = require('child_process'); const crypto = require('crypto'); const path = require('path'); const { chromium } = require(process.env.PLAYWRIGHT_MODULE); const { Client } = require('pg')
const REPO = (process.env.QA_TOOLS || '.') + '/qa5/pr402'; const FE = REPO + '/frontend'; const API = process.env.API; const pass = 'Qa5-' + crypto.randomBytes(8).toString('hex') + 'A1!'
const call = async (tk, m, p, b) => { const r = await fetch(API + p, { method: m, headers: { 'content-type': 'application/json', ...(tk ? { Authorization: 'Bearer ' + tk } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) }); let j = null; try { j = await r.json() } catch {} return { status: r.status, body: j } }
const mk = async () => { const email = `qa5-mu-${crypto.randomBytes(3).toString('hex')}@example.test`; await call(null, 'POST', '/api/register', { name: 'Persona Mut', email, password: pass, acceptedTerms: true, termsVersion: '2026-11-v2' }); const c = new Client({ connectionString: process.env.DATABASE_URL }); await c.connect(); await c.query('UPDATE "Users" SET "onboardingCompleted"=true WHERE email=$1', [email]); await c.end(); return (await call(null, 'POST', '/api/login', { email, password: pass })).body.token }
const MUTS = [
  { id: 'm1', what: 'sin la guardia de salida: «Cerrar sesión» no abre la despedida', file: 'src/pages/ChatPage.tsx', from: 'useEffect(() => registerLeaveGuard(() => { if (!live.current.canLeave()) return true; setShowCheckout(true); return true }, { ownLinks: true }), [])', to: 'useEffect(() => {}, [])', test: 'despedida' },
  { id: 'm2', what: 'el cierre del chat solo borra el almacenamiento local (sin revocar el token)', file: 'src/pages/ChatPage.tsx', from: 'await signOut(BACKEND) // ES-136', to: "localStorage.removeItem('elevation_token'); localStorage.removeItem('elevation_role') // ES-136", test: 'despedida' },
  { id: 'm3', what: 'el cajón repite «Mi progreso» (sin omit)', file: 'src/pages/ChatPage.tsx', from: "omit: ['/app/progress'],", to: 'omit: [],', test: 'duplicado' },
  { id: 'm4', what: 'el cajón devuelve el foco al botón equivocado (no al ☰ del chat)', file: 'src/shell/Frame.tsx', from: 'opener={drawerOpener}', to: 'opener={menuButton}', test: 'foco' },
  { id: 'm5', what: 'a ≤ 900 px el ☰ abre la hoja propia en vez del cajón del marco', file: 'src/pages/ChatPage.tsx', from: 'onClick={event => { if (narrow) requestDrawer(event.currentTarget); else setMenuOpen(true) }}', to: 'onClick={() => { setMenuOpen(true) }}', test: 'cajon' },
  { id: 'm6', what: 'la extensión «Conversación» no se retira al salir del chat', file: 'src/shell/drawerExtra.ts', from: 'return () => { if (current === extra) { current = null; notify() } }', to: 'return () => { }', test: 'residuo' },
]
const sh = (cmd, cwd) => cp.execSync(cmd, { cwd, stdio: 'pipe', encoding: 'utf8', env: { ...process.env, PATH: (process.env.QA_TOOLS || '.') + '/node22;' + process.env.PATH } })
;(async () => {
  const br = await chromium.launch(); const results = []
  for (const m of MUTS) {
    const file = path.join(FE, m.file); const orig = fs.readFileSync(file, 'utf8')
    if (!orig.includes(m.from)) { console.log(`${m.id}: NO APLICA (texto no encontrado)`); results.push([m.id, 'no aplica']); continue }
    fs.writeFileSync(file, orig.split(m.from).join(m.to))
    try { sh('npx vite build --outDir $QA_TOOLS/qa5/dist-mut427 --emptyOutDir', FE) } catch (e) { fs.writeFileSync(file, orig); console.log(`${m.id}: no compila (${String(e.stderr || e.message).slice(0, 120)})`); results.push([m.id, 'no compila']); continue }
    fs.writeFileSync(file, orig)
    const srv = cp.spawn(process.execPath, ['qa/qa5-402-serve.cjs'], { env: { ...process.env, DIST: (process.env.QA_TOOLS || '.') + '/qa5/dist-mut427', API_PORT: '8402', PORT: '4404' }, stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 2500))
    let detected = false, note = ''
    try {
      const tk = await mk(); const ctx = await br.newContext({ viewport: { width: 390, height: 800 }, reducedMotion: 'reduce' }); const page = await ctx.newPage(); page.on('dialog', (d) => d.accept())
      await page.addInitScript(([t]) => { if (!localStorage.getItem('__i')) { localStorage.setItem('__i', '1'); localStorage.setItem('elevation_token', t); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elevation_name', 'P'); localStorage.setItem('elv_lang', 'es') } }, [tk])
      await page.goto('http://127.0.0.1:4404/app/chat'); await page.waitForSelector('.chat-menu-btn'); await page.waitForTimeout(800)
      const openMenu = async () => { await page.locator('.chat-menu-btn').focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(500) }
      if (m.test === 'despedida') {
        await openMenu(); const dr = page.locator('dialog.cg-drawer[open]')
        if (!(await dr.count())) { detected = true; note = 'no abre el cajón' } else {
          await dr.getByRole('button', { name: 'Cerrar sesión', exact: true }).click(); await page.waitForTimeout(700); const des = page.locator('dialog[open]').filter({ hasText: '¿Cómo te vas?' })
          if (!(await des.count())) { detected = true; note = 'no abre la despedida' } else { await des.locator('button').filter({ hasText: /^Saltar$/ }).click(); await page.waitForTimeout(2500); const st = (await call(tk, 'GET', '/api/session')).status; if (st !== 401) { detected = true; note = `token sigue válido (${st})` } } }
      }
      if (m.test === 'duplicado') { await openMenu(); const n = await page.evaluate(() => [...document.querySelectorAll('dialog.cg-drawer[open] a,dialog.cg-drawer[open] button')].filter((e) => /^Mi progreso$/.test(e.textContent.trim())).length); detected = n !== 1; note = `${n} veces` }
      if (m.test === 'foco') { await openMenu(); await page.keyboard.press('Escape'); await page.waitForTimeout(300); const f = await page.evaluate(() => document.activeElement.className.toString()); detected = !f.includes('chat-menu-btn'); note = f.slice(0, 30) }
      if (m.test === 'cajon') { await openMenu(); detected = (await page.locator('dialog.cg-drawer[open]').count()) === 0; note = detected ? 'abrió la hoja' : '' }
      if (m.test === 'residuo') {
        await openMenu(); await page.getByRole('button', { name: 'Mi progreso', exact: true }).click(); await page.waitForTimeout(1500); await page.getByRole('button', { name: /^Menú$/ }).click(); await page.waitForTimeout(500)
        const hs = await page.evaluate(() => [...document.querySelectorAll('dialog.cg-drawer[open] h3')].map((e) => e.textContent.trim())); detected = hs.includes('Conversación'); note = hs.join('|')
      }
      await ctx.close()
    } catch (e) { note = 'excepción ' + String(e.message).split('\n')[0].slice(0, 80); detected = true }
    srv.kill(); console.log(`${m.id}: ${detected ? 'DETECTADA' : 'ESCAPÓ'} — ${m.what} (${note})`); results.push([m.id, detected ? 'detectada' : 'escapó'])
  }
  sh('git checkout -- frontend/src', REPO); console.log('RESUMEN:', JSON.stringify(results)); await br.close()
})().catch((e) => { console.error('ABORTA', e); try { sh('git checkout -- frontend/src', REPO) } catch {} process.exit(2) })
