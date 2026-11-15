// ES-153 (paso 1, P1 de Codex): con el marco de persona, los enlaces del encabezado y «Salir» respetan los borradores sin guardar.
// Chromium, API simulada (page.route), datos sintéticos. Casos: evidencia nueva con texto, notas de un ejercicio, diario con texto, y el control «sin texto → navega sin preguntar».
// Para cada caso: (1) con texto y la confirmación RECHAZADA, «Mapa» no navega y el texto sigue; (2) «Conversación» y la marca tampoco; (3) «Salir» no cierra la sesión;
// (4) con la confirmación ACEPTADA sí navega. Sin texto no aparece ninguna pregunta.
// Uso: npx vite build && npx vite preview --host 127.0.0.1 --port 4153 --strictPort   y luego
//   ES153_URL=http://127.0.0.1:4153 PLAYWRIGHT_MODULE=<ruta a playwright> node scripts/es153-draft-check.cjs
const assert = require('node:assert/strict');

(async () => {
  const { chromium } = process.env.PLAYWRIGHT_MODULE ? require(process.env.PLAYWRIGHT_MODULE) : await import('playwright');
  const base = process.env.ES153_URL ?? 'http://127.0.0.1:4153';
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Solo vista previa local');
  const browser = await chromium.launch({ headless: true });
  let count = 0; const check = (label) => { count++; console.log('PASS ' + label); };
  const EX = { key: 'respira_tres', minutes: [3, 5], reviewStatus: 'reviewed', version: 1, es: { title: 'Respirar tres veces', purpose: 'Parar un momento.', question: '¿Qué notas?', help: 'Escribe lo que quieras.' }, en: { title: 'Breathe three times', purpose: 'Pause for a moment.', question: 'What do you notice?', help: 'Write what you like.' } };

  async function open(route, lang) {
    const context = await browser.newContext({ viewport: { width: 1360, height: 900 } }); const page = await context.newPage(); const calls = [];
    await page.addInitScript(([l]) => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l); }, [lang]);
    await page.route('**/api/**', (r) => {
      const p = new URL(r.request().url()).pathname; calls.push(`${r.request().method()} ${p}`);
      if (p === '/api/session') return r.fulfill({ json: { role: 'user', onboardingCompleted: true } });
      if (p === '/api/exercises') return r.fulfill({ json: [EX] });
      if (p === `/api/exercises/${EX.key}`) return r.fulfill({ json: EX });
      return r.fulfill({ json: [] });
    });
    await page.goto(base + route, { waitUntil: 'networkidle' });
    return { context, page, calls };
  }
  const header = (page, name) => page.locator('.cg-frame > header.cg-header').getByRole('link', { name, exact: true });
  const CASES = [
    { name: 'evidencia nueva', route: '/app/evidence/new', fill: async (page) => { const f = page.locator('form input[type="text"], form textarea').first(); await f.waitFor(); await f.fill('Texto sin guardar'); return f; } },
    { name: 'notas de un ejercicio', route: '/app/exercises', fill: async (page, lang) => { await page.locator('.exercise-grid button').first().click(); const f = page.locator('#exercise-notes'); await f.waitFor(); await f.fill('Mis notas'); return f; } },
    { name: 'diario', route: '/app/diary/new', fill: async (page) => { const f = page.locator('#entry-content'); await f.waitFor(); await f.fill('Una entrada sin guardar'); return f; } },
  ];
  const NAV = { es: { map: 'Mapa', chat: 'Conversación' }, en: { map: 'Map', chat: 'Conversation' } };

  for (const lang of ['es', 'en']) for (const c of CASES) {
    const { context, page, calls } = await open(c.route, lang); const tag = `${c.name} (${lang})`;
    // control: sin texto navega sin preguntar
    let asked = 0; page.on('dialog', (d) => { asked++; void d.dismiss(); });
    const field = await c.fill(page, lang);
    const value = await field.inputValue();
    // (1) y (2): rechazar → no navega y el texto sigue
    await header(page, NAV[lang].map).click(); await page.waitForTimeout(400);
    assert.ok(asked === 1, `pregunta antes de salir con «${NAV[lang].map}» (${tag})`); assert.ok(page.url().endsWith(c.route), `no navega al rechazar (${tag}): ${page.url()}`);
    assert.equal(await field.inputValue(), value, `el texto sigue en el campo (${tag})`);
    const before = asked; await header(page, NAV[lang].chat).click(); await page.waitForTimeout(400);
    assert.ok(asked - before === 1 && page.url().endsWith(c.route), `«${NAV[lang].chat}» tampoco navega al rechazar (${tag})`);
    const before2 = asked; await page.locator('.cg-frame > header.cg-header a.cg-brand').click(); await page.waitForTimeout(400);
    assert.ok(asked - before2 === 1 && page.url().endsWith(c.route), `la marca tampoco navega al rechazar (${tag})`);
    // (3) «Salir» no cierra la sesión mientras se rechaza
    await page.locator('.cg-usermenu__button').click(); const out = page.locator('.cg-usermenu__out'); const before3 = asked; await out.click(); await page.waitForTimeout(400);
    assert.ok(asked - before3 === 1 && page.url().endsWith(c.route), `«Salir» pregunta y no sale al rechazar (${tag})`);
    assert.equal(calls.filter((x) => /logout|signout|sign-out/.test(x)).length, 0, `no se cerró la sesión (${tag})`);
    assert.equal(await page.evaluate(() => localStorage.getItem('elevation_token')), 't', `el token sigue (${tag})`);
    // (4) aceptar → navega
    page.removeAllListeners('dialog'); page.on('dialog', (d) => { void d.accept(); });
    await page.keyboard.press('Escape'); await header(page, NAV[lang].map).click(); await page.waitForURL('**/app/skill-map');
    await context.close();
    check(`${tag}: con texto sin guardar, «${NAV[lang].map}», «${NAV[lang].chat}», la marca y «Salir» preguntan y no salen al rechazar (texto y sesión intactos); al aceptar navega`);
  }
  // control: sin texto no pregunta
  for (const c of CASES.slice(0, 1).concat(CASES.slice(2))) {
    const { context, page } = await open(c.route, 'es'); let asked = 0; page.on('dialog', (d) => { asked++; void d.accept(); });
    await page.locator('form input[type="text"], form textarea, #entry-content').first().waitFor(); await header(page, 'Mapa').click(); await page.waitForURL('**/app/skill-map');
    assert.equal(asked, 0, `sin texto no pregunta (${c.name})`); await context.close();
  }
  check('control: sin texto escrito, los enlaces del marco navegan sin preguntar');
  console.log(`\nES-153 borradores: ${count} comprobaciones OK`); await browser.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
