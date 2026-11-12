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
    es: { create: 'Crear guía', enter: 'Entrar', guideWarn: /Tu propuesta no se envió/, fileWarn: /El documento no se subió/, forbid: 'No tienes permiso para esta acción.' },
    en: { create: 'Create guide', enter: 'Sign in', guideWarn: /Your proposal was not sent/, fileWarn: /The document was not uploaded/, forbid: "You don't have permission for this action." },
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
      assert.ok((await enter.boundingBox()).height >= 44, `≥ 44 px (${tag})`);
      await enter.click(); await page.waitForURL('**/login', { timeout: 8000 });
      assert.equal(await tokenOf(page), null);
      await context.close();
    }
    check(`guía + 401 (${tag}): aviso, texto intacto, sesión viva hasta «Entrar», axe 0, ≥ 44 px, luego /login`);

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
      assert.deepEqual(await axe(page), [], `axe (${tag})`);
      await page.locator('form:has(input[type="file"])').getByRole('button', { name: c.enter, exact: true }).click(); await page.waitForURL('**/login', { timeout: 8000 });
      await context.close();
    }
    check(`validación + 401 (${tag}): aviso, sesión viva hasta «Entrar», axe 0, luego /login`);

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
