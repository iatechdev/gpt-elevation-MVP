// Isolated Chromium, mocked HTTP boundary, actual built React application.
// PLAYWRIGHT_MODULE may point at an existing installation; never uses a user profile.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
(async () => {
  const source = process.env.PLAYWRIGHT_MODULE;
  const { chromium } = source ? require(source) : await import('playwright');
  const base = process.env.ES14_PREVIEW_URL ?? 'http://127.0.0.1:4214';
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Local preview only');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const checks = [];
  const check = label => { checks.push(label); console.log('PASS ' + label); };
  let snapshot = { schemaVersion: 1, version: 0, context: null, savedAt: null, completedAt: null };
  let putStatus = 200; let getStatus = 200; let delay = 0;
  const writes = [];
  await page.addInitScript(() => {
    localStorage.setItem('elevation_token', 'synthetic-browser-token'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', 'es');
  });
  await page.route('**/api/**', async route => {
    const req = route.request(); const url = new URL(req.url());
    if (url.pathname === '/api/user/context') {
      if (req.method() === 'PUT') {
        const body = req.postDataJSON(); writes.push(body);
        if (delay) await new Promise(resolve => setTimeout(resolve, delay));
        if (putStatus !== 200) return route.fulfill({ status: putStatus, json: { error: putStatus === 409 ? 'context_conflict' : 'context_unavailable' } });
        snapshot = { schemaVersion: 1, version: snapshot.version + 1, context: body.context, savedAt: new Date().toISOString(), completedAt: body.action === 'continue' ? new Date().toISOString() : snapshot.completedAt };
        return route.fulfill({ json: snapshot });
      }
      return route.fulfill({ status: getStatus, json: getStatus === 200 ? snapshot : { error: 'context_unavailable' } });
    }
    if (url.pathname === '/api/login') return route.fulfill({ json: { token: 'synthetic-browser-token', role: 'user', name: 'Synthetic', onboardingCompleted: true } });
    return route.fulfill({ json: {} });
  });
  try {
    await page.goto(base + '/login');
    await page.locator('input[type="email"]').fill('synthetic@example.invalid');
    await page.locator('input[type="password"]').fill('synthetic-not-a-password');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/app/onboarding');
    await page.getByText('Sin contexto guardado', { exact: true }).waitFor();
    assert.equal(await page.locator('#preferredLanguage').inputValue(), '');
    assert.equal(await page.locator('#residenceCountry').inputValue(), '');
    assert.equal(await page.locator('#timeZone').inputValue(), '');
    await page.getByRole('button', { name: 'Guardar contexto', exact: true }).click();
    await page.getByRole('alert').waitFor(); assert.equal(writes.length, 0);
    check('empty defaults are unknown; continue requires explicit language and local entry');
    await page.getByRole('radio', { name: 'Mi siguiente paso', exact: true }).check();
    await page.locator('#preferredLanguage').selectOption('es');
    await page.locator('#residenceCountry').selectOption('CO'); await page.locator('#targetMarket').selectOption('ES');
    await page.locator('#timeZone').selectOption('America/Bogota');
    await page.locator('summary').click(); await page.locator('#profession').fill('Docencia sintética ñ');
    await page.locator('#availabilityMinutesPerWeek').fill('0');
    await page.getByRole('button', { name: 'EN', exact: true }).click();
    assert.equal(await page.locator('#profession').inputValue(), 'Docencia sintética ñ');
    assert.equal(await page.locator('#preferredLanguage').inputValue(), 'es');
    assert.equal(await page.locator('html').getAttribute('lang'), 'en');
    check('switching display ES/EN preserves values and does not infer preferred language');
    putStatus = 503;
    await page.getByRole('button', { name: 'Save progress', exact: true }).click();
    await page.getByText('We could not save. Your changes are still on this screen.').waitFor();
    assert.equal(await page.locator('#profession').inputValue(), 'Docencia sintética ñ');
    assert.equal(snapshot.version, 0); assert.equal(new URL(page.url()).pathname, '/app/onboarding');
    check('503 preserves the draft, never reports saved and never navigates');
    console.log('History index before Back: ' + await page.evaluate(() => window.history.state?.idx));
    assert.equal(await page.getByText('Unsaved changes', { exact: true }).count(), 1);
    page.once('dialog', dialog => dialog.dismiss()); await page.getByRole('button', { name: 'Back', exact: true }).click();
    assert.equal(new URL(page.url()).pathname, '/app/onboarding');
    page.once('dialog', async dialog => { console.log('Browser Back confirmation type: ' + dialog.type()); await dialog.dismiss(); });
    await page.evaluate(() => window.history.back());
    await page.waitForURL('**/app/onboarding');
    assert.equal(await page.locator('#profession').inputValue(), 'Docencia sintética ñ');
    check('cancelled Back button and browser Back keep the mounted draft');
    putStatus = 409;
    await page.getByRole('button', { name: 'Save progress', exact: true }).click();
    await page.getByText('A newer version is available. Reload before saving.').waitFor();
    assert.equal(await page.locator('#profession').inputValue(), 'Docencia sintética ñ');
    assert.equal(await page.getByRole('button', { name: 'Save progress', exact: true }).count(), 0);
    page.once('dialog', dialog => dialog.dismiss()); await page.getByRole('button', { name: 'Reload context', exact: true }).click();
    assert.equal(await page.locator('#profession').inputValue(), 'Docencia sintética ñ');
    check('409 preserves the draft and requires explicit reload without blind overwrite');
    page.once('dialog', dialog => dialog.accept()); await page.getByRole('button', { name: 'Reload context', exact: true }).click();
    await page.getByText('No saved context', { exact: true }).waitFor();
    putStatus = 200; delay = 350;
    await page.getByRole('radio', { name: 'My next step', exact: true }).check();
    await page.locator('#preferredLanguage').selectOption('en');
    await page.getByRole('button', { name: 'Save context', exact: true }).click();
    await page.getByText('Saving…', { exact: true }).waitFor();
    assert.ok(await page.locator('#preferredLanguage').isDisabled());
    await page.getByRole('heading', { name: 'Context saved', exact: true }).waitFor();
    assert.ok(snapshot.completedAt); assert.equal(new URL(page.url()).pathname, '/app/onboarding');
    assert.deepEqual(Object.keys(writes.at(-1)).sort(), ['action', 'context', 'expectedVersion', 'schemaVersion']);
    assert.ok(!Object.hasOwn(writes.at(-1).context, 'entry'));
    check('saving disables mutation; durable response confirms professional route without persisting entry');
    await page.getByRole('button', { name: 'Keep editing' }).click();
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'No overflow at ' + width);
    }
    await page.setViewportSize({ width: 640, height: 900 });
    await page.evaluate(() => { document.body.style.zoom = '200%'; });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'No overflow at 200% zoom');
    await page.evaluate(() => { document.body.style.zoom = ''; });
    await page.setViewportSize({ width: 320, height: 900 });
    await page.locator('#profession').isVisible();
    await page.keyboard.press('Tab');
    await page.getByRole('button', { name: 'EN', exact: true }).focus();
    assert.ok(await page.getByRole('button', { name: 'EN', exact: true }).evaluate(element => getComputedStyle(element).outlineStyle !== 'none'));
    check('responsive 320/768/1440, 200% zoom, reduced motion and visible keyboard focus');
    const output = process.env.ES14_SCREENSHOT_DIR;
    if (output) {
      fs.mkdirSync(output, { recursive: true });
      await page.screenshot({ path: path.join(output, 'es14-mobile-en.png'), fullPage: true });
      await page.setViewportSize({ width: 1280, height: 1000 });
      await page.getByRole('button', { name: 'ES', exact: true }).click();
      await page.screenshot({ path: path.join(output, 'es14-desktop-es.png'), fullPage: true });
    }
    await page.getByRole('button', { name: 'ES', exact: true }).click();
    await page.reload();
    await page.getByText('Contexto guardado', { exact: true }).waitFor();
    assert.equal(await page.locator('#preferredLanguage').inputValue(), 'en');
    assert.equal(await page.getByRole('radio', { checked: true }).count(), 0);
    check('reload recovers durable context but never a persisted entry mode');
    await page.getByRole('radio', { name: 'Quiero avanzar pronto' }).check();
    await page.locator('summary').click();
    const writesBeforeInvalid = writes.length;
    await page.locator('#availabilityMinutesPerWeek').fill('1.5');
    await page.getByRole('button', { name: 'Guardar avance', exact: true }).click();
    await page.getByRole('alert').waitFor(); assert.equal(writes.length, writesBeforeInvalid);
    await page.locator('#availabilityMinutesPerWeek').fill('0');
    await page.getByRole('button', { name: 'Guardar contexto', exact: true }).click();
    await page.getByRole('heading', { name: 'Contexto guardado', exact: true }).waitFor();
    assert.equal(snapshot.context.availabilityMinutesPerWeek, 0);
    check('career urgency saves without an intimate narrative; fractional minutes never sent');
    await page.getByRole('button', { name: 'Seguir editando', exact: true }).click();
    await page.getByRole('radio', { name: 'Mi espacio', exact: true }).check();
    await page.getByRole('button', { name: 'Guardar y continuar', exact: true }).click();
    await page.waitForURL('**/app/dashboard');
    await page.getByRole('button', { name: 'Mi contexto', exact: true }).click();
    await page.waitForURL('**/app/onboarding');
    await page.getByText('Contexto guardado', { exact: true }).waitFor();
    check('personal entry reaches existing dashboard after save; My context reopens same resource');
    // QA-14-03: solo las opciones de entrada están dentro de un fieldset con leyenda; los demás campos no heredan esa pregunta.
    await page.locator('summary').click();
    await page.locator('#profession').fill('Cambio sin guardar');
    const structure = await page.evaluate(() => ({
      controlsInFieldset: [...document.querySelectorAll('select, textarea, input[type=number]')].filter(element => element.closest('fieldset')).length,
      legends: [...document.querySelectorAll('legend')].map(legend => legend.textContent),
      radiosInGroup: document.querySelector('fieldset')?.querySelectorAll('input').length ?? 0,
      fieldsets: document.querySelectorAll('fieldset').length,
    }));
    assert.deepEqual(structure, { controlsInFieldset: 0, legends: ['¿Por dónde quieres empezar?'], radiosInGroup: 3, fieldsets: 1 });
    check('only the entry radios sit inside the fieldset with the legend; other fields are outside it');
    // QA-14-04: si la sesión vence al guardar, el aviso dice que los cambios sin guardar se perderán (ES y EN).
    putStatus = 401;
    await page.getByRole('button', { name: 'Guardar avance', exact: true }).click();
    await page.getByText('Sesión vencida. Inicia sesión para continuar. Los cambios sin guardar se perderán.').waitFor();
    putStatus = 200; await page.reload();
    await page.getByText('Contexto guardado', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'EN', exact: true }).click();
    await page.locator('summary').click();
    await page.locator('#profession').fill('Unsaved change');
    putStatus = 401;
    await page.getByRole('button', { name: 'Save progress', exact: true }).click();
    await page.getByText('Session expired. Sign in to continue. Unsaved changes will be lost.').waitFor();
    putStatus = 200; await page.reload();
    await page.getByRole('button', { name: 'ES', exact: true }).click();
    check('expiry while saving warns that unsaved changes will be lost (ES and EN)');
    getStatus = 503; await page.reload();
    await page.getByText('No pudimos cargar tu contexto.').waitFor();
    assert.equal(await page.locator('form').count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Guardar avance', exact: true }).count(), 0);
    check('load failure blocks form and prevents blank overwrites');
    getStatus = 401; await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
    await page.getByText('Sesión vencida. Inicia sesión para continuar.').waitFor();
    assert.ok(!(await page.locator('body').innerText()).includes('perderán')); // vencida al cargar: no hay nada que perder
    check('expired session requires sign-in');
    assert.deepEqual(errors, []);
    console.log(`Browser checks: ${checks.length} passed, 0 console exceptions. HTTP is mocked.`);
  } catch (error) { console.error('Browser failure URL: ' + new URL(page.url()).pathname); throw error; }
  finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
