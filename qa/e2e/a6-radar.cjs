// [QA-Claude] ES-40 fase A6 (0 tokens de IA): Radar del Skill Map — zoom, paneo, teclado, reinicio y tamaños (cobertura pendiente del informe de Alejo, ES-131). Persona sintética nueva.
const L = require('./lib.cjs'); const { chromium, API, SHOTS, rec, savResults, fs, path } = L; const dir = path.join(SHOTS, 'a6-radar'); fs.mkdirSync(dir, { recursive: true });
(async () => {
  const b = await chromium.launch(); const P = await L.newPersona('radar'); const s = await L.login(P);
  for (const lang of ['es', 'en']) for (const [w, h] of [[1920, 1080], [1440, 900], [1024, 768], [768, 1024], [390, 844], [360, 740], [320, 568]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: w < 800 }); await L.injectSession(ctx, s, lang); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 80)));
    await p.goto(API + '/app/skill-map', { waitUntil: 'networkidle' }); await p.waitForTimeout(1500); const tag = `${lang}-${w}`;
    const svg = p.locator('svg').filter({ has: p.locator('polygon, path, circle') }).first(); const has = await svg.count(); const box = has ? await svg.boundingBox() : null;
    const sw = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    rec(`A6 ${tag}: el Radar se muestra completo dentro de la pantalla y sin desborde horizontal`, !!box && box.x >= -1 && box.x + box.width <= w + 1 && !sw, JSON.stringify({ box: box && { x: Math.round(box.x), w: Math.round(box.width) }, sw }));
    if (box) { const before = await p.evaluate(() => { const s = document.querySelector('svg'); return s ? (s.getAttribute('viewBox') || '') + '|' + (s.querySelector('g')?.getAttribute('transform') || '') : ''; });
      await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.mouse.wheel(0, -400); await p.waitForTimeout(300); await p.keyboard.down('Control'); await p.mouse.wheel(0, -400); await p.keyboard.up('Control'); await p.waitForTimeout(300);
      await p.mouse.down(); await p.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 + 40, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(300);
      const after = await p.evaluate(() => { const s = document.querySelector('svg'); return s ? (s.getAttribute('viewBox') || '') + '|' + (s.querySelector('g')?.getAttribute('transform') || '') : ''; }); const sw2 = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      rec(`A6 ${tag}: rueda, Ctrl+rueda y arrastre sobre el Radar no rompen la página (sin errores ni desborde)`, errs.length === 0 && !sw2, `errores=${errs.length} desborde=${sw2}`);
      console.log(JSON.stringify({ id: `info A6 ${tag}: ¿el Radar tiene zoom/paneo? (cambia el SVG con rueda y arrastre)`, cambia: before !== after, before: before.slice(0, 40), after: after.slice(0, 40) }));
      const ctl = await p.getByRole('button', { name: /zoom|acercar|alejar|reiniciar|reset|\+|−/i }).count(); console.log(JSON.stringify({ id: `info A6 ${tag}: controles de zoom/reinicio visibles`, n: ctl })); }
    await p.keyboard.press('Tab'); await p.keyboard.press('Tab'); const foc = await p.evaluate(() => document.activeElement?.tagName + ':' + (document.activeElement?.getAttribute('aria-label') || document.activeElement?.innerText || '').slice(0, 30)); console.log(JSON.stringify({ id: `info A6 ${tag}: foco tras Tab Tab`, foc }));
    await p.screenshot({ path: path.join(dir, `radar-${tag}.png`), fullPage: true }).catch(() => {}); await ctx.close();
  }
  console.log('RESUMEN-A6 ' + JSON.stringify({ total: L.results.length, fallos: L.results.filter(r => !r.ok).length })); savResults('a6-radar'); await b.close();
})().catch(e => { console.log('ERROR ' + String(e).slice(0, 300)); process.exit(1); });
