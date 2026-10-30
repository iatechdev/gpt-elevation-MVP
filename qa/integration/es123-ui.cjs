// [QA-Claude] ES-123 · PR #108: revisión visual/funcional del chat (/app/chat y chat embebido de /app/dashboard) con backend local, Postgres real y proveedor SIMULADO.
// Uso: QA_API=http://127.0.0.1:9941 OUT=<carpeta> node qa/integration/es123-ui.cjs
const fs = require('fs'); const path = require('path'); const { chromium } = require('C:/Users/Usuario/tools/playwright/node_modules/playwright');
const API = process.env.QA_API; const OUT = process.env.OUT; fs.mkdirSync(OUT, { recursive: true }); const stamp = Date.now();
const check = (id, ok, d = '') => console.log(JSON.stringify({ id, ok: !!ok, detail: String(d).slice(0, 320) }));
const rect = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), b: Math.round(r.bottom) }; }, sel);
const overlap = (p, selA, selB) => p.evaluate(([a, b]) => { const A = document.querySelector(a)?.getBoundingClientRect(), B = document.querySelector(b)?.getBoundingClientRect(); if (!A || !B) return null; return !(A.right <= B.left || B.right <= A.left || A.bottom <= B.top || B.bottom <= A.top); }, [selA, selB]);
(async () => {
  const email = `qa108-${stamp}@example.test`, password = 'Qa108-' + stamp + 'aA!';
  await fetch(API + '/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'QA108', email, password }) });
  const b = await chromium.launch(); const rep = {};
  for (const [w, h] of [[1440, 900], [768, 1024], [390, 844], [364, 740], [360, 740], [320, 568]]) {
    for (const lang of ['es', 'en']) {
      const ctx = await b.newContext({ viewport: { width: w, height: h } }); const p = await ctx.newPage(); const tag = `${w}x${h}-${lang}`;
      await p.goto(API + '/login', { waitUntil: 'networkidle' }); await p.fill('input[type=email]', email); await p.fill('input[type=password]', password); await p.keyboard.press('Enter'); await p.waitForTimeout(2500);
      if (lang === 'en') { await p.goto(API + '/app/chat', { waitUntil: 'networkidle' }); await p.getByRole('button', { name: 'EN', exact: true }).first().click().catch(() => {}); await p.waitForTimeout(800); }
      // /app/chat
      await p.goto(API + '/app/chat', { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
      if (lang === 'en') { await p.getByRole('button', { name: 'EN', exact: true }).first().click().catch(() => {}); await p.waitForTimeout(800); }
      await p.screenshot({ path: path.join(OUT, `chat-${tag}.png`) });
      const body = await p.innerText('body'); const sw = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      await p.fill('textarea', 'hola').catch(() => {}); const ta = await rect(p, 'textarea'); const send = await p.evaluate(() => { const bt = [...document.querySelectorAll('button')].find(x => /^(Enviar|Send)/.test(x.innerText.trim())); if (!bt) return null; const r = bt.getBoundingClientRect(); const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { vis: r.bottom <= innerHeight + 1 && r.top >= 0, w: Math.round(r.width), h: Math.round(r.height), top_is_button: top === bt || bt.contains(top) }; });
      const hasLimit4000 = /4[.,]000/.test(body), has2000 = /2[.,]000/.test(body);
      rep[`chat ${tag}`] = { textarea: ta, send, scrollH: sw, limit4000_visible: hasLimit4000, limit2000_visible: has2000 };
      check(`C1 /app/chat ${tag}: sin scroll horizontal`, !sw, JSON.stringify({ sw }));
      check(`C2 /app/chat ${tag}: «Enviar» visible, clicable (no tapado) y ≥44 px de alto`, send && send.vis && send.top_is_button && send.h >= 44, JSON.stringify(send));
      check(`C3 /app/chat ${tag}: sin límites técnicos 4.000/2.000 como texto visible fijo`, !hasLimit4000 && !has2000, JSON.stringify({ hasLimit4000, has2000 }));
      if (lang === 'en') check(`C4 /app/chat ${tag}: EN sin texto de interfaz en español`, !/(Enviar|Conversación|Diario|Mensaje|Guardar|Pausar|Cerrar)/.test(body), body.slice(0, 160).replace(/\n/g, ' | '));
      // /app/dashboard (chat embebido)
      await p.goto(API + '/app/dashboard', { waitUntil: 'networkidle' }); await p.waitForTimeout(1800);
      const mood = p.locator('button', { hasText: /😊|🙂/ }).first(); if (await mood.count()) { await mood.click().catch(() => {}); await p.waitForTimeout(1500); }
      await p.screenshot({ path: path.join(OUT, `dashboard-${tag}.png`), fullPage: true });
      await p.locator('textarea').first().fill('hola').catch(() => {}); await p.evaluate(() => { const bt = [...document.querySelectorAll('button')].find(x => /^(Enviar|Send)/.test(x.innerText.trim())); bt && bt.scrollIntoView({ block: 'end' }); }); await p.waitForTimeout(500); await p.screenshot({ path: path.join(OUT, `dashboard-vp-${tag}.png`) });
      const covered = await p.evaluate(() => { const bt = [...document.querySelectorAll('button')].find(x => /^(Enviar|Send)/.test(x.innerText.trim())); if (!bt) return null; const r = bt.getBoundingClientRect(); const t = document.elementFromPoint(r.x + r.width / 2, Math.min(r.y + r.height / 2, innerHeight - 2)); return { covered: !(t === bt || bt.contains(t)), by: t ? (t.tagName + ':' + String(t.className).slice(0, 30) + ':' + (t.innerText || '').slice(0, 30)) : null }; });
      check(`D4 /app/dashboard ${tag}: con la página desplazada hasta «Enviar», nada lo tapa`, covered && covered.covered === false, JSON.stringify(covered));
      const dsw = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1); const dbody = await p.innerText('body');
      const links = await p.evaluate(() => { const a = [...document.querySelectorAll('a')].filter(x => /route-catalog|app\/compass/.test(x.getAttribute('href') || '')).map(x => x.getBoundingClientRect()); const bt = [...document.querySelectorAll('button')].find(x => /^(Enviar|Send)/.test(x.innerText.trim())); const br = bt?.getBoundingClientRect(); return { n: a.length, overlapSend: br ? a.some(r => !(r.right <= br.left || br.right <= r.left || r.bottom <= br.top || br.bottom <= r.top)) : null, hasSend: !!bt }; });
      rep[`dashboard ${tag}`] = { scrollH: dsw, links };
      check(`D1 /app/dashboard ${tag}: sin scroll horizontal`, !dsw, JSON.stringify({ dsw }));
      check(`D2 /app/dashboard ${tag}: «Enviar» NO se superpone con «Catálogo de rutas» / «Brújula profesional»`, links.hasSend ? links.overlapSend === false : true, JSON.stringify(links));
      check(`D3 /app/dashboard ${tag}: sin límites 4.000/2.000 visibles`, !/4[.,]000|2[.,]000/.test(dbody) , dbody.match(/.{0,30}[24][.,]000.{0,30}/)?.[0] ?? '');
      await ctx.close();
    }
  }
  fs.writeFileSync(path.join(OUT, 'medidas.json'), JSON.stringify(rep, null, 2)); await b.close();
})().catch(e => { console.log(JSON.stringify({ id: 'ERROR del script', ok: false, detail: String(e).slice(0, 300) })); process.exit(1); });
