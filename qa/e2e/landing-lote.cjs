// [QA-Claude] Lote landing (ES-65/#68, ES-69/#82, ES-71/#85) · navegador sobre builds locales servidos de forma estática (sin API; contenido de respaldo del repositorio).
// Uso: node qa/e2e/landing-lote.cjs <carpeta-dist> <etiqueta>   · salidas en QA_OUT (fuera del repo) y resumen JSON por consola.
const http = require('http'); const fs = require('fs'); const path = require('path');
const { chromium } = require('C:/Users/Usuario/tools/playwright/node_modules/playwright');
const dist = process.argv[2], label = process.argv[3]; const OUT = path.join(process.env.QA_OUT || 'C:/Users/Usuario/Documents/qa-e2e-evidencia/lote-landing', label); fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.json': 'application/json' };
const srv = http.createServer((q, s) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.startsWith('/api/')) { s.statusCode = 503; return s.end('{}'); } let f = path.join(dist, p); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(dist, 'index.html'); s.setHeader('content-type', MIME[path.extname(f)] || 'application/octet-stream'); fs.createReadStream(f).pipe(s); });
(async () => {
  await new Promise(r => srv.listen(0, '127.0.0.1', r)); const base = 'http://127.0.0.1:' + srv.address().port; const b = await chromium.launch(); const res = { label, langs: {} };
  for (const lang of ['es', 'en']) {
    const r = res.langs[lang] = { widths: {} };
    for (const w of [320, 375, 768, 1024, 1440]) {
      const ctx = await b.newContext({ viewport: { width: w, height: 900 } }); await ctx.addInitScript(l => { try { localStorage.setItem('elv_lang', l); } catch { /* */ } window.__cls = 0; new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); }, lang);
      const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 120))); p.on('console', m => { if (m.type() === 'error' && !/503|Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 120)); });
      await p.goto(base + '/', { waitUntil: 'networkidle' }); await p.waitForTimeout(800);
      const info = await p.evaluate(() => ({ overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, h2: [...document.querySelectorAll('h2')].map(h => h.textContent.trim().slice(0, 70)), mains: document.querySelectorAll('main').length, footers: document.querySelectorAll('footer').length, footerInMain: !!document.querySelector('main footer'), links: [...document.querySelectorAll('a')].map(a => a.getAttribute('href')), btnsNoName: [...document.querySelectorAll('button,a')].filter(e => !(e.textContent.trim() || e.getAttribute('aria-label'))).length, cls: window.__cls, lang: document.documentElement.lang, text: document.body.innerText }));
      r.widths[w] = { overflow: info.overflow, errs, cls: Number(info.cls.toFixed(4)), btnsNoName: info.btnsNoName };
      if (w === 1440) { Object.assign(r, { h2: info.h2, mains: info.mains, footers: info.footers, footerInMain: info.footerInMain, links: [...new Set(info.links)], htmlLang: info.lang }); fs.writeFileSync(path.join(OUT, `texto-${lang}.txt`), info.text); await p.screenshot({ path: path.join(OUT, `${lang}-1440.png`), fullPage: true }); }
      if (w === 375) await p.screenshot({ path: path.join(OUT, `${lang}-375.png`), fullPage: true });
      if (w === 1440) { // teclado: recorrer con Tab y comprobar contorno de foco visible
        const foco = []; for (let i = 0; i < 40; i++) { await p.keyboard.press('Tab'); const f = await p.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return null; const cs = getComputedStyle(e); return { tag: e.tagName, name: (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 30), outline: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0, shadow: cs.boxShadow !== 'none' }; }); if (f) foco.push(f); }
        r.tabStops = foco.length; r.tabSinIndicador = foco.filter(f => !f.outline && !f.shadow).map(f => f.tag + ':' + f.name);
      }
      await ctx.close();
    }
  }
  await b.close(); srv.close(); fs.writeFileSync(path.join(OUT, 'resumen.json'), JSON.stringify(res, null, 1)); console.log(JSON.stringify(res));
})().catch(e => { console.log('ERROR ' + String(e.stack).slice(0, 500)); process.exit(1); });
