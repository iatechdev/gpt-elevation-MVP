// ES-123: chat con conversación como área principal. Navegador real (Chromium aislado), servidor simulado, datos sintéticos.
//   npm run build && npx vite preview --port 4123 --host 127.0.0.1   y luego   PLAYWRIGHT_MODULE=... node scripts/es123-browser.cjs
// Capturas opcionales: ES123_SHOTS=<carpeta> (se escriben antes/después de abrir el selector, ES y EN, 1440/390/320).
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
  const source = process.env.PLAYWRIGHT_MODULE;
  const { chromium } = source ? require(source) : await import('playwright');
  const base = process.env.ES123_URL ?? 'http://127.0.0.1:4123';
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Solo vista previa local');
  const shots = process.env.ES123_SHOTS; if (shots) fs.mkdirSync(shots, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const checks = []; const check = (label) => { checks.push(label); console.log('PASS ' + label); };
  const errors = [];
  const long = Array.from({ length: 16 }, (_, i) => i % 2 === 0
    ? { role: 'bot', text: `Respuesta sintética ${i + 1}. ` + 'Esto es un texto de relleno para comprobar el scroll de la conversación. '.repeat(3) }
    : { role: 'user', text: `Mensaje sintético ${i + 1}. Cuento algo de mi día.` });
  const entries = [
    { id: 1, date: '2026-10-28', content: 'Hoy hablé con mi jefa sobre el cambio de área.', createdAt: '2026-10-28T10:00:00.000Z', updatedAt: '2026-10-28T10:00:00.000Z' },
    { id: 2, date: '2026-10-26', content: 'Reunión con el equipo de datos.', createdAt: '2026-10-26T10:00:00.000Z', updatedAt: '2026-10-26T10:00:00.000Z' },
  ];
  const usage = { configured: true, period: 'month', periodKey: '2026-10', limit: 1000, used: 420, remaining: 580, resetsAt: '2026-11-01T00:00:00.000Z' };

  async function open(width, height, lang = 'es', messages = long) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
    await page.addInitScript((l) => { localStorage.setItem('elevation_token', 'synthetic-browser-token'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l); }, lang);
    await page.route('**/api/**', async (route) => {
      const p = new URL(route.request().url()).pathname;
      if (p === '/api/ai/usage') return route.fulfill({ json: usage });
      if (p === '/api/messages') return route.fulfill({ json: messages });
      if (p === '/api/diary') return route.fulfill({ json: { entries } });
      if (/^\/api\/diary\/\d+$/.test(p)) return route.fulfill({ json: entries.find((e) => `/api/diary/${e.id}` === p) });
      return route.fulfill({ json: {} });
    });
    await page.goto(base + '/app/chat', { waitUntil: 'networkidle' });
    await page.locator('.chat-composer textarea').waitFor({ timeout: 8000 });
    return { context, page };
  }
  const geometry = (page) => page.evaluate(() => {
    const box = (sel) => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, height: r.height, left: r.left, right: r.right }; };
    return { vw: innerWidth, vh: innerHeight, docH: document.documentElement.scrollHeight, docW: document.documentElement.scrollWidth, scroll: box('.chat-scroll'), bar: box('.chat-input-bar'), area: box('.chat-composer textarea'), toggle: box('.chat-diary-toggle'),
      scrollable: (() => { const el = document.querySelector('.chat-scroll'); return el.scrollHeight > el.clientHeight; })() };
  });

  // 1 Escritorio 1440×900: la conversación manda, la página no crece y la caja es más grande que antes
  let { context, page } = await open(1440, 900);
  let g = await geometry(page);
  assert.ok(g.docH <= g.vh + 1, `la página crece a ${g.docH}px`); check('1440×900: la página no crece más allá de la pantalla (antes ≈12.900 px con conversaciones largas)');
  assert.ok(g.scroll.height >= 400, `conversación ${g.scroll.height}px`); console.log('  alto útil de la conversación:', Math.round(g.scroll.height), 'px'); check('1440×900: la conversación tiene ≥ 400 px de alto útil con scroll propio');
  assert.ok(g.scrollable, 'sin scroll propio'); check('la conversación larga se desplaza dentro de su región');
  assert.ok(g.area.height >= 96, `caja ${g.area.height}px`); check('la caja de mensaje mide ≥ 96 px (antes 88 px)');
  assert.ok(g.bar.bottom <= g.vh + 1 && g.scroll.bottom <= g.bar.top + 1, 'se montan'); check('la conversación termina donde empieza la caja: nada se monta');
  assert.equal(await page.locator('.chat-composer').getByText(/2\.000 caracteres|no autoriza su uso profesional/).count(), 0); check('el texto técnico de consentimiento no está siempre visible');
  assert.equal(await page.getByRole('button', { name: 'Mi progreso' }).count(), 1); assert.equal(await page.locator('.chat-scroll').getByRole('button', { name: 'Mi progreso' }).count(), 0); check('«Mi progreso» está en la cabecera con etiqueta, no suelto en la conversación');
  assert.equal(await page.getByRole('button', { name: 'Cerrar sesión' }).count() >= 1, true); check('el ícono de salida tiene etiqueta');
  assert.equal(await page.getByText('Asistente de IA').count(), 1); check('la identificación «Asistente de IA» sigue visible');
  // Adenda 1: etiqueta sin cifra y contador solo cerca del tope
  assert.equal(await page.locator('.chat-composer label').first().innerText().then((x) => x.trim()), 'Mensaje'); assert.equal(await page.locator('.chat-composer').getByText(/4\.000/).count(), 0); check('adenda 1: la etiqueta dice «Mensaje» y no muestra cifras de límite');
  const area = page.locator('.chat-composer textarea'); await area.fill('a'.repeat(3599)); assert.equal(await page.locator('.chat-counter').innerText(), ''); check('adenda 1: con 3.599 caracteres no hay contador');
  await area.fill('a'.repeat(3600)); assert.equal((await page.locator('.chat-counter').innerText()).trim(), '3.600 / 4.000 caracteres'); assert.equal(await page.locator('.chat-counter').getAttribute('aria-live'), 'polite'); check('adenda 1: desde 3.600 aparece «3.600 / 4.000 caracteres» en región aria-live polite');
  await area.fill('a'.repeat(4000)); assert.equal((await page.locator('.chat-counter').innerText()).trim(), 'Has llegado al máximo de 4.000 caracteres.'); check('adenda 1: a 4.000 el aviso dice que se llegó al máximo');
  await area.fill('');
  if (shots) await page.screenshot({ path: `${shots}/chat-1440-es.png` });

  // 2 Selector plegable: abre, lista, selecciona, muestra el texto técnico dentro, Esc cierra y devuelve el foco
  const toggle = page.getByRole('button', { name: /Diario: sin seleccionar/ });
  assert.equal(await toggle.getAttribute('aria-expanded'), 'false'); await toggle.click(); await page.locator('#chat-diary-panel').waitFor();
  assert.equal(await toggle.getAttribute('aria-expanded'), 'true'); assert.equal(await toggle.getAttribute('aria-controls'), 'chat-diary-panel'); check('el botón abre el selector y expone aria-expanded/aria-controls');
  await page.getByText('Hoy hablé con mi jefa').waitFor(); await page.getByLabel(/Hoy hablé con mi jefa/).check();
  assert.equal(await page.getByRole('button', { name: /Diario: 1\/3/ }).count(), 1); check('seleccionar una entrada actualiza el botón a «Diario: 1/3»');
  await page.getByText('Cómo se usa tu diario en el chat').click();
  assert.equal(await page.locator('#chat-diary-panel').getByText(/2\.000 caracteres/).isVisible(), true); assert.equal(await page.locator('#chat-diary-panel').getByText(/no autoriza su uso profesional/).isVisible(), true); check('el texto de consentimiento sigue disponible dentro del panel');
  g = await geometry(page); assert.ok(g.docH <= g.vh + 1 && g.bar.bottom <= g.vh + 1, 'el panel desborda la pantalla'); check('con el selector abierto la página sigue sin crecer');
  if (shots) await page.screenshot({ path: `${shots}/chat-1440-es-selector.png` });
  await page.keyboard.press('Escape'); assert.equal(await page.locator('#chat-diary-panel').count(), 0);
  assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.className.includes('chat-diary-toggle')), true); check('Esc cierra el selector y devuelve el foco al botón');
  assert.equal(await page.getByRole('button', { name: /Diario: 1\/3/ }).count(), 1); check('cerrar no borra la selección');
  // Orden de Tab hasta la caja de mensaje
  await page.locator('.chat-scroll').focus(); const order = []; for (let i = 0; i < 4; i++) { await page.keyboard.press('Tab'); order.push(await page.evaluate(() => (document.activeElement.tagName + '.' + (document.activeElement.className || '').split(' ')[0]))); }
  assert.match(order[0], /BUTTON\.elv-btn/); assert.match(order.join(' '), /TEXTAREA/); check('con Tab se llega del botón del diario a la caja de mensaje (el envío sigue deshabilitado sin texto): ' + order.join(' > '));
  await context.close();

  // 3 Móvil 390×844 y 320×568
  for (const [w, h] of [[390, 844], [320, 568]]) {
    ({ context, page } = await open(w, h)); g = await geometry(page);
    assert.ok(g.docW <= g.vw, `desborda horizontal ${g.docW}>${g.vw}`); assert.ok(g.docH <= g.vh + 1, `página ${g.docH}>${g.vh}`);
    assert.ok(g.scroll.height >= (h > 600 ? 250 : 100), `conversación ${g.scroll.height}px a ${w}×${h}`); console.log(`  ${w}×${h}: conversación`, Math.round(g.scroll.height), 'px; caja', Math.round(g.area.height), 'px');
    assert.ok(g.area.height >= 48, 'caja baja'); const send = await page.locator('.chat-composer-row .elv-btn').boundingBox(); assert.ok(send.height >= 44 && (h <= 700 || send.width >= g.vw * 0.8), `envío ${send.width}×${send.height}`);
    const tb = await page.locator('.chat-diary-toggle').boundingBox(); assert.ok(tb.height >= 44, `botón diario ${tb.height}`);
    check(`${w}×${h}: sin desborde horizontal, la página no crece, conversación con alto útil y objetivos táctiles ≥ 44 px`);
    if (shots) await page.screenshot({ path: `${shots}/chat-${w}-es.png` });
    await page.locator('.chat-diary-toggle').click(); await page.locator('#chat-diary-panel').waitFor(); g = await geometry(page);
    assert.ok(g.docH <= g.vh + 1 && g.bar.top >= 0, 'selector sale de pantalla'); check(`${w}×${h}: con el selector abierto todo cabe en la pantalla`);
    if (shots) await page.screenshot({ path: `${shots}/chat-${w}-es-selector.png` });
    await context.close();
  }

  // 4 Inglés: ningún texto en español en la pantalla de la persona
  ({ context, page } = await open(1440, 900, 'en', [{ role: 'bot', text: 'Hello. What would you like to explore today?' }]));
  await page.locator('.chat-diary-toggle').click(); await page.locator('#chat-diary-panel').waitFor();
  await page.getByText('How your journal is used in chat').click();
  const text = await page.locator('body').innerText();
  const spanish = text.match(/Diario|Conversaci[oó]n|Mi progreso|Enviar|Cerrar|Pausar|Uso de IA|Asistente|Mensaje \(hasta|Entradas|Elegir/g);
  assert.equal(spanish, null, 'texto en español con idioma EN: ' + JSON.stringify(spanish)); check('EN: la pantalla del chat (con el selector abierto) no contiene texto en español');
  assert.equal(await page.getByRole('button', { name: 'My progress' }).count(), 1); assert.equal(await page.getByRole('button', { name: /Journal: none selected/ }).count(), 1); check('EN: «My progress» y «Journal: none selected»');
  await page.getByRole('button', { name: 'Sign out' }).first().click(); await page.getByText('How are you leaving?').waitFor();
  await page.getByRole('button', { name: '😊' }).first().click().catch(() => {});
  const modal = await page.locator('body').innerText(); assert.doesNotMatch(modal, /Cerrar sesión|Saltar|Tómate|Tomá|¿Cómo/); check('EN: el check-out (cabecera, pregunta, botones) sale en inglés');
  if (shots) await page.screenshot({ path: `${shots}/chat-1440-en-checkout.png` });
  await context.close();
  ({ context, page } = await open(1440, 900, 'es', [{ role: 'bot', text: 'Hola.' }]));
  await page.getByRole('button', { name: 'Cerrar sesión' }).first().click(); await page.getByText('¿Cómo te vas?').waitFor(); const es = await page.locator('body').innerText();
  assert.match(es, /Tómate un momento antes de cerrar\./); assert.doesNotMatch(es, /Tomá/); check('ES: el check-out usa tuteo («Tómate un momento…»)');
  await context.close();

  assert.deepEqual(errors, [], 'errores de consola: ' + errors.join(' | ')); check('sin errores de consola');
  await browser.close(); console.log(`\n${checks.length} comprobaciones OK`);
})().catch((e) => { console.error('FAIL', e.message || e); process.exit(1); });
