// ES-285: GuideBlock y ValidationBlock del panel profesional ante 401/403. API simulada con page.route (navegador y front reales).
// Uso: npx vite build && npx vite preview --host 127.0.0.1 --port 4285 --strictPort   y luego
//   ES285_URL=http://127.0.0.1:4285 PLAYWRIGHT_MODULE=<ruta a playwright> AXE_PATH=<axe.min.js> node scripts/es285-check.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');

(async () => {
  const { chromium } = process.env.PLAYWRIGHT_MODULE ? require(process.env.PLAYWRIGHT_MODULE) : await import('playwright');
  const base = process.env.ES285_URL ?? 'http://127.0.0.1:4285';
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Solo vista previa local');
  const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8');
  const browser = await chromium.launch({ headless: true });
  const errors = []; let count = 0;
  const check = (label) => { count++; console.log('PASS ' + label); };
  const T = {
    es: { create: 'Crear guía', enter: 'Entrar', guideWarn: /Tu propuesta no se envió/, fileWarn: /El documento no se subió/, forbid: 'No tienes permiso para esta acción.', renewed: 'Ya iniciaste sesión de nuevo' },
    en: { create: 'Create guide', enter: 'Sign in', guideWarn: /Your proposal was not sent/, fileWarn: /The document was not uploaded/, forbid: "You don't have permission for this action.", renewed: 'You have already signed in again' },
  };
  async function open(width, lang, status) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
    await page.addInitScript(([l]) => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'therapist'); } localStorage.setItem('elv_lang', l); }, [lang]);
    await page.route('**/api/**', (route) => {
      const p = new URL(route.request().url()).pathname;
      if (p === '/api/session') return route.fulfill({ json: { role: 'therapist', onboardingCompleted: true } });
      if (p === '/api/therapist/prompt/propose' || p === '/api/therapist/validation/upload') return route.fulfill({ status, json: { error: 'x' } });
      if (p === '/api/therapist/prompt') return route.fulfill({ json: { hasPrompt: false, content: null, active: null, pending: null, rejected: null } });
      if (p === '/api/therapist/alerts') return route.fulfill({ json: { inactivePatients: [], notableProgress: [] } });
      return route.fulfill({ json: [] });
    });
    await page.goto(base + '/therapist/dashboard', { waitUntil: 'networkidle' });
    return { context, page };
  }
  const axe = async (page) => { await page.evaluate(axeSource); return page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] })).violations.map((v) => v.id + ':' + v.nodes.length)); };
  const tokenOf = (page) => page.evaluate(() => localStorage.getItem('elevation_token'));
  const pdf = { name: 'doc.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 sintetico') };

  for (const [width, lang] of [[390, 'es'], [390, 'en'], [1360, 'es'], [1360, 'en']]) {
    const tag = `${width}px ${lang}`; const c = T[lang];

    { // Guía: 401 → aviso, texto intacto, sesión viva, «Entrar» → /login
      const { context, page } = await open(width, lang, 401);
      await page.getByRole('button', { name: c.create }).click();
      const area = page.locator('#panel-guide-text'); await area.fill('x'.repeat(80));
      await page.locator('dialog[open] button[type="submit"]').click();
      const box = page.locator('#panel-guide-error'); await box.getByText(c.guideWarn).waitFor();
      assert.equal((await area.inputValue()).length, 80, `texto intacto (${tag})`);
      assert.equal(await tokenOf(page), 't', `sesión viva (${tag})`);
      assert.deepEqual(await axe(page), [], `axe (${tag})`);
      const enter = box.getByRole('button', { name: c.enter, exact: true });
      assert.equal(await enter.evaluate((el) => el === document.activeElement), true, `el foco pasa a «Entrar» (${tag})`); // E243-1
      assert.ok((await enter.boundingBox()).height >= 44, `≥ 44 px (${tag})`);
      await enter.click(); await page.waitForURL('**/login', { timeout: 8000 });
      assert.equal(await tokenOf(page), null);
      await context.close();
    }
    check(`guía + 401 (${tag}): aviso, foco en «Entrar», texto intacto, sesión viva hasta «Entrar», axe 0, ≥ 44 px, luego /login`);

    { // E243-2: otro inicio de sesión reemplazó el token → «Entrar» no cierra la sesión nueva y lo dice
      const { context, page } = await open(width, lang, 401);
      await page.getByRole('button', { name: c.create }).click();
      await page.locator('#panel-guide-text').fill('x'.repeat(80));
      await page.locator('dialog[open] button[type="submit"]').click();
      const box = page.locator('#panel-guide-error'); await box.getByText(c.guideWarn).waitFor();
      await page.evaluate(() => localStorage.setItem('elevation_token', 'nuevo'));
      await box.getByRole('button', { name: c.enter, exact: true }).click();
      await box.getByText(c.renewed).waitFor();
      await page.waitForFunction(() => document.activeElement && document.activeElement.id === 'panel-guide-text', null, { timeout: 3000 }).catch(() => { throw new Error(`el foco va al cuadro de la propuesta (${tag})`); }); // O247-B
      assert.equal(await tokenOf(page), 'nuevo', `la sesión nueva se conserva (${tag})`);
      assert.ok(!page.url().includes('/login'), `sigue en el panel (${tag})`);
      await context.close();
    }
    check(`guía + sesión más nueva (${tag}): «Entrar» no la cierra y avisa`);

    { // Guía: 403 → mensaje propio, sesión intacta
      const { context, page } = await open(width, lang, 403);
      await page.getByRole('button', { name: c.create }).click();
      await page.locator('#panel-guide-text').fill('x'.repeat(80));
      await page.locator('dialog[open] button[type="submit"]').click();
      await page.locator('#panel-guide-error').getByText(c.forbid).waitFor();
      assert.equal(await tokenOf(page), 't');
      await context.close();
    }
    check(`guía + 403 (${tag}): mensaje propio, sesión intacta`);

    { // Validación: 401 → aviso con «Entrar»
      const { context, page } = await open(width, lang, 401);
      await page.locator('input[type="file"]').setInputFiles(pdf);
      await page.locator('form:has(input[type="file"]) button[type="submit"]').click();
      await page.locator('form:has(input[type="file"]) p[role="alert"]').getByText(c.fileWarn).waitFor();
      assert.equal(await tokenOf(page), 't');
      assert.equal(await page.locator('form:has(input[type="file"])').getByRole('button', { name: c.enter, exact: true }).evaluate((el) => el === document.activeElement), true, `el foco pasa a «Entrar» (${tag})`); // E243-1
      assert.deepEqual(await axe(page), [], `axe (${tag})`);
      await page.locator('form:has(input[type="file"])').getByRole('button', { name: c.enter, exact: true }).click(); await page.waitForURL('**/login', { timeout: 8000 });
      await context.close();
    }
    check(`validación + 401 (${tag}): aviso, foco en «Entrar», sesión viva hasta «Entrar», axe 0, luego /login`);

    { // E243-2 en la validación
      const { context, page } = await open(width, lang, 401);
      await page.locator('input[type="file"]').setInputFiles(pdf);
      await page.locator('form:has(input[type="file"]) button[type="submit"]').click();
      await page.locator('form:has(input[type="file"]) p[role="alert"]').getByText(c.fileWarn).waitFor();
      await page.evaluate(() => localStorage.setItem('elevation_token', 'nuevo'));
      await page.locator('form:has(input[type="file"])').getByRole('button', { name: c.enter, exact: true }).click();
      await page.locator('form:has(input[type="file"]) p[role="alert"]').getByText(c.renewed).waitFor();
      await page.waitForFunction(() => document.activeElement && document.activeElement.getAttribute('type') === 'submit', null, { timeout: 3000 }).catch(() => { throw new Error(`el foco va a «Subir documento» (${tag})`); }); // O247-B
      assert.equal(await tokenOf(page), 'nuevo');
      await context.close();
    }
    check(`validación + sesión más nueva (${tag}): «Entrar» no la cierra, avisa y el foco queda en un elemento coherente`);

    for (const where of ['guía', 'validación']) { // O247-A: token AUSENTE (se cerró la sesión en OTRA pestaña real) → /login, sin el aviso falso «Ya iniciaste sesión»
      const { context, page } = await open(width, lang, 401);
      if (where === 'guía') {
        await page.getByRole('button', { name: c.create }).click();
        await page.locator('#panel-guide-text').fill('x'.repeat(80));
        await page.locator('dialog[open] button[type="submit"]').click();
        await page.locator('#panel-guide-error').getByText(c.guideWarn).waitFor();
      } else {
        await page.locator('input[type="file"]').setInputFiles(pdf);
        await page.locator('form:has(input[type="file"]) button[type="submit"]').click();
        await page.locator('form:has(input[type="file"]) p[role="alert"]').getByText(c.fileWarn).waitFor();
      }
      // (a) sin evento (como borrar el token en la misma pestaña): «Entrar» lleva a /login
      await page.evaluate(() => localStorage.removeItem('elevation_token'));
      assert.equal(await tokenOf(page), null, `token ausente (${tag})`);
      await page.getByRole('button', { name: c.enter, exact: true }).click(); await page.waitForURL('**/login', { timeout: 8000 });
      assert.equal(await page.getByText(c.renewed).count(), 0, `sin el aviso falso (${tag})`);
      await context.close();
    }
    check(`token ausente (${tag}): «Entrar» en guía y validación lleva a /login, sin el aviso falso`);

    { // (b) cierre de sesión en OTRA pestaña real: la compuerta de esta pestaña lo detecta (evento storage) y lleva a /login sin esperar a «Entrar»
      const { context, page } = await open(width, lang, 401);
      await page.getByRole('button', { name: c.create }).click();
      await page.locator('#panel-guide-text').fill('x'.repeat(80));
      await page.locator('dialog[open] button[type="submit"]').click();
      await page.locator('#panel-guide-error').getByText(c.guideWarn).waitFor();
      const other = await context.newPage(); await other.goto(base + '/login'); await other.evaluate(() => localStorage.removeItem('elevation_token')); await other.close();
      await page.waitForURL('**/login', { timeout: 8000 });
      assert.equal(await page.getByText(c.renewed).count(), 0, `sin el aviso falso (${tag})`);
      await context.close();
    }
    check(`cierre de sesión en otra pestaña (${tag}): esta pestaña va a /login por sí sola, sin el aviso falso`);

    { // Validación: 403
      const { context, page } = await open(width, lang, 403);
      await page.locator('input[type="file"]').setInputFiles(pdf);
      await page.locator('form:has(input[type="file"]) button[type="submit"]').click();
      await page.locator('form:has(input[type="file"]) p[role="alert"]').getByText(c.forbid).waitFor();
      assert.equal(await tokenOf(page), 't');
      await context.close();
    }
    check(`validación + 403 (${tag}): mensaje propio, sesión intacta`);
  }
  assert.deepEqual(errors, [], 'errores de consola o de página: ' + errors.join(' | '));
  console.log(`\nES-285: ${count} comprobaciones (ES/EN × 390/1360) OK`);
  await browser.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
