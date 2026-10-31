// [QA-Claude] Copia de frontend/scripts/es13-browser.cjs (PR #59) con una espera de 500 ms tras «Ahora no»: el titulo de la banda sigue 1 frame al navegar (condicion de carrera de la prueba, no del producto).
// ES-13: Brújula profesional en navegador real, con red simulada (sin datos reales). Dos builds: sin bandera (release) y con bandera (preview).
const assert = require('node:assert/strict');
(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const browser = await chromium.launch({ headless: true });
  const release = process.env.ES13_RELEASE_URL || 'http://127.0.0.1:4313';
  const preview = process.env.ES13_PREVIEW_URL || 'http://127.0.0.1:4314';
  for (const url of [release, preview]) assert.ok(['127.0.0.1', 'localhost'].includes(new URL(url).hostname));
  const check = label => console.log('PASS ' + label);
  const composer = { es: 'Mensaje (hasta 4.000 caracteres)', en: 'Message (up to 4,000 characters)' };
  async function create(lang = 'es', viewport = { width: 1280, height: 900 }) {
    const page = await browser.newPage({ viewport }); const posts = []; const errors = []; const stored = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(l => { localStorage.setItem('elevation_token', 'synthetic-session'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l); }, lang);
    await page.route('**/api/**', async route => {
      const req = route.request(); const url = new URL(req.url());
      if (req.method() === 'POST' && url.pathname === '/api/chat') {
        const body = JSON.parse(req.postData() || '{}'); posts.push(body);
        stored.push({ role: 'user', text: body.message }, { role: 'bot', text: 'Respuesta sintética.' });
        return route.fulfill({ json: { reply: 'Respuesta sintética.', requestId: body.requestId } });
      }
      if (url.pathname === '/api/messages') return route.fulfill({ json: stored });
      return route.fulfill({ json: [] });
    });
    return { page, posts, errors };
  }
  const heading = (page, name) => page.getByRole('heading', { name, exact: true });
  try {
    { // Con bandera: menú, banda, modo en la solicitud, salir sin enviar
      const { page, posts, errors } = await create('es');
      await page.goto(preview + '/app/chat');
      await page.getByLabel(composer.es).waitFor();
      assert.equal(await page.getByRole('link', { name: 'Brújula profesional', exact: true }).count(), 1);
      await page.getByRole('link', { name: 'Brújula profesional', exact: true }).click(); await page.waitForURL('**/app/chat?mode=compass');
      await heading(page, 'Brújula profesional').waitFor();
      await page.getByText('No es terapia ni un diagnóstico, y no promete resultados laborales. Puedes parar cuando quieras.').waitFor();
      assert.equal(await page.getByRole('button', { name: 'Ahora no', exact: true }).count(), 1);
      assert.equal(await page.getByRole('region', { name: 'Brújula profesional' }).count(), 1);
      check('con bandera: enlace del menú, banda con el texto aprobado y «Ahora no»');
      await page.getByRole('button', { name: 'Ahora no', exact: true }).click(); await page.waitForURL('**/app/chat');  await page.waitForTimeout(500);
      assert.equal(await heading(page, 'Brújula profesional').count(), 0); assert.equal(posts.length, 0);
      check('«Ahora no» vuelve al chat normal sin enviar nada');
      await page.goto(preview + '/app/chat?mode=compass'); await heading(page, 'Brújula profesional').waitFor();
      await page.getByLabel(composer.es).fill('Quiero explorar otra profesión'); page.once('dialog', d => d.dismiss());
      await page.getByRole('button', { name: 'Cerrar sin presión', exact: true }).click();
      assert.ok(page.url().includes('mode=compass'), 'con texto sin enviar pide confirmar y, al descartar, se queda'); assert.equal(posts.length, 0);
      check('con texto sin enviar, salir pide confirmación y no envía');
      await page.getByRole('button', { name: 'Enviar', exact: true }).click(); await page.getByText('Respuesta sintética.').waitFor();
      assert.equal(posts.length, 1); assert.equal(posts[0].mode, 'compass');
      assert.equal(await page.getByRole('button', { name: 'Ahora no', exact: true }).count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Cerrar sin presión', exact: true }).count(), 1);
      check('el mensaje viaja con mode=compass; tras enviar solo queda «Cerrar sin presión»');
      await page.getByRole('button', { name: 'Cerrar sin presión', exact: true }).click(); await page.waitForURL('**/app/chat'); assert.equal(posts.length, 1);
      await page.getByLabel(composer.es).fill('Otra cosa'); await page.getByRole('button', { name: 'Enviar', exact: true }).click();
      await page.waitForFunction(() => document.body.innerText.includes('Otra cosa'));
      assert.equal(posts.length, 2); assert.equal('mode' in posts[1], false);
      check('cerrar vuelve al chat normal: la siguiente solicitud ya no lleva mode');
      await page.goto(preview + '/app/chat?mode=compass'); await heading(page, 'Brújula profesional').waitFor();
      const order = []; for (let i = 0; i < 16; i++) { await page.keyboard.press('Tab'); order.push(await page.evaluate(() => (document.activeElement && document.activeElement.textContent || '').trim())); }
      assert.ok(order.includes('Cerrar sin presión') && order.indexOf('Ahora no') > order.indexOf('Cerrar sin presión'), 'orden de foco: ' + order.join('|'));
      check('teclado: «Cerrar sin presión» y «Ahora no» son alcanzables en orden lógico'); assert.deepEqual(errors, []); await page.close();
    }
    { // EN y móvil
      const { page, errors } = await create('en', { width: 375, height: 800 });
      await page.goto(preview + '/app/chat?mode=compass'); await heading(page, 'Professional compass').waitFor();
      await page.getByText('It is not therapy or a diagnosis, and it does not promise job outcomes. You can stop whenever you like.').waitFor();
      await page.getByRole('button', { name: 'Close, no pressure', exact: true }).waitFor(); await page.getByRole('button', { name: 'Not now', exact: true }).waitFor();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'sin scroll horizontal a 375px');
      check('EN y móvil 375px: textos aprobados, sin scroll horizontal'); assert.deepEqual(errors, []); await page.close();
    }
    { // Sin bandera: nada cambia
      const { page, posts, errors } = await create('es');
      await page.goto(release + '/app/chat?mode=compass'); await page.getByLabel(composer.es).waitFor();
      assert.equal(await page.getByRole('link', { name: 'Brújula profesional', exact: true }).count(), 0);
      assert.equal(await heading(page, 'Brújula profesional').count(), 0);
      await page.getByLabel(composer.es).fill('Hola'); await page.getByRole('button', { name: 'Enviar', exact: true }).click(); await page.getByText('Respuesta sintética.').waitFor();
      assert.equal(posts.length, 1); assert.equal('mode' in posts[0], false);
      check('sin bandera: ni enlace ni banda, y ?mode=compass no cambia la solicitud'); assert.deepEqual(errors, []); await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
