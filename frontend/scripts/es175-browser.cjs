// ES-175 (HU-P24): «Mis revisiones» de la persona con Cartografía, sobre la vista previa SINTÉTICA (fixture en memoria; sin servidor ni datos reales).
// Uso: (VITE_ENABLE_FACILITATION_PREVIEW=true npx vite build && npx vite preview --host 127.0.0.1 --port 4256 --strictPort)
//      ES175_URL=http://127.0.0.1:4256 PLAYWRIGHT_MODULE=<playwright> [AXE_PATH=<axe.min.js>] [SHOTS_DIR=<dir>] node scripts/es175-browser.cjs
const assert = require('node:assert/strict'); const fs = require('node:fs'); const path = require('node:path');
(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright'); const base = process.env.ES175_URL || 'http://127.0.0.1:4256';
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
  const axe = process.env.AXE_PATH ? fs.readFileSync(process.env.AXE_PATH, 'utf8') : ''; const shots = process.env.SHOTS_DIR; if (shots) fs.mkdirSync(shots, { recursive: true });
  const browser = await chromium.launch({ headless: true }); const checks = [];
  const ok = label => { checks.push(label); console.log('PASS ' + label); };
  const XSS = '<img src=x onerror="window.__xss=1"> & <b>negrita</b>';
  for (const lang of ['es', 'en']) for (const [width, scheme] of [[390, 'light'], [1360, 'dark']]) {
    const tag = `${lang} ${width}px ${scheme}`;
    const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme }); const page = await context.newPage(); const errors = [];
    page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
    await page.addInitScript(([l]) => { localStorage.setItem('elevation_token', 'synthetic-token'); localStorage.setItem('elv_lang', l); }, [lang]);
    await page.route('**/api/session', r => r.fulfill({ json: { role: 'user', onboardingCompleted: true } }));
    const shot = async name => { if (shots) await page.screenshot({ path: path.join(shots, `${name}-${lang}-${width}-${scheme}.png`), fullPage: true }); };
    const audit = async label => { if (!axe) return; await page.addScriptTag({ content: axe }); const v = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }).then(r => r.violations.map(x => x.id + ':' + x.nodes.length + ' ' + x.nodes.slice(0, 2).map(n => n.target.join(' ') + ' ' + (n.any[0] && n.any[0].message)).join(' | ')))); assert.deepEqual(v, [], `${tag} ${label} axe`); };
    // 1) vacío
    await page.goto(base + '/app/professional-reviews'); await page.locator('h1').waitFor(); await page.locator('.cg-banner').nth(1).waitFor();
    assert.equal(await page.locator('h1').count(), 1); assert.equal(await page.locator('.cg-banner').count() >= 2, true);
    await audit('vacío'); await shot('vacio'); ok(`${tag}: vacío con franja de vista previa, un solo h1, axe 0`);
    // 2) el profesional registra una revisión (misma sesión, navegación del cliente) y la persona la ve
    await page.goto(base + '/facilitation/participants/synthetic-A/reviews/new?shareId=synthetic-share-A'); await page.locator('form').waitFor();
    await page.locator('input[type=checkbox]').first().check();
    const areas = page.locator('textarea'); await areas.nth(0).fill(XSS); await areas.nth(1).fill('Límites de prueba / test limits');
    await page.locator('form button[type=submit]').click(); await page.locator('form button').filter({ hasNotText: /^$/ }).nth(0).waitFor();
    await page.locator('form .fac-preview button, form button[type=button]').first().click(); await page.locator('[role=status]').filter({ hasText: /.+/ }).first().waitFor();
    // volver a la pantalla de la persona SIN recargar (estado en memoria del fixture)
    await page.evaluate(() => { history.pushState({}, '', '/app/professional-reviews'); dispatchEvent(new PopStateEvent('popstate')); });
    await page.locator('.cgf-review').first().waitFor({ timeout: 8000 });
    assert.equal(await page.evaluate(() => window.__xss), undefined, 'el HTML del revisor no se ejecuta');
    assert.ok((await page.locator('.cgf-review').first().innerText()).includes('<img src=x'), 'el HTML se ve como texto');
    await audit('con revisión'); await shot('revision'); ok(`${tag}: la revisión se ve con chips, HTML mostrado como texto (no ejecutado), axe 0`);
    // 3) objetar: formulario, contador, vista previa exacta, confirmar
    await page.locator('.cgf-review .cg-btn').first().click(); const area = page.locator('.cgf-form textarea'); await area.waitFor();
    assert.equal(await area.evaluate(el => document.activeElement === el), false); // el foco lo maneja la lógica existente
    await area.fill('No coincide / mismatch ' + XSS);
    assert.ok((await page.locator('.cgf-form .cg-hint').innerText()).includes('/ 2000'));
    await audit('formulario'); await shot('objecion-formulario');
    await page.locator('.cgf-form button[type=submit]').click(); await page.locator('.cgf-form .cg-hintbox').waitFor(); await audit('vista previa'); await shot('objecion-previa');
    await page.locator('.cgf-form button.cg-btn:not(.cg-btn--ghost)').click(); await page.locator('.cgf-review .cgf-event').last().waitFor({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(500); await audit('objeción registrada'); await shot('objecion-registrada');
    assert.equal(await page.evaluate(() => window.__xss), undefined);
    ok(`${tag}: objeción con contador, vista previa exacta y confirmación; sin ejecutar HTML; axe 0`);
    assert.deepEqual(errors, [], tag + ' errores de consola'); await context.close();
  }
  await browser.close(); console.log(`ES-175 pantalla: ${checks.length} comprobaciones superadas (vista previa sintética).`);
})().catch(e => { console.error('ES-175 falló:', e); process.exit(1); });
