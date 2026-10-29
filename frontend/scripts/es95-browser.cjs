// ES-95: formulario público de profesionales y pestaña «Solicitudes» del backoffice. Red simulada, sin datos reales.
const assert = require('node:assert/strict');
(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const browser = await chromium.launch({ headless: true });
  const base = process.env.ES95_URL || 'http://127.0.0.1:4395';
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
  const check = label => console.log('PASS ' + label);
  const PDF = Buffer.from('%PDF-1.4\n% synthetic test document\n%%EOF\n');
  const T = { es: { name: 'Nombre completo', email: 'Correo electrónico', country: 'País', profession: 'Profesión o especialidad', cv: 'Hoja de vida (PDF, máximo 5 MB)', consent: 'Acepto el aviso de privacidad', submit: 'Enviar solicitud' },
    en: { name: 'Full name', email: 'Email address', country: 'Country', profession: 'Profession or specialty', cv: 'Résumé / CV (PDF, up to 5 MB)', consent: 'I accept the privacy notice', submit: 'Send application' } };
  async function formPage(lang, viewport = { width: 1100, height: 1000 }, reply = { status: 201, body: { message: 'ok' } }) {
    const page = await browser.newPage({ viewport }); const posts = []; const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(l => { localStorage.setItem('elv_lang', l); }, lang);
    await page.route('**/api/**', async route => {
      const req = route.request();
      if (req.method() === 'POST' && req.url().endsWith('/api/professional-applications')) { posts.push({ headers: req.headers(), body: req.postDataBuffer().toString('latin1') }); const r = typeof reply === 'function' ? reply(posts.length) : reply; return route.fulfill({ status: r.status, json: r.body }); }
      return route.fulfill({ json: [] });
    });
    return { page, posts, errors };
  }
  const fillAll = async (page, lang) => {
    const t = T[lang];
    await page.getByLabel(t.name, { exact: false }).first().fill('Persona Sintética'); await page.getByLabel(t.email, { exact: false }).fill('synthetic@example.test');
    await page.getByLabel(t.country, { exact: false }).fill('Colombia'); await page.getByLabel(t.profession, { exact: false }).fill('Psicología clínica');
  };
  try {
    { // Validación, archivo y envío
      const { page, posts, errors } = await formPage('es');
      await page.goto(base + '/profesionales'); await page.getByRole('heading', { name: 'Solicitud para profesionales' }).waitFor();
      await page.getByRole('button', { name: 'Enviar solicitud' }).click();
      await page.getByRole('alert').filter({ hasText: 'Revisa los campos marcados.' }).waitFor();
      assert.equal(posts.length, 0); assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), 'pro-name');
      assert.ok(await page.locator('#pro-cv-error').count() === 1 && await page.locator('#pro-consent-error').count() === 1);
      check('enviar vacío no envía, enfoca el primer campo inválido y marca hoja de vida y consentimiento');
      await fillAll(page, 'es');
      await page.setInputFiles('#pro-cv', { name: 'cv.txt', mimeType: 'text/plain', buffer: Buffer.from('hola') });
      await page.getByLabel('Acepto el aviso de privacidad', { exact: false }).check(); await page.getByRole('button', { name: 'Enviar solicitud' }).click();
      await page.getByText('El archivo debe ser un PDF.').waitFor(); assert.equal(posts.length, 0);
      check('un archivo que no es PDF se rechaza en el cliente');
      await page.setInputFiles('#pro-cv', { name: 'Mi hoja de vida (privada).pdf', mimeType: 'application/pdf', buffer: PDF });
      await page.getByText('Archivo elegido: Mi hoja de vida (privada).pdf').waitFor();
      await page.getByRole('button', { name: 'Quitar archivo' }).click(); assert.equal(await page.locator('#pro-cv').inputValue(), '');
      await page.setInputFiles('#pro-cv', { name: 'Mi hoja de vida (privada).pdf', mimeType: 'application/pdf', buffer: PDF });
      await page.getByRole('button', { name: 'Enviar solicitud' }).click();
      await page.getByRole('heading', { name: 'Solicitud recibida' }).waitFor();
      assert.equal(posts.length, 1); const body = posts[0].body;
      assert.match(posts[0].headers['content-type'], /multipart\/form-data/);
      for (const f of ['name="name"', 'name="email"', 'name="country"', 'name="profession"', 'name="locale"', 'name="consent"', 'name="bot_trap"', 'name="cv"; filename="cv.pdf"']) assert.ok(body.includes(f), f);
      assert.ok(!body.includes('Mi hoja de vida'), 'el nombre original del archivo no viaja'); assert.ok(!/name="role"|name="status"/.test(body));
      assert.ok(body.includes('%PDF-1.4')); await page.getByText('Recibimos tu solicitud. El equipo de Elevation la revisará').waitFor();
      assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), 'pro-title');
      const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }) + document.cookie + location.href);
      assert.ok(!/synthetic@example|Persona Sint/.test(stored), 'nada de la solicitud en el almacenamiento ni en la URL');
      check('envío válido: multipart con los campos y el PDF, sin nombre de archivo, sin rol ni estado, éxito con foco y nada guardado en el navegador');
      assert.deepEqual(errors, []); await page.close();
    }
    { // Errores del servidor y red: se conserva lo escrito
      for (const [reply, text] of [[{ status: 429, body: { code: 'rate_limited' } }, 'Hiciste demasiados intentos.'], [{ status: 500, body: {} }, 'No pudimos guardar la solicitud.'], [{ status: 400, body: { code: 'invalid_fields', fields: ['email'] } }, 'Revisa los campos marcados.']]) {
        const { page } = await formPage('es', undefined, reply); await page.goto(base + '/profesionales'); await fillAll(page, 'es');
        await page.setInputFiles('#pro-cv', { name: 'cv.pdf', mimeType: 'application/pdf', buffer: PDF }); await page.getByLabel('Acepto el aviso de privacidad', { exact: false }).check();
        await page.getByRole('button', { name: 'Enviar solicitud' }).click(); await page.getByRole('alert').filter({ hasText: text }).waitFor();
        assert.equal(await page.getByLabel('Nombre completo', { exact: false }).first().inputValue(), 'Persona Sintética');
        await page.close();
      }
      const { page } = await formPage('es'); await page.route('**/api/professional-applications', r => r.abort('failed'));
      await page.goto(base + '/profesionales'); await fillAll(page, 'es'); await page.setInputFiles('#pro-cv', { name: 'cv.pdf', mimeType: 'application/pdf', buffer: PDF });
      await page.getByLabel('Acepto el aviso de privacidad', { exact: false }).check(); await page.getByRole('button', { name: 'Enviar solicitud' }).click();
      await page.getByRole('alert').filter({ hasText: 'No pudimos enviar la solicitud.' }).waitFor(); assert.equal(await page.getByLabel('Correo electrónico', { exact: false }).inputValue(), 'synthetic@example.test');
      check('límite de intentos, error del servidor, campos inválidos del servidor y caída de red muestran su aviso y conservan lo escrito'); await page.close();
    }
    { // EN, móvil y teclado
      const { page, errors } = await formPage('en', { width: 375, height: 800 }); await page.goto(base + '/profesionales');
      await page.getByRole('heading', { name: 'Application for professionals' }).waitFor(); await page.getByLabel(T.en.cv, { exact: false }).waitFor();
      await page.getByText('Elevation is not an emergency service and does not replace clinical care.').waitFor();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'sin scroll horizontal a 375 px');
      await page.keyboard.press('Tab'); const order = []; for (let i = 0; i < 16; i++) { order.push(await page.evaluate(() => document.activeElement && (document.activeElement.id || document.activeElement.textContent.trim()))); await page.keyboard.press('Tab'); }
      assert.ok(order.indexOf('pro-name') !== -1 && order.indexOf('pro-name') < order.indexOf('pro-cv') && order.indexOf('pro-cv') < order.indexOf('pro-consent'), 'orden de foco: ' + order.join('|'));
      assert.ok(!(await page.evaluate(() => [...document.querySelectorAll('input')].some(i => i === document.activeElement && i.name === 'bot_trap'))), 'el campo trampa no recibe foco'); assert.equal(await page.title(), 'Application for professionals · Elevation');
      check('EN, móvil 375 px sin scroll horizontal, orden de foco lógico y el campo trampa no recibe foco'); assert.deepEqual(errors, []); await page.close();
    }
    { // Responsive (QA M1): sin desborde a 320, 375 y 768 px, también con un archivo elegido y con errores visibles
      for (const width of [320, 375, 768]) {
        const { page, errors } = await formPage('es', { width, height: 900 }); await page.goto(base + '/profesionales'); await page.getByRole('heading', { name: 'Solicitud para profesionales' }).waitFor();
        await page.setInputFiles('#pro-cv', { name: 'un-nombre-de-archivo-muy-largo-para-probar-el-desborde-de-la-interfaz-movil.pdf', mimeType: 'application/pdf', buffer: PDF });
        await page.getByRole('button', { name: 'Enviar solicitud' }).click(); await page.getByRole('alert').filter({ hasText: 'Revisa los campos marcados.' }).waitFor();
        const report = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth,
          over: [...document.querySelectorAll('.pro-page *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > window.innerWidth + 1 && !e.closest('.pro-trap'); }).map(e => e.tagName + '#' + (e.id || e.className)).slice(0, 5),
          small: [...document.querySelectorAll('.pro-page .elv-input, .pro-page input[type=file]')].filter(e => e.getBoundingClientRect().height < 43 && !e.closest('.pro-trap')).map(e => e.id).slice(0, 5) }));
        assert.ok(report.scroll <= report.inner + 1, `scroll horizontal a ${width} px: ${report.scroll}`);
        assert.deepEqual(report.over, [], `elementos fuera de pantalla a ${width} px`); assert.deepEqual(report.small, [], `campos menores de 44 px a ${width} px`);
        assert.deepEqual(errors, []); await page.close();
      }
      check('responsive 320, 375 y 768 px: sin desborde (también con archivo de nombre largo y errores visibles) y campos de al menos 44 px');
    }
    { // Backoffice
      const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } }); const calls = []; const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.addInitScript(() => { localStorage.setItem('elevation_token', 's'); localStorage.setItem('elevation_role', 'admin'); localStorage.setItem('elv_lang', 'es'); });
      const items = [
        { id: 7, name: 'Ana <b>Prueba</b>', email: 'ana@example.test', country: 'Colombia', profession: 'Psicología', licenseNumber: 'SYN-1', profileUrl: 'https://example.test/ana', message: 'Mensaje <script>alert(1)</script>', locale: 'es', status: 'pending', reviewedBy: null, reviewNote: null, reviewedAt: null, userId: null, createdAt: '2026-10-28T12:00:00Z', cv: { size: 2048 } },
        { id: 8, name: 'Beto Prueba', email: 'beto@example.test', country: 'México', profession: 'Psicoterapia', licenseNumber: null, profileUrl: 'javascript:alert(1)', message: null, locale: 'en', status: 'approved', reviewedBy: 'Admin', reviewNote: 'ok', reviewedAt: '2026-10-28T13:00:00Z', userId: null, createdAt: '2026-10-27T12:00:00Z', cv: { size: 1024 } },
      ];
      await page.route('**/api/**', async route => {
        const req = route.request(); const url = new URL(req.url()); calls.push(req.method() + ' ' + url.pathname + url.search);
        if (url.pathname === '/api/admin/professional-applications' && req.method() === 'GET') { const s = url.searchParams.get('status'); return route.fulfill({ json: items.filter(i => !s || i.status === s) }); }
        if (url.pathname.endsWith('/cv')) return route.fulfill({ status: 200, contentType: 'application/pdf', body: PDF });
        if (/\/(approve|reject)$/.test(url.pathname) && req.method() === 'PUT') { const b = JSON.parse(req.postData() || '{}'); calls.push('BODY ' + JSON.stringify(b)); items[0].status = url.pathname.endsWith('approve') ? 'approved' : 'rejected'; return route.fulfill({ json: { id: 7 } }); }
        if (req.method() === 'DELETE') return route.fulfill({ json: { deleted: true } });
        return route.fulfill({ json: [] });
      });
      await page.goto(base + '/admin/content'); await page.getByRole('button', { name: '📨 Solicitudes' }).click();
      const region = page.getByRole('region', { name: 'Solicitudes de profesionales' }); await region.waitFor();
      await page.getByRole('article', { name: 'Solicitud de Ana <b>Prueba</b>' }).waitFor();
      assert.equal(await page.locator('article b, article script').count(), 0, 'el texto de la persona se escapa (sin HTML)');
      assert.equal(await page.getByRole('article', { name: 'Solicitud de Beto Prueba' }).count(), 0, 'por defecto solo pendientes');
      check('pestaña Solicitudes: lista pendientes y el texto de la persona se muestra escapado');
      const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Descargar hoja de vida/ }).click()]);
      assert.equal(download.suggestedFilename(), 'solicitud-7-hoja-de-vida.pdf'); assert.ok(calls.some(c => c === 'GET /api/admin/professional-applications/7/cv'));
      check('descarga la hoja de vida con la sesión (archivo solicitud-7-hoja-de-vida.pdf)');
      await page.getByRole('button', { name: 'Rechazar' }).click(); await page.getByRole('button', { name: 'Confirmar rechazo' }).click();
      await page.getByText('Escribe el motivo del rechazo.').waitFor(); assert.ok(!calls.some(c => c.startsWith('PUT')));
      await page.getByLabel('Motivo del rechazo (obligatorio)').fill('Falta la colegiatura.'); await page.getByRole('button', { name: 'Confirmar rechazo' }).click();
      await page.getByText('Solicitud rechazada.').waitFor(); assert.ok(calls.includes('PUT /api/admin/professional-applications/7/reject') && calls.includes('BODY {"note":"Falta la colegiatura."}'));
      check('rechazar exige el motivo y lo envía');
      await page.getByRole('button', { name: 'Aprobadas' }).click(); const beto = page.getByRole('article', { name: 'Solicitud de Beto Prueba' }); await beto.waitFor();
      assert.equal(await beto.getByRole('link', { name: 'Perfil profesional' }).count(), 0, 'un enlace que no es http(s) no se muestra como enlace');
      await beto.getByRole('link', { name: 'Crear cuenta de terapeuta' }).click(); await page.waitForURL(/\/admin\/users/);
      await page.getByRole('heading', { name: /Crear|Nuevo usuario/i }).first().waitFor({ timeout: 5000 }).catch(() => {});
      const values = await page.evaluate(() => [...document.querySelectorAll('input')].map(i => i.value)); assert.ok(values.includes('Beto Prueba') && values.includes('beto@example.test'), 'nombre y correo precargados: ' + values.join('|'));
      assert.ok(!page.url().includes('newTherapist'), 'la URL se limpia (sin datos personales)'); assert.equal(await page.locator('input[type=password]').first().inputValue(), '');
      check('«Crear cuenta de terapeuta» abre Crear usuario con nombre y correo, sin contraseña y limpia la URL'); assert.deepEqual(errors, []); await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
