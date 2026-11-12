// ES-239: el diálogo de cierre de la sala del profesional (CloseSession, <dialog> nativo con showModal) se cierra con Esc sin perder lo escrito, devuelve el foco al botón «Finalizar»
// y no deja salir el foco con Tab / Shift+Tab. API simulada con page.route.
// Uso: npx vite build && npx vite preview --host 127.0.0.1 --port 4239 --strictPort   y luego
//   ES239_URL=http://127.0.0.1:4239 PLAYWRIGHT_MODULE=<ruta a playwright> AXE_PATH=<axe.min.js> node scripts/es239-check.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');

(async () => {
  const { chromium } = process.env.PLAYWRIGHT_MODULE ? require(process.env.PLAYWRIGHT_MODULE) : await import('playwright');
  const base = process.env.ES239_URL ?? 'http://127.0.0.1:4239';
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Solo vista previa local');
  const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8');
  const browser = await chromium.launch({ headless: true });
  const errors = []; let count = 0;
  const check = (label) => { count++; console.log('PASS ' + label); };
  const session = { id: 9, patientId: 7, patientName: 'Persona Sintética', sharing: true, scheduledAt: '2026-11-12T15:00:00Z', duration: 50, status: 'in_progress', startedAt: '2026-11-12T15:00:00Z' };
  const T = { es: { dialog: 'Finalizar sesión', textLabel: 'Nota' }, en: { dialog: 'End session', textLabel: 'Note' } };

  for (const [width, lang] of [[390, 'es'], [390, 'en'], [1360, 'es'], [1360, 'en']]) {
    const tag = `${width}px ${lang}`;
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|frame-ancestors|Refused to frame/.test(m.text())) errors.push(m.text()); });
    await page.addInitScript(([l]) => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'therapist'); localStorage.setItem('elv_lang', l); }, [lang]);
    await page.route('**/api/**', (route) => {
      const p = new URL(route.request().url()).pathname;
      if (p === '/api/session') return route.fulfill({ json: { role: 'therapist', onboardingCompleted: true } });
      if (p === '/api/sessions/therapist/9/start') return route.fulfill({ json: { meetingUrl: base + '/robots.txt', startedAt: session.startedAt } });
      if (p === '/api/sessions/therapist/9/notes') return route.fulfill({ json: [] });
      if (p === '/api/sessions/therapist') return route.fulfill({ json: [session] });
      return route.fulfill({ json: [] });
    });
    await page.goto(base + '/therapist/session/9', { waitUntil: 'networkidle' });
    const opener = page.locator('.sr-btn-finish');
    await opener.waitFor();

    // Abrir, escribir, Esc → se cierra, el foco vuelve a «Finalizar» y lo escrito sigue al reabrir
    await opener.click();
    const dialog = page.locator('dialog[open]');
    await dialog.waitFor();
    const note = page.locator('#sr-close-note');
    await note.fill('Nota de cierre que no se debe perder');
    await page.keyboard.press('Escape');
    await page.locator('dialog[open]').waitFor({ state: 'detached', timeout: 3000 });
    assert.equal(await opener.evaluate((el) => el === document.activeElement), true, `el foco vuelve a «Finalizar» (${tag})`);
    await opener.click(); await dialog.waitFor();
    assert.equal(await note.inputValue(), 'Nota de cierre que no se debe perder', `lo escrito sigue al reabrir (${tag})`);
    check(`Esc cierra el diálogo, el foco vuelve a «Finalizar» y lo escrito no se pierde (${tag})`);

    // Tab y Shift+Tab no sacan el foco del diálogo
    // En un <dialog> modal nativo el resto de la página es inerte: con Tab desde el último control el foco pasa al navegador (activeElement = body), nunca a un elemento de la página de fondo.
    const inside = () => page.evaluate(() => { const a = document.activeElement; return !a || a === document.body || !!a.closest('dialog[open]'); });
    const focusables = await page.locator('dialog[open] input, dialog[open] textarea, dialog[open] button, dialog[open] select').count();
    for (let i = 0; i < focusables + 3; i += 1) { await page.keyboard.press('Tab'); assert.equal(await inside(), true, `Tab ${i + 1}: el foco no llega a la página de fondo (${tag})`); }
    for (let i = 0; i < focusables + 3; i += 1) { await page.keyboard.press('Shift+Tab'); assert.equal(await inside(), true, `Shift+Tab ${i + 1}: el foco no llega a la página de fondo (${tag})`); }
    check(`Tab y Shift+Tab nunca llevan el foco a la página de fondo (${focusables} controles, ${tag})`);

    await page.evaluate(axeSource);
    const violations = await page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] })).violations.map((v) => v.id + ':' + v.nodes.length));
    assert.deepEqual(violations, [], `axe con el diálogo abierto (${tag})`);
    await page.keyboard.press('Escape');
    await context.close();
  }
  assert.deepEqual(errors, [], 'errores de consola o de página: ' + errors.join(' | '));
  console.log(`\nES-239: ${count} comprobaciones OK`);
  await browser.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
