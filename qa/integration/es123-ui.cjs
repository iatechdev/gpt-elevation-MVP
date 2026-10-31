// [QA-Claude] ES-123 · PR #108 (adendas 1 y 2, opción 2): revisión visual/funcional de /app/chat y /app/dashboard con backend local, Postgres real y proveedor SIMULADO.
// Uso: QA_API=http://127.0.0.1:9952 OUT=<carpeta> node qa/integration/es123-ui.cjs
const fs = require('fs'); const path = require('path'); const { chromium } = require('C:/Users/Usuario/tools/playwright/node_modules/playwright');
const API = process.env.QA_API; const OUT = process.env.OUT; fs.mkdirSync(OUT, { recursive: true }); const stamp = Date.now();
const check = (id, ok, d = '') => console.log(JSON.stringify({ id, ok: !!ok, detail: String(d).slice(0, 320) }));
const sendInfo = p => p.evaluate(() => { const bt = [...document.querySelectorAll('button')].find(x => /^(Enviar|Send)/.test(x.innerText.trim())); if (!bt) return null; const r = bt.getBoundingClientRect(); const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { vis: r.bottom <= innerHeight + 1 && r.top >= 0, w: Math.round(r.width), h: Math.round(r.height), top_is_button: top === bt || bt.contains(top) }; });
const counterText = p => p.evaluate(() => { const e = document.querySelector('.chat-counter'); return e ? { text: e.innerText.trim(), live: e.getAttribute('aria-live'), role: e.getAttribute('role') } : null; });
const setText = async (p, n) => { await p.evaluate(len => { const ta = document.querySelector('textarea'); const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; set.call(ta, 'a'.repeat(len)); ta.dispatchEvent(new Event('input', { bubbles: true })); }, n); await p.waitForTimeout(250); };
(async () => {
  const email = `qa108-${stamp}@example.test`, password = 'Qa108-' + stamp + 'aA!';
  await fetch(API + '/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'QA108', email, password }) });
  const b = await chromium.launch(); const rep = {};
  for (const [w, h] of [[1440, 900], [768, 1024], [390, 844], [364, 740], [360, 740], [320, 568]]) {
    for (const lang of ['es', 'en']) {
      const ctx = await b.newContext({ viewport: { width: w, height: h } }); const p = await ctx.newPage(); const tag = `${w}x${h}-${lang}`; const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 120)));
      await p.goto(API + '/login', { waitUntil: 'networkidle' }); await p.fill('input[type=email]', email); await p.fill('input[type=password]', password); await p.keyboard.press('Enter'); await p.waitForTimeout(2500);
      await p.goto(API + '/app/chat', { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
      if (lang === 'en') { await p.getByRole('button', { name: 'EN', exact: true }).first().click().catch(() => {}); await p.waitForTimeout(800); }
      await p.screenshot({ path: path.join(OUT, `chat-${tag}.png`) });
      const body = await p.innerText('body'); const sw = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      await p.fill('textarea', 'hola').catch(() => {}); const send = await sendInfo(p);
      const label = await p.evaluate(() => document.querySelector('textarea')?.closest('label')?.innerText.trim().split('\n')[0] ?? null);
      check(`C1 /app/chat ${tag}: sin scroll horizontal`, !sw, JSON.stringify({ sw }));
      check(`C2 /app/chat ${tag}: «Enviar» visible, clicable (no tapado) y ≥44 px de alto`, send && send.vis && send.top_is_button && send.h >= 44, JSON.stringify(send));
      check(`C3 /app/chat ${tag}: etiqueta «${lang === 'es' ? 'Mensaje' : 'Message'}» sin cifra y sin 4.000/2.000 visibles`, label === (lang === 'es' ? 'Mensaje' : 'Message') && !/[24][.,]000/.test(body), JSON.stringify({ label, hit: body.match(/.{0,30}[24][.,]000.{0,30}/)?.[0] }));
      if (lang === 'en') check(`C4 /app/chat ${tag}: EN sin texto de interfaz en español`, !/(Enviar|Conversación|Diario|Mensaje|Guardar|Pausar|Cerrar)/.test(body), body.slice(0, 160).replace(/\n/g, ' | '));
      // C5 contador (solo en un tamaño por idioma para no alargar): 3.599 / 3.600 / 4.000
      if (w === 390 || w === 1440) {
        await setText(p, 3599); const c0 = await counterText(p); await setText(p, 3600); const c1 = await counterText(p); await setText(p, 4000); const c2 = await counterText(p); await setText(p, 4500); const len = await p.evaluate(() => document.querySelector('textarea').value.length);
        const want1 = lang === 'es' ? '3.600 / 4.000 caracteres' : '3,600 / 4,000 characters', want2 = lang === 'es' ? 'Has llegado al máximo de 4.000 caracteres.' : 'You have reached the 4,000-character maximum.';
        check(`C5 /app/chat ${tag}: contador vacío a 3.599; «${want1}» a 3.600; máximo a 4.000; aria-live polite`, c0?.text === '' && c1?.text === want1 && c2?.text === want2 && c1?.live === 'polite', JSON.stringify({ c0, c1, c2 }));
        await setText(p, 4000); const lenAfter = await p.evaluate(() => document.querySelector('textarea').value.length); check(`C5b /app/chat ${tag}: el textarea no admite más de 4.000`, lenAfter === 4000, lenAfter);
        await p.fill('textarea', 'hola');
      }
      // C6 panel del diario: la cifra de 2.000 solo con el panel de ayuda abierto
      const tg = p.locator('.chat-diary-toggle'); if (await tg.count()) {
        await tg.click(); await p.waitForTimeout(1200); const closed = await p.innerText('body'); const hasClosed = /2[.,]000/.test(closed);
        await p.locator('.chat-diary-help summary').click().catch(() => {}); await p.waitForTimeout(300); const opened = await p.innerText('body'); const hasOpen = /2[.,]000/.test(opened);
        await p.screenshot({ path: path.join(OUT, `chat-diario-${tag}.png`) });
        check(`C6 /app/chat ${tag}: 2.000 NO visible con el panel del diario abierto pero la ayuda plegada, SÍ con la ayuda desplegada`, !hasClosed && hasOpen, JSON.stringify({ hasClosed, hasOpen, ctx: opened.match(/.{0,60}[24][.,]000.{0,40}/)?.[0] }));
      } else check(`C6 /app/chat ${tag}: existe el selector del diario`, false, 'sin .chat-diary-toggle');
      // R1 regresión: enviar y recibir respuesta simulada
      await p.fill('textarea', 'QA smoke test'); const resp = p.waitForResponse(r => r.url().includes('/api/chat') && r.request().method() === 'POST', { timeout: 15000 }).catch(() => null);
      await p.locator('button', { hasText: /^(Enviar|Send)/ }).first().click(); const rr = await resp; await p.waitForTimeout(1200);
      check(`R1 /app/chat ${tag}: enviar un mensaje responde 200 y la respuesta se muestra`, rr && rr.status() === 200 && (await p.innerText('body')).includes('QA smoke test'), `http=${rr && rr.status()}`);
      // /app/dashboard
      await p.goto(API + '/app/dashboard', { waitUntil: 'networkidle' }); await p.waitForTimeout(1800);
      if (lang === 'en') { await p.getByRole('button', { name: 'EN', exact: true }).first().click().catch(() => {}); await p.waitForTimeout(800); }
      await p.screenshot({ path: path.join(OUT, `dashboard-inicial-${tag}.png`), fullPage: true });
      const mood = p.locator('button', { hasText: /😊|🙂/ }).first(); if (await mood.count()) { await mood.click().catch(() => {}); await p.waitForTimeout(1500); }
      await p.screenshot({ path: path.join(OUT, `dashboard-${tag}.png`), fullPage: true });
      const dbody = await p.innerText('body'); const dsw = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      const d = await p.evaluate(() => { const a = [...document.querySelectorAll('a')].filter(x => /route-catalog|app\/compass/.test(x.getAttribute('href') || '')).map(x => { const r = x.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, href: x.getAttribute('href') }; }); let gap = null, ov = null; if (a.length === 2) { const [x, y] = a; ov = !(x.r <= y.l || y.r <= x.l || x.b <= y.t || y.b <= x.t); gap = Math.round(Math.max(y.l - x.r, x.l - y.r, y.t - x.b, x.t - y.b)); } return { n: a.length, ov, gap, textareas: document.querySelectorAll('textarea').length }; });
      check(`D1 /app/dashboard ${tag}: sin scroll horizontal`, !dsw, JSON.stringify({ dsw }));
      check(`D2 /app/dashboard ${tag}: «Catálogo de rutas» y «Brújula profesional» separados (sin solape, hueco > 0)`, d.n === 2 && d.ov === false && d.gap > 0, JSON.stringify(d));
      check(`D3 /app/dashboard ${tag}: sin 4.000/2.000 visibles`, !/[24][.,]000/.test(dbody), dbody.match(/.{0,30}[24][.,]000.{0,30}/)?.[0] ?? '');
      const goText = lang === 'es' ? 'Ir a mi conversación' : 'Go to my conversation'; const btn = p.getByText(goText, { exact: true }).first();
      check(`D5a /app/dashboard ${tag}: sin chat embebido (0 textarea) y con «${goText}»`, d.textareas === 0 && (await btn.count()) > 0, JSON.stringify({ textareas: d.textareas }));
      if (await btn.count()) { await btn.click(); await p.waitForTimeout(1500); check(`D5b /app/dashboard ${tag}: «${goText}» lleva a /app/chat`, new URL(p.url()).pathname === '/app/chat', p.url()); }
      check(`E1 ${tag}: sin errores de página (pageerror)`, errs.length === 0, errs.join(' | '));
      await ctx.close();
    }
  }
  await b.close();
})().catch(e => { console.log(JSON.stringify({ id: 'ERROR del script', ok: false, detail: String(e).slice(0, 300) })); process.exit(1); });
