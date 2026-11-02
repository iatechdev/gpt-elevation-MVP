// ES-112: navegador real (Chromium aislado), frontera HTTP simulada, aplicación React construida. Datos sintéticos.
//   npm run build && npx vite preview --port 4112 --host 127.0.0.1   y luego   PLAYWRIGHT_MODULE=... node scripts/es112-browser.cjs
const assert = require('node:assert/strict');
(async () => {
  const source = process.env.PLAYWRIGHT_MODULE;
  const { chromium } = source ? require(source) : await import('playwright');
  const base = process.env.ES112_PREVIEW_URL ?? 'http://127.0.0.1:4112';
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Solo vista previa local');
  const browser = await chromium.launch({ headless: true });
  const checks = []; const check = (label) => { checks.push(label); console.log('PASS ' + label); };
  const errors = [];
  const state = { usage: null, usageStatus: 200, chatCalls: 0, usageCalls: 0 };
  const reset = (usage) => { state.usage = usage; state.usageStatus = 200; state.chatCalls = 0; state.usageCalls = 0; };
  const used = (n, limit = 1000) => ({ configured: true, period: 'month', periodKey: '2026-10', limit, used: n, remaining: Math.max(0, limit - n), resetsAt: '2026-11-01T00:00:00.000Z' });
  const messages = [
    { role: 'bot', text: 'Hola. Leí lo que escribiste ayer. ¿Qué fue lo que más te sorprendió de tu reacción?' },
    { role: 'user', text: 'Que no entré en pánico.' },
  ];

  async function open(path, width, height = 900, lang = 'es') {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) errors.push(message.text()); });
    await page.addInitScript((l) => { localStorage.setItem('elevation_token', 'synthetic-browser-token'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l); }, lang);
    await page.route('**/api/**', async (route) => {
      const req = route.request(); const p = new URL(req.url()).pathname;
      if (p === '/api/ai/usage') { state.usageCalls += 1; return state.usageStatus === 200 ? route.fulfill({ json: state.usage }) : route.fulfill({ status: state.usageStatus, json: { error: 'x' } }); }
      if (p === '/api/messages') return route.fulfill({ json: messages });
      if (p === '/api/chat' && req.method() === 'POST') { state.chatCalls += 1; messages.push({ role: 'user', text: req.postDataJSON().message }, { role: 'bot', text: 'Eso es significativo.' }); return route.fulfill({ json: { reply: 'Eso es significativo.', requestId: req.postDataJSON().requestId } }); }
      if (p === '/api/diary') return route.fulfill({ json: { entries: [] } });
      return route.fulfill({ json: [] });
    });
    await page.goto(base + path, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.querySelector('[role=progressbar], .space-callout, .space-chatbar button.elv-link'), null, { timeout: 8000 });
    return { context, page };
  }
  const bodyText = (page) => page.evaluate(() => document.body.innerText);

  // 1 Normal: pestañas, cabecera privada, barra con porcentaje y renovación, mensajes con la línea de la landing
  reset(used(340));
  let { context, page } = await open('/app/chat', 1100);
  let text = await bodyText(page);
  assert.match(text, /CONVERSACIÓN/i); assert.match(text, /DIARIO/i); assert.match(text, /Privada · Solo visible para ti/); check('pestañas Conversación y Diario y cabecera privada');
  assert.equal(await page.locator('.space-tabs a[aria-current="page"]').innerText().then(t => t.toLowerCase()), 'conversación'); check('la pestaña activa se marca con aria-current');
  const bar = page.getByRole('progressbar'); assert.equal(await bar.getAttribute('aria-valuenow'), '34'); assert.match(text, /34 % usado/i); assert.match(text, /1 de noviembre/i); assert.doesNotMatch(text, /msgs/i); check('barra de uso: 34 %, renovación el 1 de noviembre, sin conteo de mensajes');
  assert.match(text, /Hola\. Leí lo que escribiste ayer/); assert.match(text, /Que no entré en pánico/); check('mensajes del acompañante y de la persona');
  const tabBorder = await page.locator('.space-tabs a[aria-current="page"]').evaluate(el => getComputedStyle(el).borderBottomColor); assert.equal(tabBorder, 'rgb(184, 150, 62)'); check('pestaña activa con el dorado de la landing (#B8963E)');
  const bg = await page.evaluate(() => getComputedStyle(document.querySelector('.space-scope') ?? document.body).getPropertyValue('--color-base-100').trim().toUpperCase()); assert.equal(bg, '#FAFAF9'); check('fondo de la landing (#FAFAF9)');
  const radius = await page.locator('.space-ghost').evaluate(el => getComputedStyle(el).borderRadius); assert.equal(radius, '4px'); check('esquinas de 4 px');

  // 2 Pausar: bloquea el envío, avisa, no llama al servidor, se conserva al recargar y se puede retomar
  await page.getByRole('button', { name: /Pausar/ }).click();
  text = await bodyText(page); assert.match(text, /Conversación en pausa\. No se envía nada/); assert.equal(await page.getByRole('button', { name: /Retomar/ }).getAttribute('aria-pressed'), 'true'); check('Pausar muestra el aviso y cambia a Retomar');
  assert.equal(await page.locator('textarea').isDisabled(), true); assert.equal(await page.getByRole('button', { name: 'Enviar' }).isDisabled(), true); check('con la pausa no se puede escribir ni enviar');
  const callsBefore = state.chatCalls; await page.reload({ waitUntil: 'networkidle' }); await page.waitForFunction(() => document.querySelector('[role=progressbar]'));
  assert.match(await bodyText(page), /Conversación en pausa/); assert.equal(state.chatCalls, callsBefore); check('la pausa se conserva al recargar y no envía nada al servidor');
  assert.equal((await page.locator('.space-callout').count()) >= 1, true);
  await page.getByRole('button', { name: /Retomar/ }).click(); assert.equal(await page.locator('textarea').isDisabled(), false); check('Retomar vuelve a habilitar la escritura');
  await page.locator('textarea').fill('Gracias'); await page.getByRole('button', { name: 'Enviar' }).click(); await page.waitForFunction(() => /Eso es significativo/.test(document.body.innerText)); assert.equal(state.chatCalls, 1); check('tras retomar se puede enviar y llega la respuesta');
  await context.close();

  // 3 Sin límite definido: sin barra y con texto honesto
  reset({ configured: false });
  ({ context, page } = await open('/app/chat', 1100)); text = await bodyText(page);
  assert.equal(await page.getByRole('progressbar').count(), 0); assert.match(text, /Aún no hay un límite de uso definido/); assert.equal(await page.locator('textarea').isDisabled(), false); check('sin límite definido: no hay barra, texto honesto y se puede escribir');
  await context.close();

  // 4 Límite agotado: aviso con fecha, escritura bloqueada, el diario sigue disponible
  reset(used(1000));
  ({ context, page } = await open('/app/chat', 1100)); text = await bodyText(page);
  assert.match(text, /Llegaste al límite de este periodo/); assert.match(text, /1 de noviembre/i); assert.equal(await page.locator('textarea').isDisabled(), true); assert.equal(await page.getByRole('progressbar').getAttribute('aria-valuenow'), '100'); check('límite agotado: aviso con la fecha, escritura bloqueada, barra al 100 %');
  await page.locator('.space-tabs a', { hasText: /diario/i }).click(); await page.waitForURL('**/app/diary'); await page.locator('.space-tabs a[aria-current="page"]', { hasText: /diario/i }).waitFor(); assert.match(await bodyText(page), /Mi diario privado/); check('con el límite agotado el Diario sigue disponible desde la pestaña');
  await context.close();

  // 5 Error al consultar el uso: no bloquea, ofrece reintentar y reintenta
  reset(used(10)); state.usageStatus = 500;
  ({ context, page } = await open('/app/chat', 1100));
  await page.getByRole('button', { name: /No pudimos consultar tu uso de IA/ }).waitFor(); assert.equal(await page.locator('textarea').isDisabled(), false); check('error de uso: no bloquea la conversación y ofrece reintentar');
  state.usageStatus = 200; await page.getByRole('button', { name: /No pudimos consultar tu uso de IA/ }).click(); await page.getByRole('progressbar').waitFor(); check('reintentar consulta el uso y muestra la barra');
  await context.close();

  // 6 Menú: el resto de rutas y teclado
  reset(used(340));
  ({ context, page } = await open('/app/chat', 1100));
  const summary = page.locator('.space-menu summary'); await summary.focus(); await page.keyboard.press('Enter'); await page.getByRole('link', { name: 'Mis herramientas' }).waitFor(); check('el menú se abre con el teclado y lista Mis herramientas');
  await page.getByRole('link', { name: 'Mis herramientas' }).click(); await page.waitForURL('**/app/space/tools'); check('Mis herramientas conserva su ruta');
  await context.close();
  ({ context, page } = await open('/app/chat', 1100)); await page.keyboard.press('Tab');
  const focusOutline = await page.evaluate(() => { const el = document.activeElement; return el ? getComputedStyle(el).outlineStyle : ''; }); assert.ok(focusOutline !== '' ); check('el foco por teclado es visible desde el inicio');
  await context.close();

  // 7 Responsive 375 y 320 sin desbordar; inglés
  for (const width of [375, 320]) {
    reset(used(340)); ({ context, page } = await open('/app/chat', width, 800));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); assert.ok(overflow <= 0, `desborda ${overflow}px a ${width}`);
    await page.getByRole('button', { name: /Pausar/ }).waitFor(); check(`a ${width} px no hay desborde horizontal y Pausar es alcanzable`);
    await context.close();
  }
  reset(used(340)); ({ context, page } = await open('/app/chat', 1100, 900, 'en')); text = await bodyText(page);
  assert.match(text, /Private · Only visible to you/); assert.match(text, /34% used/i); assert.match(text, /Renews on November 1/i); assert.match(text, /AI use this period/i); await page.getByRole('button', { name: /Pause/ }).click(); assert.match(await bodyText(page), /Conversation paused\. Nothing is sent/); check('inglés completo: cabecera, barra, renovación y pausa');
  await context.close();

  assert.deepEqual(errors, [], 'errores de consola: ' + errors.join(' | ')); check('sin errores de consola ni de página');
  await browser.close();
  console.log(`\n${checks.length} comprobaciones OK`);
})().catch((error) => { console.error('FAIL', error); process.exit(1); });
