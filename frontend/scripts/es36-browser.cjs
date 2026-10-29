// Compiled React/Chromium, fixture-only. No user browser profile, backend or LLM.
const fs = require('node:fs'); const path = require('node:path'); const http = require('node:http');
const { spawnSync } = require('node:child_process'); const { once } = require('node:events'); const assert = require('node:assert/strict');
(async () => {
  const root = path.resolve(__dirname, '..'); const artifacts = path.join(root, 'node_modules/.es36-artifacts'); fs.mkdirSync(artifacts, { recursive: true });
  const scenarios = ['default', 'normal', 'lost-ack', 'save-error', 'conflict', 'unconfigured', 'load-error', 'metrics-error']; const builds = {};
  for (const name of scenarios) {
    const out = path.join(root, 'node_modules/.es36-' + name);
    const result = spawnSync(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', out], { cwd: root, encoding: 'utf8', env: { ...process.env, VITE_ENABLE_PILOT_FEEDBACK_PREVIEW: name === 'default' ? 'false' : 'true', VITE_PILOT_FEEDBACK_SCENARIO: name === 'normal' || name === 'default' ? '' : name } });
    if (result.status !== 0) throw new Error('Build failed: ' + name + ' ' + result.stderr);
    builds[name] = out; console.log('BUILD ' + name + ' PASS');
  }
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright'); const browser = await chromium.launch({ headless: true }); const servers = []; const checks = [];
  const check = name => { checks.push(name); console.log('PASS ' + name); };
  try {
    async function session(name, role = 'user') {
      const dist = builds[name]; const server = http.createServer((req, res) => {
        const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); const target = path.resolve(dist, '.' + pathname);
        if (!target.startsWith(dist + path.sep) && target !== dist) { res.writeHead(404).end(); return; }
        const file = fs.existsSync(target) && fs.statSync(target).isFile() ? target : path.join(dist, 'index.html');
        const ext = path.extname(file); res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' })[ext] || 'text/html'); res.end(fs.readFileSync(file));
      }); server.listen(0, '127.0.0.1'); await once(server, 'listening'); servers.push(server);
      const context = await browser.newContext({ viewport: { width: 375, height: 900 }, reducedMotion: 'reduce' });
      await context.addInitScript(role => { localStorage.setItem('elevation_token', 'es36-synthetic-session'); localStorage.setItem('elevation_role', role); if (!localStorage.getItem('elv_lang')) localStorage.setItem('elv_lang', 'es'); }, role);
      const page = await context.newPage(); const writes = []; const runtime = [];
      page.on('pageerror', e => runtime.push(e.message));
      await page.route('**/api/**', route => { if (route.request().method() !== 'GET') writes.push(route.request().method() + ' ' + new URL(route.request().url()).pathname); return route.fulfill({ json: [] }); });
      const origin = `http://127.0.0.1:${server.address().port}`;
      return { page, context, origin, writes, runtime };
    }
    const d = await session('default'); await d.page.goto(d.origin + '/app/feedback'); await d.page.getByText('La recogida real de respuestas no está habilitada.', { exact: true }).waitFor(); assert.equal(await d.page.getByRole('radio').count(), 0);
    await d.page.goto(d.origin + '/app/dashboard'); assert.equal(await d.page.locator('.pilot-entry').count(), 0); assert.deepEqual(d.writes, []); await d.context.close(); check('default build: no form or preview link, direct URL disabled');
    const s = await session('normal'); const p = s.page; await p.goto(s.origin + '/app/feedback'); await p.getByRole('heading', { name: 'Tu opinión es opcional' }).waitFor();
    assert.equal(await p.locator('input:checked').count(), 0); assert.equal(await p.getByRole('textbox').count(), 0); assert.equal(await p.getByRole('button', { name: 'Guardar respuestas (simulación)', exact: true }).isDisabled(), true);
    await p.keyboard.press('Tab'); assert.equal(await p.evaluate(() => document.activeElement.textContent), 'Saltar al contenido'); await p.keyboard.press('Enter'); assert.equal(await p.evaluate(() => document.activeElement.id), 'pilot-main');
    const box = await p.locator('input[name="listened"]').first().boundingBox(); assert.ok(box.width >= 18 && box.height >= 18, 'radio must be visible');
    assert.equal(await p.locator('input[name="listened"]').first().evaluate(e => getComputedStyle(e.parentElement).fontSize), '16px');
    await p.locator('input[name="respected"]').last().check(); await p.locator('input[name="listened"]').first().check(); await p.getByRole('button', { name: 'EN', exact: true }).click(); assert.equal(await p.locator('input[name="listened"]').first().isChecked(), true);
    await p.getByRole('button', { name: 'Save responses (simulation)', exact: true }).click(); await p.getByText('Saved only in the simulation.', { exact: true }).waitFor();
    await p.getByRole('button', { name: 'Withdraw response (simulation)', exact: true }).click(); assert.equal(await p.locator('dialog button').first().evaluate(e => e === document.activeElement), true); await p.keyboard.press('Escape'); assert.equal(await p.getByRole('button', { name: 'Withdraw response (simulation)', exact: true }).count(), 1);
    await p.getByRole('button', { name: 'Withdraw response (simulation)', exact: true }).click(); await p.locator('dialog').getByRole('button', { name: 'Confirm withdrawal', exact: true }).click(); await p.getByText('Response withdrawn from the simulation.', { exact: true }).waitFor(); assert.equal(await p.locator('input:checked').count(), 0);
    for (const width of [320, 375, 768, 1440]) { await p.setViewportSize({ width, height: 900 }); assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'feedback overflow ' + width); }
    await p.setViewportSize({ width: 320, height: 900 }); await p.evaluate(() => scrollTo(0, 0)); await p.screenshot({ path: path.join(artifacts, 'feedback-mobile.png'), fullPage: true });
    await p.reload(); await p.getByText('No saved response in this simulation.', { exact: true }).waitFor(); assert.equal(await p.locator('input:checked').count(), 0);
    await p.locator('input[name="respected"]').first().check(); p.once('dialog', dialog => dialog.dismiss()); await p.getByRole('link', { name: 'Back to my space', exact: true }).click(); assert.equal(new URL(p.url()).pathname, '/app/feedback');
    await p.evaluate(() => { localStorage.setItem('elevation_token', 'es36-synthetic-B'); window.dispatchEvent(new StorageEvent('storage', { key: 'elevation_token', newValue: 'es36-synthetic-B' })); }); await p.getByText('No saved response in this simulation.', { exact: true }).waitFor(); assert.equal(await p.locator('input:checked').count(), 0);
    assert.equal(await p.evaluate(() => Object.keys(sessionStorage).length), 0); assert.deepEqual(s.writes, []); assert.deepEqual(s.runtime, []); await s.context.close(); check('ES/EN, optional answers, RAM save/readback/withdraw, reload/session clear, keyboard/focus, exit guard, widths and zero writes');
    for (const name of ['lost-ack', 'save-error', 'conflict']) {
      const s = await session(name); const p = s.page; await p.goto(s.origin + '/app/feedback'); await p.locator('input[name="listened"]').first().check(); await p.getByRole('button', { name: 'Guardar respuestas (simulación)', exact: true }).click();
      if (name === 'lost-ack') { await p.getByText('No pudimos confirmar el guardado. Consulta antes de reintentar.', { exact: true }).waitFor(); await p.getByRole('button', { name: 'Consultar estado', exact: true }).click(); await p.getByText('Guardado solo en la simulación.', { exact: true }).waitFor(); }
      else if (name === 'save-error') { await p.getByText('No pudimos guardar la simulación. Tus respuestas siguen en esta pantalla.', { exact: true }).waitFor(); assert.equal(await p.locator('input[name="listened"]').first().isChecked(), true); }
      else { await p.getByRole('button', { name: 'Revisar versión guardada', exact: true }).click(); assert.equal(await p.locator('input[name="listened"]').first().isChecked(), true); await p.getByRole('button', { name: 'Guardar respuestas (simulación)', exact: true }).click(); await p.getByText('Guardado solo en la simulación.', { exact: true }).waitFor(); }
      assert.deepEqual(s.writes, []); assert.deepEqual(s.runtime, []); await s.context.close(); check(name + ': no false server persistence; draft retained or reconciled');
    }
    for (const name of ['unconfigured', 'load-error']) { const s = await session(name); await s.page.goto(s.origin + '/app/feedback'); if (name === 'load-error') await s.page.getByRole('button', { name: 'Reintentar carga', exact: true }).waitFor(); else assert.equal(await s.page.getByRole('button', { name: 'Guardar respuestas (simulación)', exact: true }).isDisabled(), true); assert.deepEqual(s.writes, []); await s.context.close(); check(name + ': no enabled real capture'); }
    const admin = await session('normal', 'admin'); await admin.page.goto(admin.origin + '/admin/pilot-metrics'); const main = admin.page.locator('.pilot-scope'); await main.getByRole('heading', { name: 'Métricas del piloto', exact: true }).waitFor(); await main.getByText('Datos protegidos', { exact: true }).first().waitFor(); assert.equal(await main.locator('dd').count(), 0); assert.equal(await main.getByText('5/6 · 7 días', { exact: true }).count(), 2);
    for (const width of [320, 375, 768, 1440]) { await admin.page.setViewportSize({ width, height: 900 }); assert.ok(await admin.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'metrics overflow ' + width); }
    await admin.page.evaluate(() => { document.documentElement.style.zoom = '2'; }); assert.ok(await admin.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'zoom 200%'); await admin.page.evaluate(() => { document.documentElement.style.zoom = ''; });
    await admin.page.screenshot({ path: path.join(artifacts, 'metrics-desktop.png'), fullPage: true }); await admin.page.setViewportSize({ width: 375, height: 900 }); await admin.page.screenshot({ path: path.join(artifacts, 'metrics-mobile.png'), fullPage: true }); assert.deepEqual(admin.writes, []); assert.deepEqual(admin.runtime, []); await admin.context.close(); check('admin fixture projection: targets separate, protected counts absent, responsive and CSS zoom');
    const error = await session('metrics-error', 'admin'); await error.page.goto(error.origin + '/admin/pilot-metrics'); await error.page.getByText('No pudimos cargar la simulación.', { exact: true }).waitFor(); assert.equal(await error.page.locator('dd').count(), 0); await error.context.close(); check('metrics failure is an error, not zero results');
    console.log(`ES-36 browser: ${checks.length} groups PASS. Compiled UI and fixture repository; backend API writes zero, no LLM. Client role guard is not real server authorization.`);
  } finally { await browser.close(); for (const s of servers) await new Promise(resolve => { s.close(resolve); s.closeAllConnections(); }); }
})().catch(error => { console.error(error.name + ': ' + error.message); process.exitCode = 1; });
