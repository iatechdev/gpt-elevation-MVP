// Actual built React UI, isolated browser, explicitly mocked HTTP boundary.
// Run preview first; PLAYWRIGHT_MODULE can point at an existing QA installation.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const track = (over = {}) => ({ level: 2, state: 'initial', stale: false, catalogOutdated: false,
  confidence: 'low', confidenceReason: { es: 'Respaldo sintético de prueba', en: 'Synthetic test support' },
  evidenceCount: 1, authoring: 'person', rationale: 'Justificación sintética', needsReview: false, ...over });
const skill = (key, over = {}) => ({ skillKey: key, type: 'transversal', labels: { es: `Prueba ${key}`, en: `Test ${key}` },
  rubric: { levels: Object.fromEntries([1, 2, 3, 4].map(level => [level, { es: `Criterio sintético ${level}`, en: `Synthetic criterion ${level}` }])), source: 'Fuente sintética — solo pruebas', verifiedAt: '2026-10-01' },
  self: track(), review: null, state: 'initial', ...over });
const fullMap = () => ({ catalogVersion: 7, skills: [
  skill('current', { self: track({ rationale: '<img src=x onerror="window.INJECTED=true">' }) }),
  skill('stale', { self: track({ level: 4, stale: true, state: 'stale', confidence: 'medium' }), state: 'stale' }),
  skill('unknown', { self: null, state: 'no_evidence', type: 'domain' }),
  skill('contradictory', { self: track({ level: 3, state: 'contradictory', needsReview: true }), state: 'contradictory' }),
  skill('outdated', { self: track({ catalogOutdated: true }) }),
  skill('tracks', { self: track({ level: 1 }), review: track({ level: 4, state: 'reviewed' }), state: 'reviewed' }),
] });
(async () => {
  const { chromium } = process.env.PLAYWRIGHT_MODULE ? require(process.env.PLAYWRIGHT_MODULE) : await import('playwright');
  const base = process.env.ES30_PREVIEW_URL ?? 'http://127.0.0.1:4230';
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const exceptions = []; page.on('pageerror', error => exceptions.push(error.message));
  let data = fullMap(); let status = 200; let delay = 250; let html = false; let failNetwork = false;
  const calls = []; const checks = [];
  const check = label => { checks.push(label); console.log('PASS ' + label); };
  await page.route('**/api/**', async route => {
    const req = route.request(); const url = new URL(req.url());
    if (url.pathname === '/api/skill-map') {
      calls.push({ method: req.method(), query: url.search, body: req.postData(), authorization: req.headers().authorization });
      // Capture response before a delayed request to test out-of-order completions.
      const reply = structuredClone(data); const replyStatus = status;
      if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      if (failNetwork) return route.abort('failed');
      if (html) return route.fulfill({ status: 200, contentType: 'text/html', body: '<html>SPA fallback</html>' });
      return route.fulfill({ status: replyStatus, json: reply });
    }
    return route.fulfill({ json: ['/api/recommendations', '/api/messages'].includes(url.pathname) ? [] : {} });
  });
  const card = key => page.getByRole('article').filter({ has: page.getByRole('heading', { name: new RegExp(`^(Prueba|Test) ${key}$`) }) });
  try {
    await page.goto(base + '/app/skill-map'); await page.waitForURL('**/login'); assert.equal(calls.length, 0);
    check('protected route sends no request without a session');
    await page.evaluate(() => { localStorage.setItem('elevation_token', 'synthetic-token-a'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', 'es'); });
    await page.goto(base + '/app/skill-map');
    await page.getByText('Cargando tu mapa…', { exact: true }).waitFor();
    assert.ok(await page.getByRole('button', { name: 'Actualizar mapa' }).isDisabled());
    await card('current').waitFor(); assert.equal(await page.getByRole('article').count(), 6);
    check('loading, disabled duplicate refresh and valid API success');
    assert.deepEqual(await card('tracks').locator('[data-testid="skill-level"]').allTextContents(), ['Nivel 1', 'Nivel 4']);
    assert.deepEqual(await card('stale').locator('[data-testid="skill-level"]').allTextContents(), ['Sin evidencia vigente']);
    assert.equal(await card('stale').getByText('Confianza del respaldo', { exact: false }).count(), 0);
    assert.equal(await card('unknown').getByText('Nivel 0', { exact: true }).count(), 0);
    await card('contradictory').getByText('Requiere revisión humana', { exact: true }).first().waitFor();
    await card('outdated').getByText('Nivel registrado con una rúbrica anterior', { exact: false }).waitFor();
    check('null/stale never become zero or current levels; tracks separate; contradictions/outdated rubric explicit');
    assert.ok((await card('current').innerText()).includes('<img src=x'));
    assert.equal(await page.locator('.skill-map-scope img, .skill-map-scope svg, .skill-map-scope canvas').count(), 0);
    assert.equal(await page.evaluate(() => window.INJECTED), undefined);
    check('server text is escaped; no untrusted HTML execution or score/radar chart');
    const levels = await page.locator('[data-testid="skill-level"]').allTextContents();
    await page.getByRole('button', { name: 'EN', exact: true }).click();
    assert.deepEqual(await page.locator('[data-testid="skill-level"]').allTextContents(), levels.map(value => value.replace('Nivel', 'Level').replace('Sin evidencia vigente', 'No current evidence')));
    assert.equal(await page.locator('html').getAttribute('lang'), 'en');
    await card('current').locator('summary').click();
    await card('current').getByText('Synthetic criterion 2', { exact: false }).waitFor();
    await card('current').getByText('Source: Fuente sintética', { exact: false }).waitFor();
    check('ES/EN changes labels/criteria only; original source/rationale and numeric levels preserved');
    await page.keyboard.press('Tab'); await page.getByRole('link', { name: 'Skip to content' }).focus();
    assert.ok(await page.getByRole('link', { name: 'Skip to content' }).evaluate(element => getComputedStyle(element).outlineStyle !== 'none'));
    await page.keyboard.press('Enter'); assert.equal(await page.evaluate(() => document.activeElement.id), 'skill-map-main');
    for (const width of [320, 375, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'overflow at ' + width);
    }
    await page.setViewportSize({ width: 768, height: 1000 });
    await page.evaluate(() => { document.body.style.zoom = '200%'; });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.evaluate(() => { document.body.style.zoom = ''; });
    check('keyboard skip/focus, 320/375/768/1440, 200% zoom and reduced motion');
    if (process.env.ES30_SCREENSHOT_DIR) {
      fs.mkdirSync(process.env.ES30_SCREENSHOT_DIR, { recursive: true });
      await page.setViewportSize({ width: 375, height: 900 });
      await page.screenshot({ path: path.join(process.env.ES30_SCREENSHOT_DIR, 'es30-mobile-en.png'), fullPage: true });
      await page.getByRole('button', { name: 'ES', exact: true }).click();
      await page.setViewportSize({ width: 1280, height: 1000 });
      await page.screenshot({ path: path.join(process.env.ES30_SCREENSHOT_DIR, 'es30-desktop-es.png'), fullPage: true });
      await page.getByRole('button', { name: 'EN', exact: true }).click();
    }
    status = 500; data = { error: 'PRIVATE SERVER CANARY' };
    await page.getByRole('button', { name: 'Refresh map', exact: true }).click();
    assert.equal(await page.getByRole('article').count(), 0);
    await page.getByRole('alert').waitFor(); assert.ok(!(await page.locator('main').innerText()).includes('PRIVATE SERVER CANARY'));
    assert.equal(await page.getByRole('article').count(), 0);
    check('refresh failure removes prior current results and never exposes raw errors');
    for (const [code, body, expected] of [
      [503, { code: 'catalog_unavailable' }, 'The skills catalog is not available yet.'],
      [404, {}, 'Your map is not available yet.'], [200, { catalogVersion: 7, skills: 'invalid' }, 'We could not load your map.'],
    ]) {
      status = code; data = body;
      await page.getByRole('button', { name: 'Retry', exact: true }).click();
      await page.getByRole('alert').getByText(expected, { exact: true }).waitFor();
    }
    html = true; await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await page.getByRole('alert').getByText('Your map is not available yet.', { exact: true }).waitFor(); html = false;
    failNetwork = true; await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await page.getByRole('alert').getByText('We could not load your map.', { exact: true }).waitFor(); failNetwork = false;
    check('catalog 503, missing API/SPA HTML, malformed DTO and network failures remain distinct from empty success');
    status = 200; data = { catalogVersion: 7, skills: [] };
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await page.getByText('No skills are available in this catalog yet.', { exact: true }).waitFor();
    check('valid empty catalog has its own state');
    data = fullMap(); data.skills[0].labels = { es: 'Solo ES de prueba' };
    await page.getByRole('button', { name: 'Refresh map' }).click();
    await page.getByRole('heading', { name: 'Translation is not available in this language.', exact: true }).waitFor();
    check('missing translation is explicit without fabricating a translated label');
    status = 401; await page.getByRole('button', { name: 'Refresh map' }).click();
    await page.getByRole('link', { name: 'Sign in', exact: true }).waitFor();
    assert.equal(await page.getByRole('article').count(), 0);
    status = 403; await page.getByRole('button', { name: 'Refresh map' }).click();
    await page.getByText('You do not have access to this map.', { exact: true }).waitFor();
    check('401 requires sign-in and 403 never renders a private map');
    status = 200; data = fullMap(); delay = 1200;
    await page.getByRole('button', { name: 'Refresh map' }).click();
    await page.getByText('Loading your map…', { exact: true }).waitFor();
    await page.getByRole('link', { name: 'Back to dashboard', exact: true }).click();
    await page.waitForURL('**/app/dashboard');
    delay = 0; data = { catalogVersion: 8, skills: [] };
    await page.getByRole('button', { name: 'My map', exact: true }).click();
    await page.getByText('No skills are available in this catalog yet.', { exact: true }).waitFor();
    await page.waitForTimeout(1400);
    assert.equal(await page.getByRole('article').count(), 0);
    check('unmount aborts/ignores old response; dashboard link opens fresh map');
    await page.evaluate(() => {
      localStorage.removeItem('elevation_token');
      window.dispatchEvent(new StorageEvent('storage', { key: 'elevation_token' }));
    });
    await page.getByRole('link', { name: 'Sign in', exact: true }).click();
    await page.waitForURL('**/login');
    assert.ok(calls.every(call => call.method === 'GET' && !call.query && call.body === null && call.authorization === 'Bearer synthetic-token-a'));
    const privateKeys = await page.evaluate(() => Object.keys(localStorage).filter(key => /skill|map|evidence|rationale/i.test(key)));
    assert.deepEqual(privateKeys, []); assert.deepEqual(exceptions, []);
    check('session change clears map; only authenticated owner GET, no private persistent cache');
    console.log(`Browser checks: ${checks.length} passed; 0 console exceptions. HTTP is mocked; fixtures are wholly synthetic.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
