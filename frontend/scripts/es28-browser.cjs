// Built React UI, isolated Chromium and wholly synthetic HTTP fixtures.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const { chromium } = process.env.PLAYWRIGHT_MODULE ? require(process.env.PLAYWRIGHT_MODULE) : await import('playwright');
  const base = process.env.ES28_PREVIEW_URL ?? 'http://127.0.0.1:4228';
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
  const browser = await chromium.launch({ headless: true }); const page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, reducedMotion: 'reduce' });
  const exceptions = []; page.on('pageerror', error => exceptions.push(error.message));
  const rows = new Map(); const requests = []; const writes = []; const byRequest = new Map();
  let lost = false; let failDetail = false; let listStatus = 200; let detailStatus = 200;
  const checks = []; const check = label => { checks.push(label); console.log('PASS ' + label); };
  await page.route('**/api/**', async route => {
    const req = route.request(); const url = new URL(req.url());
    if (!url.pathname.startsWith('/api/evidence')) return route.fulfill({ json: [] });
    requests.push({ method: req.method(), path: url.pathname, query: url.search });
    if (req.method() === 'POST') {
      const body = req.postDataJSON(); writes.push(body);
      let row = byRequest.get(body.requestId);
      if (!row) { row = { id: rows.size + 1, version: 1, status: body.status, authoring: 'person', createdAt: '2026-10-27T12:00:00Z', payload: { ...body.payload, title: 'Canonical ' + body.payload.title } }; rows.set(row.id, row); byRequest.set(body.requestId, row); }
      if (lost) { lost = false; return route.abort('failed'); }
      return route.fulfill({ status: 201, json: { id: row.id, version: row.version, status: row.status, created: true } });
    }
    if (url.pathname === '/api/evidence') return route.fulfill({ status: listStatus, json: listStatus === 200 ? { evidence: [...rows.values()] } : { error: 'PRIVATE ERROR CANARY' } });
    const row = rows.get(Number(url.pathname.split('/').at(-1)));
    return route.fulfill({ status: failDetail ? 503 : detailStatus !== 200 ? detailStatus : row ? 200 : 404,
      json: failDetail || detailStatus !== 200 || !row ? { error: 'PRIVATE ERROR CANARY' } : { id: row.id, currentVersion: row.version, versions: row.version > 1 ? [{ ...row, version: 1, status: 'draft' }, row] : [row] } });
  });
  const newForm = async () => { await page.getByRole('link', { name: /^(Nueva evidencia|New evidence)$/ }).click(); await page.locator('#title').waitFor(); };
  try {
    await page.goto(base + '/app/evidence'); await page.waitForURL('**/login'); assert.equal(requests.length, 0);
    check('protected routes require a session');
    await page.evaluate(() => { localStorage.setItem('elevation_token', 'synthetic-token'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', 'es'); });
    await page.goto(base + '/app/evidence'); await page.getByText('Aún no tienes evidencias guardadas.', { exact: true }).waitFor();
    await newForm(); await page.locator('#title').fill('Synthetic case');
    await page.getByRole('button', { name: 'Guardar borrador', exact: true }).click(); await page.getByRole('alert').waitFor(); assert.equal(writes.length, 0);
    check('title-only draft rejected before any POST');
    await page.locator('#situation').fill('Situación sintética'); await page.locator('#responsibility').fill('Responsabilidad sintética');
    await page.locator('#actions-0').fill('Acción sintética'); await page.locator('#goal').fill('La meta era 10.000');
    await page.locator('#delivered').fill('<img src=x onerror="window.INJECTED=true"> entrega sintética');
    await page.getByRole('radio', { name: 'No lo conozco', exact: true }).check();
    await page.getByRole('button', { name: 'Añadir muestra', exact: true }).click(); await page.locator('#sample-0').fill('http://example.invalid/sample');
    await page.getByRole('button', { name: 'Revisar para confirmar', exact: true }).click(); await page.getByRole('alert').waitFor(); assert.equal(writes.length, 0);
    await page.locator('#sample-0').fill('https://example.invalid/sample');
    await page.getByRole('button', { name: 'EN', exact: true }).click(); assert.equal(await page.locator('#goal').inputValue(), 'La meta era 10.000');
    check('reference validation and ES/EN preserve original values without POST');
    page.once('dialog', dialog => dialog.dismiss()); await page.getByRole('link', { name: 'Back to my evidence', exact: true }).click();
    assert.equal(await page.locator('#title').inputValue(), 'Synthetic case');
    page.once('dialog', dialog => dialog.dismiss()); await page.evaluate(() => history.back()); await page.waitForURL('**/app/evidence/new');
    assert.equal(await page.locator('#title').inputValue(), 'Synthetic case');
    check('cancelled in-app and browser Back preserve the unsaved form');
    for (const width of [320, 375, 768, 1440]) { await page.setViewportSize({ width, height: 1000 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'overflow at ' + width); }
    await page.setViewportSize({ width: 768, height: 1000 }); await page.evaluate(() => { document.body.style.zoom = '200%'; });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await page.evaluate(() => { document.body.style.zoom = ''; });
    await page.keyboard.press('Tab'); await page.getByRole('link', { name: 'Skip to content' }).focus();
    assert.ok(await page.getByRole('link', { name: 'Skip to content' }).evaluate(el => getComputedStyle(el).outlineStyle !== 'none'));
    await page.keyboard.press('Enter'); assert.equal(await page.evaluate(() => document.activeElement.id), 'evidence-main');
    check('responsive 320/375/768/1440, zoom 200%, skip/keyboard/focus/reduced motion');
    if (process.env.ES28_SCREENSHOT_DIR) {
      fs.mkdirSync(process.env.ES28_SCREENSHOT_DIR, { recursive: true });
      await page.setViewportSize({ width: 375, height: 1000 }); await page.screenshot({ path: path.join(process.env.ES28_SCREENSHOT_DIR, 'es28-form-mobile-en.png'), fullPage: true });
    }
    await page.getByRole('button', { name: 'Review before confirming', exact: true }).click();
    assert.equal(await page.locator('.evidence-comparison > div').count(), 3);
    assert.ok((await page.locator('.evidence-comparison > div').nth(0).innerText()).includes('10.000'));
    assert.ok(!(await page.locator('.evidence-comparison > div').nth(1).innerText()).includes('10.000'));
    assert.ok(await page.getByRole('button', { name: 'Confirm evidence', exact: true }).isDisabled()); assert.equal(writes.length, 0);
    assert.equal(await page.locator('.evidence-content img').count(), 0); assert.equal(await page.evaluate(() => window.INJECTED), undefined);
    check('explicit preview separates goal/delivery/unknown effect and escapes hostile text');
    lost = true; await page.getByRole('checkbox', { name: 'I have reviewed this evidence.' }).check();
    await page.getByRole('button', { name: 'Confirm evidence', exact: true }).click();
    await page.getByRole('button', { name: 'Retry', exact: true }).waitFor(); assert.equal(rows.size, 1); assert.equal(writes.length, 1);
    assert.equal(await page.getByRole('heading', { name: 'Evidence confirmed', exact: true }).count(), 0);
    assert.equal(await page.locator('#title').count(), 0); // frozen uncertain attempt, cannot silently alter it
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await page.getByRole('heading', { name: 'Evidence confirmed', exact: true }).waitFor();
    assert.deepEqual(writes[0], writes[1]); assert.equal(rows.size, 1);
    assert.equal(writes[0].payload.goal, 'La meta era 10.000'); assert.deepEqual(writes[0].payload.observedEffect, { known: false });
    assert.equal(writes[0].payload.responsibility.source, 'self_report'); assert.equal(writes[0].payload.autonomy, undefined);
    await page.getByText('Canonical Synthetic case', { exact: true }).waitFor();
    check('lost response retries exact body/requestId without duplicates; success displays persisted representation');
    await page.getByRole('link', { name: 'View details and history', exact: true }).click();
    await page.getByText('Editing saved evidence requires', { exact: false }).waitFor();
    assert.equal(await page.getByRole('button', { name: /Edit|Delete/ }).count(), 0);
    const original = rows.get(1); rows.set(1, { ...original, version: 2 });
    await page.reload(); await page.getByText('Version: 2', { exact: true }).waitFor();
    await page.locator('summary').click(); await page.getByRole('heading', { name: 'Earlier version: 1', exact: true }).waitFor();
    check('detail is read-only and reports server version without offering unsafe updates');
    await page.getByRole('link', { name: 'Back to my evidence', exact: true }).click(); await page.getByRole('article').waitFor(); await newForm();
    await page.locator('#title').fill('Synthetic draft'); await page.locator('#situation').fill('Synthetic context'); failDetail = true;
    await page.getByRole('button', { name: 'Save draft', exact: true }).click(); await page.getByRole('button', { name: 'Retry', exact: true }).waitFor();
    const writeCount = writes.length; assert.equal(await page.getByRole('heading', { name: 'Draft saved', exact: true }).count(), 0);
    failDetail = false; await page.getByRole('button', { name: 'Retry', exact: true }).click(); await page.getByRole('heading', { name: 'Draft saved', exact: true }).waitFor();
    assert.equal(writes.length, writeCount); assert.equal(rows.size, 2);
    check('ACK plus failed verification does not claim saved; retry reads without another POST');
    await page.getByRole('link', { name: 'Back to my evidence', exact: true }).click(); await page.getByRole('article').first().waitFor();
    listStatus = 500; await page.reload(); await page.getByRole('alert').waitFor(); assert.equal(await page.getByRole('article').count(), 0);
    assert.ok(!(await page.locator('main').innerText()).includes('PRIVATE ERROR CANARY'));
    listStatus = 200; await page.getByRole('button', { name: 'Retry', exact: true }).click(); await page.getByRole('article').first().waitFor();
    detailStatus = 404; await page.getByRole('link', { name: 'View details and history', exact: true }).first().click();
    await page.getByText('This evidence is not available.', { exact: true }).waitFor(); detailStatus = 200;
    check('list errors/foreign or missing detail do not become empty success or leak raw errors');
    await page.getByRole('link', { name: 'Back to my evidence', exact: true }).click(); await page.getByRole('article').first().waitFor(); await newForm();
    await page.locator('#title').fill('UNSAVED PRIVATE SYNTHETIC CANARY');
    await page.evaluate(() => { localStorage.removeItem('elevation_token'); dispatchEvent(new StorageEvent('storage', { key: 'elevation_token' })); });
    await page.getByRole('link', { name: 'Sign in', exact: true }).waitFor(); assert.equal(await page.locator('#title').count(), 0);
    const persisted = await page.evaluate(() => Object.keys(localStorage).filter(key => /evidence|draft|payload|proposal/i.test(key)));
    assert.deepEqual(persisted, []); assert.deepEqual(exceptions, []);
    assert.ok(requests.every(req => ['GET', 'POST'].includes(req.method) && !req.query));
    assert.ok(writes.every(body => Object.keys(body).sort().join(',') === 'payload,requestId,status'));
    check('session change hides private draft; no persistent evidence cache, owner IDs, PUT or DELETE');
    console.log(`Browser checks: ${checks.length} passed; 0 console exceptions. HTTP is mocked; all records are synthetic.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
