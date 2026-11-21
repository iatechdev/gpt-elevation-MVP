// O303-focus (QA-421 v2): tras el 409 `too_many_active` de «Crear invitación» el foco debe quedarse en el aviso del tope (no caer en <body> porque el botón queda deshabilitado).
// Chromium, build REAL, API simulada, datos sintéticos; evidencia, no corre en CI.
// Uso: PLAYWRIGHT_MODULE=… node scripts/o303-foco-tope-check.cjs   (construye en una carpeta temporal; BASE=… para usar un build ya servido)
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path'); const http = require('node:http'); const { spawnSync } = require('node:child_process')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
let failures = 0; const log = (ok, m) => { if (!ok) failures++; console.log(`${ok ? 'OK   ' : 'FALLA'} ${m}`) }
const iso = d => new Date(Date.now() + d * 86400000).toISOString()
const invite = n => ({ id: n, status: 'active', createdAt: iso(-1), expiresAt: iso(6), usedAt: null, revokedAt: null })
;(async () => {
  const root = path.resolve(__dirname, '..'); const out = fs.mkdtempSync(path.join(os.tmpdir(), 'o303-'))
  const built = spawnSync(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', out], { cwd: root, encoding: 'utf8', env: { ...process.env, VITE_BACKEND_URL: '' } })
  if (built.status !== 0) throw new Error('build: ' + built.stderr + built.stdout)
  const web = http.createServer((req, res) => { const p = decodeURIComponent(new URL(req.url, 'http://x').pathname); const t = path.resolve(out, '.' + p); const f = t.startsWith(out) && fs.existsSync(t) && fs.statSync(t).isFile() ? t : path.join(out, 'index.html')
    res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' })[path.extname(f)] || 'text/html'); res.end(fs.readFileSync(f)) })
  await new Promise(r => web.listen(0, '127.0.0.1', r)); const BASE = `http://127.0.0.1:${web.address().port}`
  const browser = await chromium.launch()
  for (const lang of ['es', 'en']) for (const reload of [false, true]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, reducedMotion: 'reduce' }); const page = await ctx.newPage()
    await page.addInitScript(l => { localStorage.setItem('elv_lang', l); localStorage.setItem('elevation_token', 'tok'); localStorage.setItem('elevation_role', 'therapist'); localStorage.setItem('elevation_name', 'Ana') }, lang)
    let created = false; const seen = []; page.on('request', r => { if (r.url().includes('/api/')) seen.push(r.method() + ' ' + new URL(r.url()).pathname) }); page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 300)) }); page.on('pageerror', e => console.log('PAGEERR', e.message.slice(0, 200)))
    await page.route('**/api/**', route => { const p = new URL(route.request().url()).pathname; const m = route.request().method()
      if (p === '/api/session') return route.fulfill({ json: { role: 'therapist', onboardingCompleted: true } })
      if (p === '/api/reviewer/invites' && m === 'POST') { created = true; return route.fulfill({ status: 409, json: { code: 'too_many_active' } }) }
      if (p === '/api/reviewer/invites' && m === 'GET') return route.fulfill({ json: { invites: Array.from({ length: created || reload ? 10 : 9 }, (_, i) => invite(i + 1)) } })
      return route.fulfill({ json: {} }) })
    await page.goto(BASE + '/app/professional-reviews', { waitUntil: 'domcontentloaded' })
    const button = page.locator('button.cg-btn').first(); await button.waitFor({ timeout: 8000 }).catch(async e => { console.log('URL', page.url(), seen.join(' ; '), (await page.locator('body').innerText()).slice(0, 300)); throw e })
    if (reload) { /* ya con 10 activas: el aviso derivado existe desde el principio, sin POST */ await page.waitForTimeout(400); const d = await page.evaluate(() => ({ disabled: document.querySelector('button.cg-btn')?.disabled })); log(d.disabled === true, `${lang} con 10 activas al cargar: el botón está deshabilitado`); await ctx.close(); continue }
    await button.click(); await page.waitForTimeout(800)
    const s = await page.evaluate(() => { const a = document.activeElement; return { tag: a?.tagName, tabindex: a?.getAttribute('tabindex'), text: (a?.textContent || '').trim().slice(0, 80), disabledBtn: document.querySelector('button.cg-btn')?.disabled, banners: document.querySelectorAll('[role="alert"],[role="status"],.cg-banner').length } })
    log(s.disabledBtn === true, `${lang} tras el 409 el botón queda deshabilitado (lista recargada con 10)`)
    log(s.tag !== 'BODY' && s.tabindex === '-1' && s.text.length > 0, `${lang} el foco queda en el aviso del tope (${s.tag} tabindex=${s.tabindex} «${s.text.slice(0, 40)}»)`)
    await ctx.close()
  }
  await browser.close(); web.close(); fs.rmSync(out, { recursive: true, force: true }); console.log(failures ? `\n${failures} FALLAS` : '\nTODO OK'); process.exit(failures ? 1 : 0)
})()
