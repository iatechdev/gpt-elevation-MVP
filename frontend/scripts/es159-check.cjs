// ES-159: /app/checkin («Hoy») y /app/onboarding («Tu punto de partida») con Cartografía en el marco de persona. Chromium, API simulada (page.route), datos sintéticos.
// Mide: marco (un h1, un main, menú), escala de cinco palabras sin emojis con teclado, guardado (mood 1–5), error que conserva la respuesta, sin doble envío, sesión vencida,
// aviso de apoyo solo con «Cargado»/«Bajo» (servicios de ayuda del servidor, país de residencia, sin lista = sin número), y el punto de partida (axe, guardado de borrador, sesión vencida).
// Uso: npx vite build && npx vite preview --host 127.0.0.1 --port 4159 --strictPort   y luego
//   ES159_URL=http://127.0.0.1:4159 PLAYWRIGHT_MODULE=<ruta a playwright> AXE_PATH=<axe.min.js> node scripts/es159-check.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');

(async () => {
  const { chromium } = process.env.PLAYWRIGHT_MODULE ? require(process.env.PLAYWRIGHT_MODULE) : await import('playwright');
  const base = process.env.ES159_URL ?? 'http://127.0.0.1:4159';
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Solo vista previa local');
  const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8');
  const browser = await chromium.launch({ headless: true });
  const errors = []; let count = 0;
  const check = (label) => { count++; console.log('PASS ' + label); };
  const T = {
    es: { save: 'Guardar y pasar a la conversación', skip: 'Saltar por hoy', need: 'Elige una opción para guardarla', errTitle: 'No pudimos guardar tu registro', retry: 'Reintentar', go: 'Pasar sin guardar', saved: 'Registro guardado.', cont: 'Pasar a la conversación', support: 'Un aviso de apoyo', services: 'Servicios de ayuda de tu país', words: ['Cargado', 'Bajo', 'Regular', 'Bien', 'Con energía'], foot: 'No es terapia ni diagnóstico' },
    en: { save: 'Save and go to the conversation', skip: 'Skip for today', need: 'Pick an option to save it', errTitle: 'We could not save your check-in', retry: 'Retry', go: 'Continue without saving', saved: 'Check-in saved.', cont: 'Go to the conversation', support: 'A note of support', services: 'Help services in your country', words: ['Weighed down', 'Low', 'So-so', 'Good', 'Energised'], foot: 'It is not therapy or diagnosis' },
  };
  const ENTRY = { id: 1, country: 'CO', name: 'Servicio de prueba', contact: 'dato-de-prueba', description: { es: 'Descripción de prueba', en: 'Test description' } };

  async function open(route, width, lang, scheme, opts = {}) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const seen = { mood: [], entries: [], context: 0, put: [] };
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
    await page.addInitScript(([l]) => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l); }, [lang]);
    await page.route('**/api/**', async (route2) => {
      const request = route2.request(); const url = new URL(request.url()); const p = url.pathname;
      if (p === '/api/session') return route2.fulfill({ json: { role: 'user', onboardingCompleted: true } });
      if (p === '/api/mood/checkin') {
        seen.mood.push(JSON.parse(request.postData() ?? '{}').mood);
        const status = typeof opts.moodStatus === 'function' ? opts.moodStatus(seen.mood.length) : (opts.moodStatus ?? 200);
        if (opts.moodDelay) await new Promise((r) => setTimeout(r, opts.moodDelay));
        return route2.fulfill({ status, json: status === 200 ? { message: 'ok' } : { error: 'x' } });
      }
      if (p === '/api/contact-entries') { seen.entries.push(url.searchParams.get('country')); return route2.fulfill({ status: opts.entriesStatus ?? 200, json: { entries: opts.entries ?? [ENTRY] } }); }
      if (p === '/api/user/context') {
        if (request.method() === 'PUT') { seen.put.push(JSON.parse(request.postData() ?? '{}').action); return route2.fulfill({ status: opts.putStatus ?? 200, json: { schemaVersion: 2, version: 1, context: { ...CTX(opts.residence ?? null), preferredLanguage: lang }, savedAt: '2026-11-12T10:00:00Z', completedAt: null } }); }
        seen.context += 1;
        return route2.fulfill({ json: { schemaVersion: 2, version: opts.version ?? 0, context: (opts.version ?? 0) === 0 ? null : CTX(opts.residence ?? null), savedAt: (opts.version ?? 0) === 0 ? null : '2026-11-12T10:00:00Z', completedAt: null } });
      }
      if (p === '/api/consents') return route2.fulfill({ json: { consents: [] } });
      return route2.fulfill({ json: [] });
    });
    await page.goto(base + route, { waitUntil: 'networkidle' });
    return { context, page, seen };
  }
  const CTX = (residence) => ({ preferredLanguage: null, residenceCountry: residence, targetMarket: null, timeZone: null, profession: null, interests: null, availabilityMinutesPerWeek: null, careerGoal: null, careerConstraints: null, sector: null, totalYearsExperience: null, experience: [], education: [], declaredSkills: [], languages: [] });
  const axe = async (page) => { await page.evaluate(axeSource); return page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] })).violations.map((v) => v.id + ':' + v.nodes.length)); };
  const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const radio = (page, n) => page.locator(`input[name="mood"][value="${n}"]`);
  const pick = (page, n) => page.locator('.ck-option').nth(n - 1).click();

  // 1. Hoy: marco, escala, teclado, vacío, guardar 3 → conversación, axe, ES/EN × 390/1360 × claro/oscuro
  for (const [width, lang, scheme] of [[390, 'es', 'light'], [390, 'en', 'dark'], [1360, 'es', 'dark'], [1360, 'en', 'light']]) {
    const tag = `${width}px ${lang} ${scheme}`; const c = T[lang];
    const { context, page, seen } = await open('/app/checkin', width, lang, scheme);
    assert.equal(await page.locator('h1').count(), 1, `un h1 (${tag})`);
    assert.equal(await page.locator('main#main').count(), 1, `un main (${tag})`);
    assert.ok(await page.locator('header.cg-header nav a').count() >= 1, `menú del marco (${tag})`);
    assert.match(await page.locator('footer').innerText(), new RegExp(c.foot, 'i'), `pie con el aviso (${tag})`);
    assert.equal(await page.locator('input[name="mood"]').count(), 5, `cinco opciones (${tag})`);
    const text = await page.locator('main').textContent();
    assert.ok(!/\p{Extended_Pictographic}/u.test(text), `sin emojis (${tag})`);
    for (const word of c.words) assert.ok(text.includes(word), `palabra «${word}» (${tag})`);
    assert.ok((await overflow(page)) <= 0, `sin desborde (${tag})`);
    assert.deepEqual(await axe(page), [], `axe inicial (${tag})`);
    // teclado: Tab entra una vez al grupo; las flechas cambian la opción
    await page.locator('input[name="mood"]').first().focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
    assert.equal(await radio(page, 3).isChecked(), true, `las flechas cambian la opción (${tag})`);
    // vacío: guardar sin elegir → mensaje y foco al primer radio (se recarga para empezar sin elección)
    await page.reload({ waitUntil: 'networkidle' }); seen.entries.length = 0; // las flechas pasaron por «Bajo» (2): eso sí pidió servicios de ayuda
    await page.getByRole('button', { name: c.save }).click();
    await page.getByRole('alert').filter({ hasText: c.need }).waitFor();
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('name')), 'mood', `foco a la escala (${tag})`);
    assert.equal(seen.mood.length, 0, `sin elección no se envía nada (${tag})`);
    assert.deepEqual(await axe(page), [], `axe con error de campo (${tag})`);
    // guardar 3 → POST mood 3 → conversación
    await pick(page, 3); await page.getByRole('button', { name: c.save }).click();
    await page.waitForURL('**/app/chat'); assert.deepEqual(seen.mood, [3], `se guarda 3 (${tag})`);
    assert.equal(seen.entries.length, 0, `sin aviso de apoyo no se piden servicios de ayuda (${tag})`);
    await context.close();
    check(`Hoy (${tag}): marco, cinco palabras sin emojis, teclado, vacío con foco, guardar 3, axe 0`);
  }

  // 2. Escala completa: 1 y 5 se guardan (antes 1 fallaba con 400)
  for (const n of [1, 5]) {
    const { context, page, seen } = await open('/app/checkin', 1360, 'es', 'light');
    await pick(page, n); await page.getByRole('button', { name: T.es.save }).click();
    if (n === 5) await page.waitForURL('**/app/chat');
    else await page.getByText(T.es.saved).waitFor();
    assert.deepEqual(seen.mood, [n], `se guarda ${n}`);
    await context.close();
  }
  check('Hoy: los valores 1 y 5 llegan al servidor tal cual (la escala anterior enviaba 0–4)');

  // 3. Aviso de apoyo: aparece con 1 y 2, no con 3–5; servicios del servidor; sin lista = genérico sin número; error = genérico; país de residencia
  for (const [lang, scheme] of [['es', 'light'], ['en', 'dark']]) {
    const c = T[lang]; const tag = `${lang} ${scheme}`;
    { const { context, page, seen } = await open('/app/checkin', 1360, lang, scheme, { residence: 'DK', version: 1 });
      await pick(page, 4); assert.equal(await page.getByText(c.support).count(), 0, `sin aviso con «Bien» (${tag})`);
      await pick(page, 2); await page.getByText(c.support).waitFor(); await page.getByText('dato-de-prueba').waitFor();
      assert.ok(await page.getByText(lang === 'es' ? 'Descripción de prueba' : 'Test description').count() >= 1, `descripción en el idioma (${tag})`);
      assert.deepEqual(seen.entries, ['DK'], `país = residencia del punto de partida (${tag})`);
      assert.ok(await page.getByText(c.services).count() >= 1);
      assert.deepEqual(await axe(page), [], `axe con aviso (${tag})`);
      await page.getByRole('button', { name: c.save }).click(); await page.getByText(c.saved).waitFor();
      assert.equal(await page.getByText(c.support).count(), 1, `el aviso sigue a la vista tras guardar (${tag})`);
      await page.getByRole('button', { name: c.cont }).click(); await page.waitForURL('**/app/chat'); await context.close(); }
    { const { context, page, seen } = await open('/app/checkin', 390, lang, scheme, { entries: [] });
      await pick(page, 1); await page.getByText(c.support).waitFor();
      await page.waitForFunction(() => !document.body.innerText.match(/Buscando|Looking for/));
      assert.equal(await page.getByText(c.services).count(), 0, `sin entradas no hay lista (${tag})`);
      const notice = await page.locator('.cg-banner').innerText(); assert.ok(!/\d{3,}/.test(notice), `ningún número escrito (${tag}): ${notice}`);
      assert.deepEqual(seen.entries, ['CO'], `sin país de residencia se usa el predeterminado (${tag})`);
      await context.close(); }
    { const { context, page } = await open('/app/checkin', 390, lang, scheme, { entriesStatus: 500 });
      await pick(page, 2); await page.getByText(c.support).waitFor();
      await page.getByText(/No pudimos cargar los servicios|We could not load the help services/).waitFor();
      await context.close(); }
    check(`aviso de apoyo (${tag}): solo con «Cargado»/«Bajo», servicios del servidor por país, sin lista o con error queda el texto genérico sin número`);
  }

  // 4. Error que conserva la respuesta, reintento, pasar sin guardar, sin doble envío, sesión vencida
  for (const [lang, scheme] of [['es', 'light'], ['en', 'dark']]) {
    const c = T[lang]; const tag = `${lang} ${scheme}`;
    { const { context, page, seen } = await open('/app/checkin', 1360, lang, scheme, { moodStatus: (n) => (n === 1 ? 500 : 200) });
      await pick(page, 4); await page.getByRole('button', { name: c.save }).click();
      const alert = page.getByRole('alert').filter({ hasText: c.errTitle }); await alert.waitFor();
      assert.equal(await radio(page, 4).isChecked(), true, `la respuesta se conserva (${tag})`);
      assert.equal(await page.evaluate(() => document.activeElement?.className.includes('ck-error-box')), true, `foco al aviso de error (${tag})`);
      assert.deepEqual(await axe(page), [], `axe con error (${tag})`);
      await page.getByRole('button', { name: c.retry }).click(); await page.waitForURL('**/app/chat');
      assert.deepEqual(seen.mood, [4, 4], `el reintento envía lo mismo (${tag})`); await context.close(); }
    { const { context, page } = await open('/app/checkin', 390, lang, scheme, { moodStatus: 400 });
      await pick(page, 1); await page.getByRole('button', { name: c.save }).click(); await page.getByRole('alert').filter({ hasText: c.errTitle }).waitFor();
      await page.getByRole('button', { name: c.go }).click(); await page.waitForURL('**/app/chat'); await context.close(); }
    { const { context, page, seen } = await open('/app/checkin', 1360, lang, scheme, { moodDelay: 400 });
      await pick(page, 5); const button = page.getByRole('button', { name: c.save });
      await button.click(); await page.locator('form button[type="submit"]').first().click({ force: true, noWaitAfter: true }).catch(() => undefined);
      await page.waitForURL('**/app/chat'); assert.deepEqual(seen.mood, [5], `un solo envío aunque se pulse dos veces (${tag})`); await context.close(); }
    { const { context, page } = await open('/app/checkin', 1360, lang, scheme, { moodStatus: 401 });
      await pick(page, 3); await page.getByRole('button', { name: c.save }).click(); await page.waitForURL('**/login**'); await context.close(); }
    { const { context, page } = await open('/app/checkin', 1360, lang, scheme);
      await page.getByRole('button', { name: c.skip }).click(); await page.waitForURL('**/app/chat'); await context.close(); }
    check(`Hoy (${tag}): error conserva la respuesta con foco y reintento, «${c.go}», un solo envío, sesión vencida → entrar, «${c.skip}»`);
  }

  // 5. Punto de partida: marco, axe, borrador, conflicto y sesión vencida
  for (const [width, lang, scheme] of [[390, 'es', 'dark'], [1360, 'en', 'light']]) {
    const tag = `${width}px ${lang} ${scheme}`;
    const { context, page, seen } = await open('/app/onboarding', width, lang, scheme);
    await page.locator('form').waitFor();
    assert.equal(await page.locator('h1').count(), 1, `un h1 (${tag})`);
    assert.equal(await page.locator('main#main').count(), 1, `un main (${tag})`);
    assert.equal(await page.locator('.cg-onboarding').count(), 1, `tema de Cartografía (${tag})`);
    assert.ok((await overflow(page)) <= 0, `sin desborde (${tag})`);
    assert.deepEqual(await axe(page), [], `axe punto de partida (${tag})`);
    await page.locator('input[name="entry"]').first().check();
    await page.getByRole('button', { name: lang === 'es' ? 'Guardar avance' : 'Save progress' }).click();
    await page.waitForFunction(() => /avance guardado|progress saved/i.test(document.body.innerText));
    assert.deepEqual(seen.put, ['save_draft'], `se guarda el borrador (${tag})`);
    assert.deepEqual(await axe(page), [], `axe tras guardar borrador (${tag})`);
    await context.close();
    { const r = await open('/app/onboarding', width, lang, scheme, { putStatus: 401 });
      await r.page.locator('form').waitFor(); await r.page.locator('input[name="entry"]').first().check();
      await r.page.getByRole('button', { name: lang === 'es' ? 'Guardar avance' : 'Save progress' }).click();
      await r.page.getByRole('alert').filter({ hasText: /venci|expired/i }).waitFor();
      assert.deepEqual(await axe(r.page), [], `axe sesión vencida (${tag})`); await r.context.close(); }
    { const r = await open('/app/onboarding', width, lang, scheme, { putStatus: 409 });
      await r.page.locator('form').waitFor(); await r.page.locator('input[name="entry"]').first().check();
      await r.page.getByRole('button', { name: lang === 'es' ? 'Guardar avance' : 'Save progress' }).click();
      await r.page.getByRole('button', { name: lang === 'es' ? 'Recargar contexto' : 'Reload context' }).waitFor(); await r.context.close(); }
    check(`punto de partida (${tag}): marco, tema, sin desborde, axe 0, borrador, sesión vencida y conflicto`);
  }

  assert.deepEqual(errors, [], 'errores de consola o de página: ' + errors.join(' | '));
  console.log(`\nES-159: ${count} comprobaciones OK`);
  await browser.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
