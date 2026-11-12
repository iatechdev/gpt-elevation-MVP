// ES-265 (2.º PR): 401 con texto sin guardar en la ficha (nota de seguimiento) y en la sala (nota en vivo y cierre) → aviso con «Entrar», el texto sigue en pantalla,
// «Entrar» invalida la sesión y lleva a /login; 401 sin texto → /login directo. API simulada con page.route (solo el navegador y el front son reales).
// Uso: npx vite build && npx vite preview --host 127.0.0.1 --port 4266 --strictPort   y luego
//   ES265N_URL=http://127.0.0.1:4266 PLAYWRIGHT_MODULE=<ruta a playwright> AXE_PATH=<axe.min.js> node scripts/es265-nota-check.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');

(async () => {
  const { chromium } = process.env.PLAYWRIGHT_MODULE ? require(process.env.PLAYWRIGHT_MODULE) : await import('playwright');
  const base = process.env.ES265N_URL ?? 'http://127.0.0.1:4266';
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Solo vista previa local');
  const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8');
  const browser = await chromium.launch({ headless: true });
  const errors = []; let count = 0;
  const check = (label) => { count++; console.log('PASS ' + label); };
  const T = {
    es: { warn: /Tu sesión venció\. Tu nota no se guardó/, enter: 'Entrar', neu: 'Nueva nota', save: 'Guardar', textLabel: 'Texto' },
    en: { warn: /Your session has expired\. Your note was not saved/, enter: 'Sign in', neu: 'New note', save: 'Save', textLabel: 'Text' },
  };
  const history = { patient: { id: 7, name: 'Persona Sintética', email: 'sintetica@example.test', createdAt: '2026-10-01T00:00:00Z' }, moodLogs: [], ratings: [], notes: [] };
  const session = { id: 9, patientId: 7, patientName: 'Persona Sintética', sharing: true, scheduledAt: '2026-11-12T15:00:00Z', duration: 50, status: 'in_progress', startedAt: '2026-11-12T15:00:00Z' };

  // opts: { notesPost: status, startStatus: status, listStatus: status, historyStatus: status }
  async function open(width, lang, path, opts = {}) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|frame-ancestors|Refused to frame/.test(m.text())) errors.push(m.text()); });
    await page.addInitScript(([l]) => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'therapist'); } localStorage.setItem('elv_lang', l); }, [lang]);
    await page.route('**/api/**', (route) => {
      const url = new URL(route.request().url()); const p = url.pathname; const m = route.request().method();
      if (p === '/api/session') return route.fulfill({ json: { role: 'therapist', onboardingCompleted: true } });
      if (p === '/api/therapist/pacientes/7/historia') return opts.historyStatus ? route.fulfill({ status: opts.historyStatus, json: {} }) : route.fulfill({ json: history });
      if (p === '/api/therapist/pacientes/7/notas' && m === 'POST') return route.fulfill({ status: opts.notesPost ?? 201, json: { error: 'x' } });
      if (p === '/api/sessions/therapist/9/start') return opts.startStatus ? route.fulfill({ status: opts.startStatus, json: {} }) : route.fulfill({ json: { meetingUrl: base + '/robots.txt', startedAt: session.startedAt } });
      if (p === '/api/sessions/therapist/9/notes' && m === 'POST') return route.fulfill({ status: opts.liveNotePost ?? 200, json: { note: { version: 1 } } });
      if (p === '/api/sessions/therapist/9/notes') return route.fulfill({ json: [] });
      if (p === '/api/sessions/therapist/9/end') return route.fulfill({ status: opts.endStatus ?? 200, json: {} });
      if (p === '/api/sessions/therapist') return opts.listStatus ? route.fulfill({ status: opts.listStatus, json: {} }) : route.fulfill({ json: [session] });
      if (p === '/api/therapist/pacientes/7/resumen-ia') return route.fulfill({ status: 404, json: {} });
      return route.fulfill({ json: [] });
    });
    await page.goto(base + path, { waitUntil: 'networkidle' });
    return { context, page };
  }
  const axe = async (page) => { await page.evaluate(axeSource); return page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] })).violations.map((v) => v.id + ':' + v.nodes.length)); };
  const tokenOf = (page) => page.evaluate(() => localStorage.getItem('elevation_token'));

  for (const [width, lang] of [[390, 'es'], [390, 'en'], [1360, 'es'], [1360, 'en']]) {
    const tag = `${width}px ${lang}`; const c = T[lang];

    // Ficha: nota de seguimiento con texto → 401 → aviso, texto intacto, «Entrar» → /login
    {
      const { context, page } = await open(width, lang, '/therapist/patient/7', { notesPost: 401 });
      await page.getByRole('button', { name: c.neu }).click();
      const area = page.locator('#fu-text'); await area.fill('Texto que no se debe perder');
      await page.getByRole('button', { name: c.save, exact: true }).click();
      const alert = page.locator('#fu-problem'); await alert.getByText(c.warn).waitFor();
      assert.equal(await area.inputValue(), 'Texto que no se debe perder', `el texto sigue (${tag})`);
      assert.equal(await tokenOf(page), 't', `la sesión no se cierra sola (${tag})`);
      assert.deepEqual(await axe(page), [], `axe aviso ficha (${tag})`);
      const enter = alert.getByRole('button', { name: c.enter, exact: true });
      assert.ok((await enter.boundingBox()).height >= 44, `«Entrar» ≥ 44 px (${tag})`);
      await enter.click(); await page.waitForURL('**/login', { timeout: 8000 });
      assert.equal(await tokenOf(page), null, `«Entrar» borra el token (${tag})`);
      await context.close();
    }
    check(`ficha, nota con texto + 401 (${tag}): aviso, texto intacto, sesión viva hasta «Entrar», axe 0, ≥ 44 px, luego /login`);

    // Ficha: 401 al cargar → /login directo
    {
      const { context, page } = await open(width, lang, '/therapist/patient/7', { historyStatus: 401 });
      await page.waitForURL('**/login', { timeout: 8000 });
      assert.equal(await tokenOf(page), null);
      await context.close();
    }
    check(`ficha, 401 al cargar (${tag}): /login directo`);

    // Sala: 401 al iniciar → /login directo (sin texto)
    {
      const { context, page } = await open(width, lang, '/therapist/session/9', { startStatus: 401 });
      await page.waitForURL('**/login', { timeout: 8000 });
      await context.close();
    }
    check(`sala, 401 al iniciar (${tag}): /login directo`);

    // Sala: nota en vivo con texto → 401 al autoguardar → aviso con «Entrar», sin «Guardar ahora», texto intacto
    {
      const { context, page } = await open(width, lang, '/therapist/session/9', { liveNotePost: 401 });
      const live = page.locator('#sr-live-notes'); await live.waitFor(); await page.waitForFunction(() => !document.querySelector('#sr-live-notes').disabled);
      await live.fill('Nota en vivo importante');
      const status = page.locator('#sr-note-status'); await status.getByText(c.warn).waitFor({ timeout: 8000 });
      assert.equal(await live.inputValue(), 'Nota en vivo importante', `la nota en vivo sigue (${tag})`);
      assert.equal(await page.getByRole('button', { name: /Guardar ahora|Save now/ }).count(), 0, `sin «Guardar ahora» vencida (${tag})`);
      assert.equal(await tokenOf(page), 't');
      await page.getByRole('button', { name: c.enter, exact: true }).click(); await page.waitForURL('**/login', { timeout: 8000 });
      assert.equal(await tokenOf(page), null);
      await context.close();
    }
    check(`sala, nota en vivo + 401 (${tag}): aviso, texto intacto, sin «Guardar ahora», «Entrar» → /login`);

    // Sala: cierre con texto → 401 → aviso dentro del diálogo con «Entrar»
    {
      const { context, page } = await open(width, lang, '/therapist/session/9', { endStatus: 401 });
      await page.locator('.sr-btn-finish').click();
      await page.locator('input[name="sr-mood"]').first().check({ force: true });
      await page.locator('#sr-close-note').fill('Cierre de la sesión con suficiente texto');
      await page.locator('.sr-btn-primary-light').click();
      const alert = page.locator('#sr-close-problem'); await alert.getByText(c.warn).waitFor({ timeout: 8000 });
      assert.equal(await page.locator('#sr-close-note').inputValue(), 'Cierre de la sesión con suficiente texto');
      await alert.getByRole('button', { name: c.enter, exact: true }).click(); await page.waitForURL('**/login', { timeout: 8000 });
      await context.close();
    }
    check(`sala, cierre + 401 (${tag}): aviso en el diálogo, texto intacto, «Entrar» → /login`);
  }

  assert.deepEqual(errors, [], 'errores de consola o de página: ' + errors.join(' | '));
  console.log(`\nES-265 (nota sin guardar): ${count} comprobaciones (ES/EN × 390/1360) OK`);
  await browser.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
