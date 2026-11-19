// ES-332 (B-T8-1) · /app/feedback con la bandera APAGADA (build por defecto): ¿hay exactamente un h1? Build real de React en Chromium, sesión sintética, sin servidor real.
// Uso: PLAYWRIGHT_MODULE=<ruta a playwright> node scripts/es332-feedback-h1-check.cjs   (construye con vite; falla con código 1 si /app/feedback no tiene exactamente un h1)
const fs = require('fs'); const path = require('path'); const http = require('http'); const { spawnSync } = require('child_process')
const root = path.resolve(__dirname, '..'); const pw = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const out = fs.mkdtempSync(path.join(require('os').tmpdir(), 'es332-'))
const env = { ...process.env }; delete env.VITE_ENABLE_PILOT_FEEDBACK_PREVIEW; delete env.VITE_ENABLE_PILOT_FEEDBACK_LIVE
const built = spawnSync(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', out], { cwd: root, encoding: 'utf8', env }); if (built.status !== 0) throw new Error(built.stderr.slice(0, 500))
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' }
const server = http.createServer((req, res) => { const url = decodeURIComponent(req.url.split('?')[0]); let file = path.join(out, url); if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(out, 'index.html'); res.setHeader('content-type', types[path.extname(file)] || 'application/octet-stream'); res.end(fs.readFileSync(file)) })
server.listen(0, '127.0.0.1', async () => {
  const origin = 'http://127.0.0.1:' + server.address().port; let failed = false
  const browser = await pw.chromium.launch();
  try {
    for (const lang of ['es', 'en']) for (const width of [390, 1360]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } })
      await context.addInitScript(([l]) => { localStorage.setItem('elevation_token', 'es332-synthetic-session'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l) }, [lang])
      const page = await context.newPage(); await page.route('**/api/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: route.request().url().endsWith('/api/session') ? JSON.stringify({ role: 'user', onboardingCompleted: true }) : '{}' }))
      await page.goto(origin + '/app/feedback'); await page.waitForSelector('main, h1', { timeout: 15000 })
      const info = await page.evaluate(() => ({ h1: [...document.querySelectorAll('h1')].map((h) => h.textContent.trim()), status: [...document.querySelectorAll('[role=status]')].map((s) => s.textContent.trim()).filter(Boolean), path: location.pathname }))
      info.body = (await page.evaluate(() => document.body.innerText)).slice(0, 160).split('\n').join(' | '); info.path = await page.evaluate(() => location.pathname); const ok = info.h1.length === 1 && info.path === '/app/feedback'; if (!ok) failed = true
      console.log(`${ok ? 'PASS' : 'FAIL'} /app/feedback bandera apagada ${lang} ${width}px: h1=${JSON.stringify(info.h1)} estado=${JSON.stringify(info.status)} url=${info.path} cuerpo=${info.body}`)
      await context.close()
    }
  } finally { await browser.close(); server.close(); fs.rmSync(out, { recursive: true, force: true }); if (failed) process.exitCode = 1 }
})
