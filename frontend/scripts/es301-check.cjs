// ES-301 (frontend): casilla de aceptación en /login?mode=register y páginas públicas /privacidad y /terminos. Chromium, API simulada (page.route), datos sintéticos.
// Mide: axe (wcag2a/2aa/21a/21aa/22aa) en ES/EN × 390/1360/320 × claro/oscuro; casilla sin marcar por defecto, etiqueta asociada, dos enlaces en pestaña nueva con aviso para lectores,
// error por campo con foco a la casilla y SIN envío; envío de acceptedTerms + termsVersion; 400 terms_required / terms_not_accepted / terms_version_mismatch; objetivos ≥ 24 px;
// páginas legales: un h1, noindex, marcadores visibles entre corchetes, banner «sin revisión legal», sin desborde, enlaces entre ellas.
// Uso: npx vite build && npx vite preview --host 127.0.0.1 --port 4301 --strictPort   y luego
//   ES301_URL=http://127.0.0.1:4301 PLAYWRIGHT_MODULE=<ruta a playwright> AXE_PATH=<axe.min.js> node scripts/es301-check.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');

(async () => {
  const { chromium } = process.env.PLAYWRIGHT_MODULE ? require(process.env.PLAYWRIGHT_MODULE) : await import('playwright');
  const base = process.env.ES301_URL ?? 'http://127.0.0.1:4301';
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Solo vista previa local');
  const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8');
  const browser = await chromium.launch({ headless: true });
  const errors = []; let count = 0;
  const check = (label) => { count++; console.log('PASS ' + label); };
  const T = {
    es: { name: 'Nombre', email: 'Correo electrónico', password: 'Contraseña', errTerms: 'Para crear tu cuenta necesitas aceptar el aviso de privacidad y los términos.', changed: 'El aviso cambió. Recarga la página y vuelve a aceptar.', registered: 'Registro exitoso', label: 'He leído y acepto el aviso de privacidad (se abre en una pestaña nueva) y los términos de uso (se abre en una pestaña nueva).', privacyTitle: 'Aviso de privacidad', termsTitle: 'Términos de uso', draft: 'sin revisión legal', marker: '[POR COMPLETAR: razón social]', back: 'Volver a crear cuenta' },
    en: { name: 'Name', email: 'Email address', password: 'Password', errTerms: 'To create your account you need to accept the privacy notice and the terms.', changed: 'The notice changed. Reload the page and accept again.', registered: 'Registration successful', label: 'I have read and accept the privacy notice (opens in a new tab) and the terms of use (opens in a new tab).', privacyTitle: 'Privacy notice', termsTitle: 'Terms of use', draft: 'without legal review', marker: '[TO BE COMPLETED: legal name]', back: 'Back to create account' },
  };

  async function open(route, width, lang, opts = {}) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', colorScheme: opts.scheme ?? 'light' });
    const page = await context.newPage();
    const seen = { register: [] };
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
    await page.addInitScript(([l]) => { localStorage.setItem('elv_lang', l); }, [lang]);
    await page.route('**/api/**', async (route2) => {
      const request = route2.request(); const p = new URL(request.url()).pathname;
      if (p === '/api/register') { seen.register.push(JSON.parse(request.postData() ?? '{}')); return route2.fulfill({ status: opts.registerStatus ?? 201, json: opts.registerBody ?? { message: 'ok' } }); }
      return route2.fulfill({ status: 401, json: {} });
    });
    await page.goto(base + route, { waitUntil: 'networkidle' });
    return { context, page, seen };
  }
  const axe = async (page) => { await page.evaluate(axeSource); return page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] })).violations.map((v) => v.id + ':' + v.nodes.map((n) => n.target.join(' ')).join(','))); };
  const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const active = (page) => page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);
  const fillValid = async (page, c) => {
    await page.getByLabel(c.name, { exact: true }).fill('Persona Sintética'); await page.getByLabel(c.email, { exact: true }).fill('persona@example.invalid');
    await page.getByLabel(c.password, { exact: true }).fill('Clave-Sintetica-2026!');
  };

  for (const lang of ['es', 'en']) for (const width of [390, 1360, 320]) for (const scheme of ['light', 'dark']) {
    const c = T[lang]; const tag = `${width}px ${lang} ${scheme}`;
    // 1. Registro: casilla
    { const { context, page, seen } = await open('/login?mode=register', width, lang, { scheme });
      const box = page.locator('#access-terms');
      assert.equal(await box.count(), 1, `una casilla (${tag})`); assert.equal(await box.isChecked(), false, `sin marcar por defecto (${tag})`);
      assert.deepEqual(await axe(page), [], `axe registro (${tag})`); assert.ok((await overflow(page)) <= 0, `sin desborde (${tag})`);
      const links = page.locator('label[for="access-terms"] a');
      assert.equal(await links.count(), 2); assert.deepEqual(await links.evaluateAll((a) => a.map((x) => [x.getAttribute('href'), x.target, x.rel])), [['/privacidad', '_blank', 'noopener noreferrer'], ['/terminos', '_blank', 'noopener noreferrer']], `enlaces en pestaña nueva (${tag})`);
      assert.equal((await page.locator('label[for="access-terms"]').innerText()).replace(/\s+/g, ' ').replace(/ \.$/, '.').trim(), c.label.replace(/ \(/g, ' (').replace(/\s+/g, ' '), `texto de la casilla (${tag})`);
      const size = await box.boundingBox(); assert.ok(size.width >= 24 && size.height >= 24, `casilla ≥ 24 px (${tag})`);
      for (const h of await links.elementHandles()) { const b = await h.boundingBox(); assert.ok(b.height >= 24, `enlace ≥ 24 px de alto (${tag})`) }
      // enviar sin marcar: error por campo, foco a la casilla, nada se envía
      await fillValid(page, c);
      await page.locator('form button[type="submit"]').click(); await page.getByText(c.errTerms).waitFor();
      assert.equal(await active(page), 'access-terms', `foco a la casilla (${tag})`); assert.equal(seen.register.length, 0, `no se envía sin aceptar (${tag})`);
      assert.equal(await box.getAttribute('aria-invalid'), 'true'); assert.ok((await box.getAttribute('aria-describedby')).includes('access-terms-error'));
      assert.deepEqual(await axe(page), [], `axe registro con error (${tag})`);
      assert.equal(await page.getByLabel(c.name, { exact: true }).inputValue(), 'Persona Sintética', `lo escrito se conserva (${tag})`);
      // marcar limpia el error; Tab sale de la casilla hacia el primer enlace
      await box.check(); assert.equal(await page.getByText(c.errTerms).count(), 0, `marcar limpia el error (${tag})`);
      await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('href')), '/privacidad', `Tab va al enlace de privacidad (${tag})`);
      // un enlace abre pestaña nueva y no cambia la casilla
      const [popup] = await Promise.all([context.waitForEvent('page'), links.first().click()]); await popup.close();
      assert.equal(await box.isChecked(), true, `abrir el enlace no cambia la casilla (${tag})`);
      await page.locator('form button[type="submit"]').click(); await page.getByText(c.registered).waitFor();
      assert.equal(seen.register.length, 1); assert.deepEqual(seen.register[0], { name: 'Persona Sintética', email: 'persona@example.invalid', password: 'Clave-Sintetica-2026!', acceptedTerms: true, termsVersion: '2026-11-v1' }, `cuerpo del registro (${tag})`);
      // tras crear la cuenta la pantalla pasa a «Entrar» (sin casilla); al volver a «Crear cuenta» la casilla está vacía
      assert.equal(await page.locator('#access-terms').count(), 0, `tras crear la cuenta se pasa a entrar (${tag})`);
      await page.locator('.ac-secondary button').click(); await page.locator('#access-terms').waitFor();
      assert.equal(await page.locator('#access-terms').isChecked(), false, `al volver a crear cuenta la casilla está vacía (${tag})`);
      await context.close(); }
    check(`registro (${tag}): casilla, enlaces, error por campo, envío y axe 0`);

    // 2. Errores del servidor
    for (const [code, expect] of [['terms_required', c.errTerms], ['terms_not_accepted', c.errTerms], ['terms_version_mismatch', c.changed]]) {
      const { context, page } = await open('/login?mode=register', width, lang, { scheme, registerStatus: 400, registerBody: { code, error: 'x', currentVersion: '2026-11-v2' } });
      await fillValid(page, c); await page.locator('#access-terms').check();
      await page.locator('form button[type="submit"]').click(); await page.getByText(expect).first().waitFor();
      if (code === 'terms_version_mismatch') { assert.equal(await page.getByRole('alert').filter({ hasText: expect }).count(), 1); assert.equal(await page.getByLabel(c.name, { exact: true }).inputValue(), 'Persona Sintética', 'no se pierde lo escrito') }
      else assert.equal(await active(page), 'access-terms', `${code}: foco a la casilla (${tag})`);
      assert.deepEqual(await axe(page), [], `axe ${code} (${tag})`);
      await context.close();
    }
    check(`errores del servidor (${tag}): terms_required, terms_not_accepted y terms_version_mismatch`);

    // 3. Páginas legales
    for (const [route, title, other] of [['/privacidad', c.privacyTitle, c.termsTitle], ['/terminos', c.termsTitle, c.privacyTitle]]) {
      const { context, page } = await open(route, width, lang, { scheme });
      assert.equal(await page.locator('h1').count(), 1, `un h1 ${route} (${tag})`); assert.equal(await page.locator('h1').innerText(), title.toUpperCase() === title ? title : await page.locator('h1').innerText());
      assert.equal((await page.locator('h1').textContent()).trim(), title, `título ${route} (${tag})`);
      assert.equal(await page.locator('meta[name="robots"][content="noindex"]').count(), 1, `noindex ${route} (${tag})`);
      const marks = await page.locator('mark.lg-todo').allTextContents(); assert.ok(marks.length >= 3 && marks.every((m) => /^\[.+\]$/.test(m)), `marcadores visibles entre corchetes ${route} (${tag})`);
      assert.ok((await page.locator('main').innerText()).includes(c.draft), `banner sin revisión legal ${route} (${tag})`);
      if (route === '/privacidad') assert.ok(marks.includes(c.marker), `razón social sin rellenar (${tag})`);
      assert.ok((await overflow(page)) <= 0, `sin desborde ${route} (${tag})`);
      assert.deepEqual(await axe(page), [], `axe ${route} (${tag})`);
      assert.equal(await page.locator('.lg-also a').count(), 2); assert.ok((await page.locator('.lg-also a').first().innerText()).includes(other));
      assert.equal(await page.getByRole('link', { name: c.back }).count(), 1);
      await page.locator('.lg-also a').first().click(); await page.waitForURL(route === '/privacidad' ? '**/terminos' : '**/privacidad');
      assert.equal(await page.locator('meta[name="robots"][content="noindex"]').count(), 1, `noindex tras navegar (${tag})`);
      await context.close();
    }
    check(`páginas legales (${tag}): h1, noindex, marcadores, banner, enlaces y axe 0`);
  }

  // login: sin casilla
  { const { context, page } = await open('/login', 1360, 'es', {}); assert.equal(await page.locator('#access-terms').count(), 0, 'entrar no lleva casilla'); await context.close(); check('entrar no lleva casilla'); }
  assert.deepEqual(errors, [], 'sin errores de consola ni de página');
  await browser.close();
  console.log(`\n${count} grupos OK`);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
