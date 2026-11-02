// ES-111: navegador real (Chromium aislado), frontera HTTP simulada del puente (/api/career-context), aplicación React construida. Datos sintéticos.
//   VITE_BRIDGE_INSIGHTS_FIXTURES=true vite build --outDir dist-fx  →  vite preview --outDir dist-fx --port 4111   (con ejemplos)
//   vite build --outDir dist-empty                                   →  vite preview --outDir dist-empty --port 4112 (sin ejemplos)
const assert = require('node:assert/strict');
(async () => {
  const source = process.env.PLAYWRIGHT_MODULE;
  const { chromium } = source ? require(source) : await import('playwright');
  const withExamples = process.env.ES111_URL ?? 'http://127.0.0.1:4111';
  const withoutExamples = process.env.ES111_EMPTY_URL ?? 'http://127.0.0.1:4112';
  for (const url of [withExamples, withoutExamples]) assert.ok(['127.0.0.1', 'localhost'].includes(new URL(url).hostname), 'Solo vista previa local');
  const browser = await chromium.launch({ headless: true });
  const checks = []; const check = (label) => { checks.push(label); console.log('PASS ' + label); };
  const errors = [];
  const state = { versions: [], previews: [], confirms: [], revokes: 0, failConfirm: null, requests: [] };
  const reset = () => { state.versions = []; state.previews = []; state.confirms = []; state.revokes = 0; state.failConfirm = null; state.requests = []; };
  const active = () => state.versions.find((v) => v.status === 'active') ?? null;
  const record = (v) => ({ version: v.version, status: v.status, approvedAt: v.approvedAt, revokedAt: v.revokedAt, fields: v.fields });

  async function open(base, path = '/app/bridge', width = 1100, lang = 'es') {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) errors.push(message.text()); });
    await page.addInitScript((l) => { localStorage.setItem('elevation_token', 'synthetic-browser-token'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l); }, lang);
    await page.route('**/api/**', async (route) => {
      const req = route.request(); const p = new URL(req.url()).pathname; const m = req.method();
      state.requests.push(`${m} ${p}`);
      if (p === '/api/career-context' && m === 'GET') { const a = active(); return route.fulfill({ json: { active: a ? { ...record(a), needsReview: !!a.needsReview } : null, versions: [...state.versions].reverse().map((v) => (v.status === 'active' ? { ...record(v), needsReview: !!v.needsReview } : record(v))) } }); }
      if (p === '/api/career-context/preview') { const body = req.postDataJSON(); state.previews.push(body); return route.fulfill({ json: { token: `${Date.now() + 600000}.${'a'.repeat(64)}`, expiresAt: new Date(Date.now() + 600000).toISOString(), representation: body.fields.map(({ key, text }) => ({ key, text })) } }); }
      if (p === '/api/career-context/confirm') {
        const body = req.postDataJSON(); state.confirms.push(body);
        if (state.failConfirm) { const f = state.failConfirm; state.failConfirm = null; return route.fulfill({ status: f.status, json: { code: f.code } }); }
        state.versions.forEach((v) => { if (v.status === 'active') v.status = 'superseded'; });
        const v = { version: state.versions.length + 1, status: 'active', approvedAt: '2026-10-29T15:00:00.000Z', revokedAt: null, fields: body.fields.map(({ key, text }) => ({ key, text })) };
        state.versions.push(v); return route.fulfill({ status: 201, json: record(v) });
      }
      if (p === '/api/career-context/revoke') { state.revokes += 1; const a = active(); if (a) { a.status = 'revoked'; a.revokedAt = '2026-10-29T16:00:00.000Z'; } return route.fulfill({ json: { revoked: !!a } }); }
      return route.fulfill({ json: [] });
    });
    await page.goto(base + path, { waitUntil: 'networkidle' });
    await page.waitForSelector(path === '/app/bridge' ? '.bridge-cols' : '.space-menu', { timeout: 8000 });
    return { context, page };
  }
  const text = (page) => page.evaluate(() => document.body.innerText);

  // 1 Pantalla inicial con ejemplos marcados
  reset();
  let { context, page } = await open(withExamples);
  let body = await text(page);
  assert.match(body, /EL PUENTE/i); assert.match(body, /ZONA DE AUTORIZACIÓN EXPLÍCITA/i); assert.match(body, /Eres el único que decide qué cruza/); assert.match(body, /TU DIARIO PRIVADO/i); assert.match(body, /TU PERFIL PROFESIONAL/i); check('cabecera, zona de autorización y las dos columnas');
  assert.match(body, /ejemplos de demostración/); assert.equal(await page.locator('.bridge-card').count(), 3); assert.match(body, /Nada ha cruzado aún/i); check('con el interruptor hay 3 insights de ejemplo marcados como tales y la columna profesional está vacía');
  assert.equal(await page.locator('.bridge-frag.bridge-blur').count(), 3); assert.equal(await page.locator('.bridge-frag span[aria-hidden="true"]').count(), 3); check('los fragmentos arrancan difuminados y ocultos para lectores de pantalla');
  const first = page.locator('.bridge-card').first();
  await first.getByRole('button', { name: 'Mostrar fragmento' }).click(); assert.equal(await first.locator('.bridge-blur').count(), 0); assert.equal(await first.getByRole('button', { name: 'Ocultar fragmento' }).getAttribute('aria-pressed'), 'true'); check('el ojo muestra el fragmento y el botón cambia de etiqueta');
  await first.getByRole('button', { name: 'Ocultar fragmento' }).click(); assert.equal(await first.locator('.bridge-blur').count(), 1); check('el ojo vuelve a ocultarlo');
  const cols = await page.evaluate(() => getComputedStyle(document.querySelector('.bridge-cols')).gridTemplateColumns.split(' ').length); assert.equal(cols, 3); check('en escritorio hay dos columnas separadas por el puente');

  // 2 Autorizar: pregunta primero, Cancelar no deja rastro, Confirmar guarda con la API del puente y mueve el insight
  await first.getByRole('button', { name: /Autorizar cruce/ }).click();
  assert.match(await first.innerText(), /Este insight aparecerá en tu perfil profesional\. ¿Confirmas\?/); assert.equal(state.confirms.length + state.previews.length, 0); check('«Autorizar cruce» solo pregunta: no hay vista previa ni confirmación en el servidor');
  assert.equal(await page.evaluate(() => document.activeElement?.textContent?.trim()), 'Confirmar'); check('el foco pasa a «Confirmar»');
  await page.keyboard.press('Escape'); assert.equal(await first.getByRole('button', { name: /Autorizar cruce/ }).count(), 1); assert.equal(await page.evaluate(() => /Autorizar cruce/i.test(document.activeElement?.textContent ?? '')), true); check('Escape cancela, no deja rastro y devuelve el foco a «Autorizar cruce»');
  await first.getByRole('button', { name: /Autorizar cruce/ }).click(); await first.getByRole('button', { name: 'Cancelar' }).click(); assert.equal(state.confirms.length, 0); check('«Cancelar» no envía nada');
  await first.getByRole('button', { name: /Autorizar cruce/ }).click(); await first.getByRole('button', { name: 'Confirmar' }).click();
  await page.locator('.bridge-done').first().waitFor();
  assert.equal(state.previews.length, 1); assert.equal(state.confirms.length, 1); assert.match(state.confirms[0].requestId, /^[0-9a-f-]{36}$/); check('confirmar pide vista previa y confirma con un requestId nuevo');
  assert.deepEqual(state.confirms[0].fields, [{ key: 'energy_gives', text: 'Liderazgo en situaciones de alta presión', origin: { type: 'direct' } }]); check('lo que cruza es solo clave y texto del insight, como texto directo');
  const wire = JSON.stringify([state.previews, state.confirms]); assert.doesNotMatch(wire, /sostuve la presión|reunión|fragment|fragmento/i); check('el fragmento del diario no viaja en ninguna petición');
  body = await text(page); assert.equal(await page.locator('.bridge-card').count(), 2); assert.match(await page.locator('.bridge-col').nth(1).innerText(), /Liderazgo en situaciones de alta presión/); assert.match(body, /Versión 1/); check('el insight sale de la columna del diario y aparece en «Tu perfil profesional» con su versión');
  assert.match(await page.locator('.bridge-live').innerText(), /Autorizado/); check('el resultado se anuncia con aria-live');

  // 3 Segundo insight: la versión nueva conserva el anterior
  await page.locator('.bridge-card').first().getByRole('button', { name: /Autorizar cruce/ }).click(); await page.locator('.bridge-card').first().getByRole('button', { name: 'Confirmar' }).click();
  await page.waitForFunction(() => document.querySelectorAll('.bridge-done').length === 2);
  assert.equal(state.confirms[1].fields.length, 2); assert.equal(active().version, 2); check('autorizar otro añade a lo ya autorizado en una versión nueva');

  // 4 Revocar uno
  await page.locator('.bridge-done').first().getByRole('button', { name: /Revocar/ }).click(); await page.waitForFunction(() => document.querySelectorAll('.bridge-done').length === 1);
  assert.equal(state.confirms.at(-1).fields.length, 1); assert.equal(await page.locator('.bridge-card').count(), 2); check('revocar uno confirma la versión sin él y el insight vuelve a la columna del diario');

  // 5 Revocar todos pide confirmación
  await page.getByRole('button', { name: 'Revocar todos' }).click(); assert.equal(state.revokes, 0); assert.match(await text(page), /Se retirará todo lo que cruzó/); check('«Revocar todos» pregunta antes de actuar');
  await page.getByRole('group', { name: /Se retirará todo/ }).getByRole('button', { name: 'Confirmar' }).click(); await page.waitForFunction(() => document.querySelectorAll('.bridge-done').length === 0);
  assert.equal(state.revokes, 1); assert.equal(await page.locator('.bridge-card').count(), 3); check('revocar todos revoca la versión activa y todo vuelve a la columna del diario');
  await context.close();

  // 5b Pestaña desactualizada (ES111-QA-01/02): otra pestaña cambió lo autorizado; esta NO compone con su lista vieja
  reset(); ({ context, page } = await open(withExamples));
  state.versions.push({ version: 1, status: 'active', approvedAt: '2026-10-29T15:00:00.000Z', revokedAt: null, fields: [{ key: 'values', text: 'Autorizado desde otra pestaña' }] });
  let stale = page.locator('.bridge-card').first(); await stale.getByRole('button', { name: /Autorizar cruce/ }).click(); await stale.getByRole('button', { name: 'Confirmar' }).click();
  await page.locator('.bridge-error').waitFor(); assert.match(await page.locator('.bridge-error').innerText(), /cambió desde otra pestaña/); assert.equal(state.confirms.length, 0); assert.equal(state.previews.length, 0); check('con la lista desactualizada no se compone nada: se avisa y no se confirma ni se pide vista previa');
  assert.match(await page.locator('.bridge-col').nth(1).innerText(), /Autorizado desde otra pestaña/); assert.equal(await page.evaluate(() => document.activeElement?.id), 'bridge-pro'); check('la pantalla se actualiza con lo que hay en el servidor y el foco va a «Tu perfil profesional»');
  stale = page.locator('.bridge-card').first(); await stale.getByRole('button', { name: /Autorizar cruce/ }).click(); await stale.getByRole('button', { name: 'Confirmar' }).click(); await page.waitForFunction(() => document.querySelectorAll('.bridge-done').length === 2);
  assert.equal(state.confirms.length, 1); assert.equal(state.confirms[0].fields.length, 2); assert.equal(state.confirms[0].fields[0].text, 'Autorizado desde otra pestaña'); check('al reintentar se compone sobre lo vigente: no se pierde lo autorizado en la otra pestaña');
  state.versions.at(-1).fields = state.versions.at(-1).fields.filter((f) => f.text !== 'Autorizado desde otra pestaña');
  stale = page.locator('.bridge-card').first(); await stale.getByRole('button', { name: /Autorizar cruce/ }).click(); await stale.getByRole('button', { name: 'Confirmar' }).click();
  await page.locator('.bridge-error').waitFor(); assert.equal(state.confirms.length, 1); check('si otra pestaña retiró un texto, tampoco vuelve a cruzar desde esta');
  await context.close();

  // 5c Foco al cancelar y reintento con el mismo requestId (ES111-QA-03/04)
  reset(); ({ context, page } = await open(withExamples));
  const cardOne = page.locator('.bridge-card').first(); const id = await cardOne.locator('[data-authorize]').getAttribute('data-authorize');
  await cardOne.getByRole('button', { name: /Autorizar cruce/ }).click(); await cardOne.getByRole('button', { name: 'Cancelar' }).click();
  assert.equal(await page.evaluate((i) => document.activeElement?.getAttribute('data-authorize') === i, id), true); check('al cancelar el foco vuelve al botón «Autorizar cruce» de la misma tarjeta');
  state.failConfirm = { status: 500, code: 'x' };
  await page.locator('.bridge-card').first().getByRole('button', { name: /Autorizar cruce/ }).click(); await page.locator('.bridge-card').first().getByRole('button', { name: 'Confirmar' }).click(); await page.locator('.bridge-error').waitFor();
  await page.locator('.bridge-card').first().getByRole('button', { name: 'Confirmar' }).click(); await page.waitForSelector('.bridge-done'); // tras el error la pregunta sigue abierta: se reintenta con Confirmar
  assert.equal(state.confirms.length, 2); assert.equal(state.confirms[0].requestId, state.confirms[1].requestId); check('reintentar el mismo cruce tras un fallo usa el mismo requestId');
  assert.ok(await page.evaluate(() => document.activeElement?.id === 'bridge-pro')); check('tras autorizar el foco va a «Tu perfil profesional» (la tarjeta ya no existe)');
  await context.close();

  // 6 Errores del servidor: no cruza nada y se explica
  for (const [status, code, expected] of [[422, 'field_not_shareable', /no se puede compartir/], [403, 'consent_required', /Necesitas autorizar el puente/], [409, 'conflict', /Otro cambio ocurrió/], [500, 'x', /No pudimos guardar/]]) {
    reset(); ({ context, page } = await open(withExamples)); state.failConfirm = { status, code };
    const card = page.locator('.bridge-card').first(); await card.getByRole('button', { name: /Autorizar cruce/ }).click(); await card.getByRole('button', { name: 'Confirmar' }).click();
    await page.locator('.bridge-error').waitFor(); assert.match(await page.locator('.bridge-error').innerText(), expected); assert.equal(await page.locator('.bridge-done').count(), 0); assert.equal(await page.locator('.bridge-card').count(), 3);
    await context.close();
  }
  check('422, 403, 409 y 500: se explica sin culpar, no cruza nada y el insight sigue en el diario');

  // 7 Para revisión y tope por categoría
  reset(); ({ context, page } = await open(withExamples));
  state.versions.push({ version: 1, status: 'active', approvedAt: '2026-10-20T12:00:00.000Z', revokedAt: null, needsReview: true, fields: [{ key: 'values', text: 'Algo escrito en la Brújula' }, { key: 'energy_gives', text: 'Uno' }, { key: 'energy_gives', text: 'Dos' }, { key: 'energy_gives', text: 'Tres' }] });
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForSelector('.bridge-cols');
  assert.match(await text(page), /PARA REVISIÓN/i); assert.match(await text(page), /Algo escrito en la Brújula/); check('lo ya autorizado se muestra, incluido lo de la Brújula, con el aviso «Para revisión»');
  assert.match(await text(page), /Ya hay 3 textos de esta categoría/); assert.equal(await page.locator('.bridge-card').first().getByRole('button', { name: /Autorizar cruce/ }).isDisabled(), true); check('con 3 textos de una categoría el cuarto no se puede autorizar y se explica');
  await context.close();

  // 8 Sin ejemplos: estado vacío honesto y enlace a la Brújula
  reset(); ({ context, page } = await open(withoutExamples)); body = await text(page);
  assert.match(body, /Aún no hay insights para mostrar/); assert.equal(await page.locator('.bridge-card').count(), 0); assert.doesNotMatch(body, /ejemplos de demostración/); assert.equal(await page.getByRole('link', { name: 'Añadir algo a mano' }).getAttribute('href'), '/app/compass'); check('sin el interruptor no se muestra ningún insight: estado vacío honesto con enlace a la Brújula');
  await context.close();

  // 9 Teclado: menú, ruta y recorrido completo con teclado
  reset(); ({ context, page } = await open(withExamples, '/app/chat')); await page.locator('.space-menu summary').focus(); await page.keyboard.press('Enter');
  await page.getByRole('link', { name: 'El Puente' }).click(); await page.waitForURL('**/app/bridge'); await page.waitForSelector('.bridge-cols'); check('«El Puente» está en el menú de Mi espacio y la ruta funciona');
  await page.locator('.bridge-card').first().getByRole('button', { name: /Autorizar cruce/ }).focus(); await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
  await page.waitForSelector('.bridge-done'); assert.equal(await page.locator('.bridge-done').count(), 1); check('autorizar completo solo con el teclado (Enter, Enter)');
  await context.close();

  // 10 Responsive y EN
  for (const width of [375, 320]) {
    reset(); ({ context, page } = await open(withExamples, '/app/bridge', width));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); assert.ok(overflow <= 0, `desborda ${overflow}px a ${width}`);
    const oneCol = await page.evaluate(() => getComputedStyle(document.querySelector('.bridge-cols')).gridTemplateColumns.split(' ').length); assert.equal(oneCol, 1);
    await context.close();
  }
  check('a 375 y 320 px: una columna y sin desborde horizontal');
  reset(); ({ context, page } = await open(withExamples, '/app/bridge', 1100, 'en')); body = await text(page);
  assert.match(body, /THE BRIDGE/i); assert.match(body, /EXPLICIT AUTHORIZATION ZONE/i); assert.match(body, /Leadership under high pressure/); assert.match(body, /Nothing has crossed yet/i); await page.locator('.bridge-card').first().getByRole('button', { name: /Authorize crossing/ }).click(); assert.match(await text(page), /This insight will appear in your professional profile\. Do you confirm\?/); check('inglés completo: cabecera, insights, vacío y confirmación');
  await context.close();

  assert.deepEqual(errors, [], 'errores de consola: ' + errors.join(' | ')); check('sin errores de consola ni de página');
  await browser.close();
  console.log(`\n${checks.length} comprobaciones OK`);
})().catch((error) => { console.error('FAIL', error); process.exit(1); });
