// ES-122: disponibilidad semanal en horas en el formulario de contexto (/app/onboarding). Navegador real (Chromium aislado), servidor simulado, datos sintéticos.
//   npm run build && npx vite preview --port 4122 --host 127.0.0.1   y luego   PLAYWRIGHT_MODULE=... node scripts/es122-browser.cjs
const assert = require('node:assert/strict');
(async () => {
  const source = process.env.PLAYWRIGHT_MODULE;
  const { chromium } = source ? require(source) : await import('playwright');
  const base = process.env.ES122_URL ?? 'http://127.0.0.1:4122';
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Solo vista previa local');
  const browser = await chromium.launch({ headless: true });
  const checks = []; const check = (label) => { checks.push(label); console.log('PASS ' + label); };
  const errors = [];
  const ctx = (minutes) => ({ preferredLanguage: 'es', residenceCountry: 'CO', targetMarket: 'ES', timeZone: 'America/Bogota', profession: null, interests: null, availabilityMinutesPerWeek: minutes, careerGoal: null, careerConstraints: null,
    sector: null, totalYearsExperience: null, experience: [], education: [], declaredSkills: [], languages: [] });
  const state = { snapshot: null, writes: [] };
  const reset = (minutes) => { state.writes = []; state.snapshot = minutes === undefined ? { schemaVersion: 2, version: 0, context: null, savedAt: null, completedAt: null } : { schemaVersion: 2, version: 1, context: ctx(minutes), savedAt: '2026-10-29T12:00:00.000Z', completedAt: null }; };

  async function open(width, lang = 'es') {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
    await page.addInitScript((l) => { localStorage.setItem('elevation_token', 'synthetic-browser-token'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l); }, lang);
    await page.route('**/api/**', async (route) => {
      const req = route.request(); const p = new URL(req.url()).pathname;
      if (p === '/api/user/context') {
        if (req.method() === 'PUT') { const body = req.postDataJSON(); state.writes.push(body); state.snapshot = { schemaVersion: 2, version: state.snapshot.version + 1, context: body.context, savedAt: new Date().toISOString(), completedAt: body.action === 'continue' ? new Date().toISOString() : state.snapshot.completedAt }; return route.fulfill({ json: state.snapshot }); }
        return route.fulfill({ json: state.snapshot });
      }
      if (p === '/api/consents') return route.fulfill({ json: { consents: [{ purpose: 'necessary', status: 'granted' }, { purpose: 'resume_ai_reading', status: 'undecided' }] } });
      if (p === '/api/user/resumes') return route.fulfill({ json: { resumes: [] } });
      return route.fulfill({ json: {} });
    });
    await page.goto(base + '/app/onboarding', { waitUntil: 'networkidle' });
    await page.locator('summary').first().waitFor({ timeout: 8000 });
    await page.locator('summary').first().click();
    return { context, page };
  }
  const field = (page) => page.locator('#availabilityMinutesPerWeek');
  const save = (page, name = 'Guardar avance') => page.getByRole('button', { name, exact: true }).click();

  // 1 Rótulo, ayuda y atributos accesibles (ES)
  reset(); let { context, page } = await open(1100);
  assert.equal(await page.getByLabel('Disponibilidad (horas por semana)').count(), 1); assert.equal(await page.getByLabel(/minutos/i).count(), 0); check('el campo se rotula «Disponibilidad (horas por semana)» y ya no habla de minutos');
  const help = await page.locator('#minutes-help').innerText(); assert.match(help, /de 0 a 168/); assert.match(help, /7,5/); assert.doesNotMatch(help, /10080|minutos/); check('la ayuda explica 0 a 168 horas con un ejemplo');
  assert.equal(await field(page).getAttribute('aria-describedby'), 'minutes-help'); assert.equal(await field(page).getAttribute('inputmode'), 'decimal'); check('la ayuda está asociada al campo y el teclado móvil es decimal');
  assert.equal(await field(page).inputValue(), ''); check('sin dato, el campo queda vacío (por confirmar)');

  // 2 Escribir horas guarda minutos
  await field(page).fill('7,5'); await save(page); await page.getByText(/Avance guardado|guardado/i).first().waitFor();
  assert.equal(state.writes.at(-1).context.availabilityMinutesPerWeek, 450); check('7,5 horas (con coma) se guardan como 450 minutos');
  await field(page).fill('10'); await save(page); await page.waitForFunction(() => true); await page.waitForTimeout(300);
  assert.equal(state.writes.at(-1).context.availabilityMinutesPerWeek, 600); check('10 horas se guardan como 600 minutos');
  await field(page).fill('7.5'); await save(page); await page.waitForTimeout(300); assert.equal(state.writes.at(-1).context.availabilityMinutesPerWeek, 450); check('el punto decimal también vale');
  await field(page).fill(''); await save(page); await page.waitForTimeout(300); assert.equal(state.writes.at(-1).context.availabilityMinutesPerWeek, null); check('vacío se guarda como «por confirmar» (null)');

  // 3 Valores inválidos: no se envía nada y se explica
  for (const bad of ['200', '168.5', 'abc', '-3', '1,234', '7h']) {
    const before = state.writes.length; await field(page).fill(bad); await save(page);
    await page.getByRole('alert').first().waitFor(); assert.equal(state.writes.length, before, `se envió «${bad}»`); assert.equal(await field(page).getAttribute('aria-invalid'), 'true', bad);
  }
  check('200, 168,5, abc, −3, 1,234 y 7h se rechazan: no se envía nada y el campo queda marcado como inválido');
  await field(page).fill('168'); const before168 = state.writes.length; await save(page); await page.waitForTimeout(300); assert.equal(state.writes.length, before168 + 1); assert.equal(state.writes.at(-1).context.availabilityMinutesPerWeek, 10080); check('168 horas (el tope) se guarda como 10 080 minutos');
  await field(page).fill('abc'); await save(page); await page.getByRole('alert').first().waitFor(); await field(page).fill('5'); assert.notEqual(await field(page).getAttribute('aria-invalid'), 'true'); check('corregir el valor quita el error del campo');
  await context.close();

  // 4 Lo ya guardado se muestra en horas y no cambia si no se toca
  reset(100); ({ context, page } = await open(1100));
  assert.equal(await field(page).inputValue(), '1.67'); check('100 minutos guardados se muestran como 1.67 horas');
  await save(page); await page.waitForTimeout(300); assert.equal(state.writes.at(-1).context.availabilityMinutesPerWeek, 100); check('guardar sin tocar el campo conserva los 100 minutos exactos');
  await context.close(); reset(2400); ({ context, page } = await open(1100)); assert.equal(await field(page).inputValue(), '40'); check('2400 minutos se muestran como 40 horas'); await context.close();

  // 5 Responsive y EN
  for (const width of [375, 320]) {
    reset(); ({ context, page } = await open(width)); const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 0, `desborda ${overflow}px a ${width}`); const box = await field(page).boundingBox(); assert.ok(box.height >= 40, `altura ${box.height}`); await context.close();
  }
  check('a 375 y 320 px no hay desborde y el campo tiene altura táctil');
  reset(); ({ context, page } = await open(1100, 'en'));
  assert.equal(await page.getByLabel('Availability (hours per week)').count(), 1); assert.match(await page.locator('#minutes-help').innerText(), /from 0 to 168/i); await field(page).fill('7.5'); await save(page, 'Save progress'); await page.waitForTimeout(300); assert.equal(state.writes.at(-1).context.availabilityMinutesPerWeek, 450); check('inglés: rótulo, ayuda y guardado en minutos'); await context.close();

  assert.deepEqual(errors, [], 'errores de consola: ' + errors.join(' | ')); check('sin errores de consola');
  await browser.close(); console.log(`\n${checks.length} comprobaciones OK`);
})().catch((e) => { console.error('FAIL', e.message || e); process.exit(1); });
