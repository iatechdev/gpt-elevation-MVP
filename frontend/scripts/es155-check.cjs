// ES-155 (tramo B): /login (entrar y crear cuenta) y /forgot-password con Cartografía en el marco público. Chromium, API simulada (page.route), datos sintéticos.
// Mide: marco (un h1, un main, encabezado y pie), error POR CAMPO con foco al primero y texto conservado, «Mostrar» que conserva lo escrito, aviso de «no hay pago en línea» y nota
// de privacidad sin la palabra «consentimiento» (la casilla llega con ES-301), foco al aviso tras cada rechazo, recuperar con la misma respuesta y el correo conservado en red y 429,
// y axe con wcag2a, wcag2aa, wcag21aa y wcag22aa (incluye el tamaño del objetivo de 24 px) en ES/EN × 390/1360.
// Uso: npx vite build && npx vite preview --host 127.0.0.1 --port 4155 --strictPort   y luego
//   ES155_URL=http://127.0.0.1:4155 PLAYWRIGHT_MODULE=<ruta a playwright> AXE_PATH=<axe.min.js> node scripts/es155-check.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');

(async () => {
  const { chromium } = process.env.PLAYWRIGHT_MODULE ? require(process.env.PLAYWRIGHT_MODULE) : await import('playwright');
  const base = process.env.ES155_URL ?? 'http://127.0.0.1:4155';
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Solo vista previa local');
  const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8');
  const browser = await chromium.launch({ headless: true });
  const errors = []; let count = 0;
  const check = (label) => { count++; console.log('PASS ' + label); };
  const T = {
    es: { email: 'Correo electrónico', password: 'Contraseña', name: 'Nombre', errName: 'Escribe tu nombre.', errEmail: 'Escribe un correo válido', errPassword: 'Escribe tu contraseña.', failed: 'No se pudo completar el acceso', rate: 'Demasiados intentos', locked: 'Cuenta bloqueada temporalmente', registered: 'Registro exitoso', needs: 'Tu contraseña necesita', noPay: 'Por ahora no hay pago en línea', sent: 'Si existe una cuenta con ese correo', show: 'Mostrar', hide: 'Ocultar', signInTitle: 'Entrar', forgotTitle: 'Recuperar contraseña', privacy: 'Privacidad' },
    en: { email: 'Email address', password: 'Password', name: 'Name', errName: 'Enter your name.', errEmail: 'Enter a valid email', errPassword: 'Enter your password.', failed: 'Access could not be completed', rate: 'Too many attempts', locked: 'Account temporarily locked', registered: 'Registration successful', needs: 'Your password needs', noPay: 'There is no online payment for now', sent: 'If an account exists for that email', show: 'Show', hide: 'Hide', signInTitle: 'Sign in', forgotTitle: 'Reset your password', privacy: 'Privacy' },
  };

  async function open(route, width, lang, opts = {}) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const seen = { login: [], register: [], reset: [] };
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
    await page.addInitScript(([l]) => { localStorage.setItem('elv_lang', l); }, [lang]);
    await page.route('**/api/**', async (route2) => {
      const request = route2.request(); const p = new URL(request.url()).pathname;
      if (p === '/api/login') { seen.login.push(JSON.parse(request.postData() ?? '{}')); return route2.fulfill({ status: opts.loginStatus ?? 401, json: opts.loginBody ?? { error: 'Credenciales inválidas.' } }); }
      if (p === '/api/register') { seen.register.push(JSON.parse(request.postData() ?? '{}')); return route2.fulfill({ status: opts.registerStatus ?? 201, json: opts.registerBody ?? { message: 'ok' } }); }
      if (p === '/api/password-reset/request') {
        seen.reset.push(JSON.parse(request.postData() ?? '{}'));
        if (opts.resetAbort) return route2.abort('connectionreset');
        return route2.fulfill({ status: opts.resetStatus ?? 202, json: {} });
      }
      return route2.fulfill({ status: 401, json: {} });
    });
    await page.goto(base + route, { waitUntil: 'networkidle' });
    return { context, page, seen };
  }
  const axe = async (page) => { await page.evaluate(axeSource); return page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] })).violations.map((v) => v.id + ':' + v.nodes.length)); };
  const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const active = (page) => page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);
  const frame = async (page, tag) => {
    assert.equal(await page.locator('h1').count(), 1, `un h1 (${tag})`);
    assert.equal(await page.locator('main#main').count(), 1, `un main (${tag})`);
    assert.ok(await page.locator('header.cg-header').count() === 1 && await page.locator('footer').count() >= 1, `encabezado y pie del marco (${tag})`);
    assert.ok((await overflow(page)) <= 0, `sin desborde (${tag})`);
  };

  for (const [width, lang] of [[390, 'es'], [1360, 'en']]) {
    const c = T[lang]; const tag = `${width}px ${lang}`;
    // 1. Entrar: marco, axe, errores por campo con foco al primero, texto conservado, «Mostrar», 401 con foco al aviso
    { const { context, page, seen } = await open('/login', width, lang);
      await frame(page, tag); assert.equal((await page.locator('h1').innerText()).toLowerCase(), c.signInTitle.toLowerCase(), `título (${tag})`);
      assert.deepEqual(await axe(page), [], `axe entrar (${tag})`);
      await page.locator('form button[type="submit"]').click();
      await page.getByText(c.errEmail).waitFor(); await page.getByText(c.errPassword).waitFor();
      assert.equal(await active(page), 'access-email', `foco al primer campo con error (${tag})`);
      assert.deepEqual(await axe(page), [], `axe con errores por campo (${tag})`);
      assert.equal(seen.login.length, 0, `con campos inválidos no se envía nada (${tag})`);
      await page.getByLabel(c.email, { exact: true }).fill('persona@example.invalid');
      await page.locator('form button[type="submit"]').click();
      assert.equal(await active(page), 'access-password', `el correo ya válido: el foco pasa a la contraseña (${tag})`);
      assert.equal(await page.getByLabel(c.email, { exact: true }).inputValue(), 'persona@example.invalid', `se conserva lo escrito (${tag})`);
      await page.getByLabel(c.password, { exact: true }).fill('clave-sintetica');
      const toggle = page.getByRole('button', { name: /contraseña|password/i }).first();
      assert.equal(await page.locator('#access-password').getAttribute('type'), 'password');
      await toggle.click(); assert.equal(await page.locator('#access-password').getAttribute('type'), 'text', `Mostrar descubre la contraseña (${tag})`);
      assert.equal(await page.locator('#access-password').inputValue(), 'clave-sintetica', `Mostrar conserva lo escrito (${tag})`);
      await toggle.click(); assert.equal(await page.locator('#access-password').getAttribute('type'), 'password');
      await page.locator('form button[type="submit"]').click();
      const alert = page.getByRole('alert').filter({ hasText: /./ }).last(); await alert.waitFor();
      assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('role')), 'alert', `foco al aviso tras el rechazo (${tag})`);
      assert.equal(seen.login.length, 1); assert.deepEqual(seen.login[0], { email: 'persona@example.invalid', password: 'clave-sintetica' });
      assert.deepEqual(await axe(page), [], `axe tras rechazo (${tag})`);
      assert.ok(await page.getByRole('link', { name: /olvidaste|forgot/i }).count() >= 1, `enlace de recuperar (${tag})`);
      await context.close(); }
    // 2. Entrar bloqueado: el botón queda deshabilitado con el texto de bloqueo
    { const { context, page } = await open('/login', width, lang, { loginStatus: 423, loginBody: { error: 'x', locked: true } });
      await page.getByLabel(c.email, { exact: true }).fill('persona@example.invalid'); await page.getByLabel(c.password, { exact: true }).fill('x');
      await page.locator('form button[type="submit"]').click(); await page.getByText(c.locked).first().waitFor();
      assert.equal(await page.locator('form button[type="submit"]').isDisabled(), true, `bloqueado: botón deshabilitado (${tag})`); await context.close(); }
    check(`entrar (${tag}): marco, axe wcag22aa 0, error por campo con foco al primero, texto conservado, Mostrar, aviso con foco, bloqueo`);

    // 3. Crear cuenta: error por campo en orden, contraseña débil, aviso de pago, nota de privacidad SIN «consentimiento», cuenta creada
    { const { context, page, seen } = await open('/login?mode=register', width, lang);
      await frame(page, tag); assert.deepEqual(await axe(page), [], `axe crear cuenta (${tag})`);
      const body = await page.locator('main').innerText();
      assert.ok(body.includes(c.noPay), `aviso de que no hay pago en línea (${tag})`);
      assert.ok(await page.getByRole('link', { name: c.privacy, exact: true }).count() >= 1, `nota de privacidad con enlace (${tag})`);
      assert.ok(!/consentimiento|consent|acepto|i agree/i.test(body) && (await page.locator('input[type="checkbox"]').count()) === 0, `sin casilla ni la palabra «consentimiento» hasta ES-301 (${tag})`);
      await page.locator('form button[type="submit"]').click();
      await page.getByText(c.errName).waitFor(); assert.equal(await active(page), 'access-name', `foco al primer error: nombre (${tag})`);
      assert.deepEqual(await axe(page), [], `axe crear cuenta con errores (${tag})`);
      await page.getByLabel(c.name, { exact: true }).fill('Persona Sintética'); await page.getByLabel(c.email, { exact: true }).fill('persona@example.invalid');
      await page.getByLabel(c.password, { exact: true }).fill('corta');
      await page.locator('form button[type="submit"]').click(); await page.getByText(new RegExp(c.needs)).first().waitFor();
      assert.equal(await active(page), 'access-password', `contraseña débil: foco al campo (${tag})`); assert.equal(seen.register.length, 0, `no se envía una contraseña débil (${tag})`);
      assert.equal(await page.locator('#access-password').getAttribute('aria-invalid'), 'true', `aria-invalid por requisitos (${tag})`);
      await page.getByLabel(c.password, { exact: true }).fill('Clave-Sintetica-2026!');
      await page.locator('form button[type="submit"]').click(); await page.getByText(c.registered).waitFor();
      assert.equal(seen.register.length, 1); assert.deepEqual(Object.keys(seen.register[0]).sort(), ['email', 'name', 'password'], `el contrato con el servidor no cambia (${tag})`);
      assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('role')), 'status', `foco al aviso de cuenta creada (${tag})`);
      await context.close(); }
    check(`crear cuenta (${tag}): axe 0, errores por campo en orden, requisitos, aviso de pago, nota de privacidad sin consentimiento ni casilla, contrato intacto`);

    // 4. Recuperar: correo inválido, misma respuesta 202, red caída y 429 conservan el correo y devuelven el foco
    { const { context, page, seen } = await open('/forgot-password', width, lang);
      await frame(page, tag); assert.equal((await page.locator('h1').innerText()).toLowerCase(), c.forgotTitle.toLowerCase());
      assert.deepEqual(await axe(page), [], `axe recuperar (${tag})`);
      await page.locator('form button[type="submit"]').click(); await page.getByText(c.errEmail).waitFor();
      assert.equal(await active(page), 'reset-email', `correo inválido: foco al campo (${tag})`); assert.equal(seen.reset.length, 0);
      await page.getByLabel(c.email, { exact: true }).fill('nadie@example.invalid');
      await page.locator('form button[type="submit"]').click(); await page.getByText(c.sent).waitFor();
      assert.deepEqual(seen.reset[0].email, 'nadie@example.invalid'); assert.deepEqual(await axe(page), [], `axe recuperar enviado (${tag})`); await context.close(); }
    { const { context, page } = await open('/forgot-password', width, lang, { resetAbort: true });
      await page.getByLabel(c.email, { exact: true }).fill('nadie@example.invalid'); await page.locator('form button[type="submit"]').click();
      await page.getByText(c.failed).waitFor(); assert.equal(await active(page), 'reset-email', `error de red: el foco vuelve al correo (${tag})`);
      assert.equal(await page.getByLabel(c.email, { exact: true }).inputValue(), 'nadie@example.invalid', `error de red conserva el correo (${tag})`); await context.close(); }
    { const { context, page } = await open('/forgot-password', width, lang, { resetStatus: 429 });
      await page.getByLabel(c.email, { exact: true }).fill('nadie@example.invalid'); await page.locator('form button[type="submit"]').click();
      await page.getByText(c.rate).waitFor(); assert.equal(await active(page), 'reset-email');
      assert.equal(await page.getByLabel(c.email, { exact: true }).inputValue(), 'nadie@example.invalid', `demasiados intentos conserva el correo (${tag})`); await context.close(); }
    check(`recuperar (${tag}): axe 0, correo inválido con foco, misma respuesta 202, red caída y 429 conservan el correo y devuelven el foco`);
  }

  assert.deepEqual(errors, [], 'errores de consola o de página: ' + errors.join(' | '));
  console.log(`\nES-155 B: ${count} comprobaciones OK`);
  await browser.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
