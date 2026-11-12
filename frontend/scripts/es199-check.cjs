// ES-199: el chat con una conversación larga se pinta igual tras memoizar las burbujas (roles, textos, aviso de respuesta cortada solo en la última, teclear no altera la conversación) y sin violaciones axe.
// API simulada con page.route; datos sintéticos. Uso: npx vite build && npx vite preview --host 127.0.0.1 --port 4199 --strictPort   y luego
//   ES199_URL=http://127.0.0.1:4199 PLAYWRIGHT_MODULE=<ruta a playwright> AXE_PATH=<axe.min.js> node scripts/es199-check.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');

(async () => {
  const { chromium } = process.env.PLAYWRIGHT_MODULE ? require(process.env.PLAYWRIGHT_MODULE) : await import('playwright');
  const base = process.env.ES199_URL ?? 'http://127.0.0.1:4199';
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Solo vista previa local');
  const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8');
  const browser = await chromium.launch({ headless: true });
  const errors = []; let count = 0;
  const check = (label) => { count++; console.log('PASS ' + label); };
  const T = { es: { you: 'Tú', truncated: 'La respuesta se cortó por longitud.', go: 'Continuar' }, en: { you: 'You', truncated: 'The response was cut off because of its length.', go: 'Continue' } };
  const N = 200;
  const messages = (truncatedLast) => Array.from({ length: N }, (_, i) => ({ role: i % 2 === 0 ? 'user' : 'bot', text: `Mensaje sintético ${i + 1}`, ...(truncatedLast && i === N - 1 ? { truncated: true } : {}) }));

  for (const [width, lang] of [[390, 'es'], [390, 'en'], [1360, 'es'], [1360, 'en']]) {
    const tag = `${width}px ${lang}`; const c = T[lang];
    for (const truncatedLast of [false, true]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      const page = await context.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
      await page.addInitScript(([l]) => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l); }, [lang]);
      await page.route('**/api/**', (route) => {
        const p = new URL(route.request().url()).pathname;
        if (p === '/api/session') return route.fulfill({ json: { role: 'user', onboardingCompleted: true } });
        if (p === '/api/messages') return route.fulfill({ json: messages(truncatedLast) });
        if (p === '/api/ai/usage') return route.fulfill({ json: { configured: false } });
        return route.fulfill({ json: [] });
      });
      await page.goto(base + '/app/chat', { waitUntil: 'networkidle' });
      const box = page.locator('textarea.space-message');
      await page.waitForFunction(() => { const t = document.querySelector('textarea.space-message'); return t && !t.disabled; });
      const bubbles = page.locator('.chat-scroll > div > div');
      const total = await bubbles.count(); // además de las N burbujas hay bloques de contexto del chat al final
      assert.ok(total >= N && total <= N + 4, `${N} burbujas (${tag}): ${total}`);
      assert.match(await bubbles.nth(N - 1).innerText(), /Mensaje sintético 200/, `la burbuja ${N} es la última (${tag})`);
      assert.match(await bubbles.nth(0).innerText(), new RegExp(`${c.you}[\\s\\S]*Mensaje sintético 1$`, 'i'), `primera burbuja de la persona (${tag})`);
      assert.match(await bubbles.nth(1).innerText(), /Mensaje sintético 2/, `segunda burbuja del asistente (${tag})`);
      assert.match(await bubbles.nth(99).innerText(), /Mensaje sintético 100/);
      // El aviso de respuesta cortada solo sale en la última burbuja y solo si el servidor la marcó
      const notices = await page.getByText(c.truncated).count();
      assert.equal(notices, truncatedLast ? 1 : 0, `aviso de respuesta cortada (${tag}, cortada=${truncatedLast})`);
      if (truncatedLast) { assert.match(await bubbles.nth(N - 1).innerText(), new RegExp(c.truncated)); assert.ok(await page.getByRole('button', { name: c.go }).isVisible()); }
      // Teclear no altera la conversación
      await box.click(); await page.keyboard.type('hola, esto es una prueba de escritura', { delay: 5 });
      assert.equal(await box.inputValue(), 'hola, esto es una prueba de escritura');
      assert.equal(await bubbles.count(), total); assert.match(await bubbles.nth(N - 1).innerText(), /Mensaje sintético 200/);
      if (!truncatedLast) {
        await page.evaluate(axeSource);
        const violations = await page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] })).violations.map((v) => v.id + ':' + v.nodes.length));
        assert.deepEqual(violations, [], `axe (${tag})`);
      }
      await context.close();
    }
    check(`chat con ${N} mensajes (${tag}): roles y textos, aviso de respuesta cortada solo en la última, teclear no altera nada, axe 0`);
  }
  assert.deepEqual(errors, [], 'errores de consola o de página: ' + errors.join(' | '));
  console.log(`\nES-199 (chat): ${count} comprobaciones OK`);
  await browser.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
