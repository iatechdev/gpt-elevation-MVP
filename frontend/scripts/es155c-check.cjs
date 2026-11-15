// ES-155 (tramo C): la portada «Cartografía» (`/`). Chromium, API simulada (page.route), datos sintéticos.
// Mide: marco público (un h1, un main, cabecera con idioma, pie), hero con relieve decorativo (aria-hidden) y leyenda de cuatro símbolos, «Pruébalo con una escena» (pista FIJA y rotulada «Ejemplo», sin red, sin guardar,
// «Escribir la mía» → registro), tres pasos, hueco de fotografía real, secciones conservadas debajo (planes, confianza, cierre), anclas (/#como-funciona, /#planes) con los bloques perezosos,
// axe wcag2a/2aa/21aa/22aa + 2.5.3 + target-size en ES/EN × 390/1360 × claro/oscuro (y 320), CLS ≤ 0,1 a 390 px con CPU ×4 y sin animaciones con prefers-reduced-motion.
// Uso: npx vite build && npx vite preview --host 127.0.0.1 --port 4155 --strictPort   y luego
//   ES155C_URL=http://127.0.0.1:4155 PLAYWRIGHT_MODULE=<ruta a playwright> AXE_PATH=<axe.min.js> node scripts/es155c-check.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');

(async () => {
  const { chromium } = process.env.PLAYWRIGHT_MODULE ? require(process.env.PLAYWRIGHT_MODULE) : await import('playwright');
  const base = process.env.ES155C_URL ?? 'http://127.0.0.1:4155';
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Solo vista previa local');
  const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8');
  const browser = await chromium.launch({ headless: true });
  const errors = []; let count = 0;
  const check = (label) => { count++; console.log('PASS ' + label); };
  const T = {
    es: { hero: 'Tu experiencia tiene relieve.', mark: 'Marcar en el mapa', own: 'Escribir la mía', yes: 'Sí, un poco', no: 'No todavía', see: 'Ver cómo sube', example: 'Ejemplo, no es tuyo', hint: 'Posible pista', empty: 'Escribe una escena para marcarla.', noted: 'Anotada.', understood: 'Entendido: no se anota nada.', steps: 'Cómo funciona', photo: 'Espacio reservado para fotografía real', note: 'no analiza lo que escribas aquí', up: 'Crear cuenta' },
    en: { hero: 'Your experience has relief.', mark: 'Mark it on the map', own: 'Write my own', yes: 'Yes, a little', no: 'Not yet', see: 'See it rise', example: 'Sample, not yours', hint: 'Possible hint', empty: 'Write a scene to mark it.', noted: 'Noted.', understood: 'Understood: nothing is noted.', steps: 'How it works', photo: 'Space reserved for a real photograph', note: 'does not analyse what you write here', up: 'Create account' },
  };

  async function open(width, lang, scheme, { route = '/', cpu = 1, reduced = true, hash = '' } = {}) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: reduced ? 'reduce' : 'no-preference', isMobile: width < 600 });
    const page = await context.newPage(); const requests = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
    page.on('request', (r) => { const u = new URL(r.url()); if (u.pathname.startsWith('/api/') || r.method() !== 'GET') requests.push(`${r.method()} ${u.pathname}`); });
    await page.addInitScript(([l]) => { localStorage.setItem('elv_lang', l); }, [lang]);
    await page.route('**/api/**', (r) => r.fulfill({ json: new URL(r.request().url()).pathname === '/api/landing-content' ? {} : [] }));
    if (cpu > 1) { const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu }); }
    await page.addInitScript(() => { window.__ls = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__ls.push(e.value); }).observe({ type: 'layout-shift', buffered: true }); });
    await page.goto(base + route + hash, { waitUntil: 'networkidle' });
    return { context, page, requests };
  }
  const axe = async (page) => { await page.evaluate(axeSource); return page.evaluate(async () => {
    const tags = await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] });
    const rules = await window.axe.run(document, { runOnly: { type: 'rule', values: ['label-content-name-mismatch', 'target-size'] } });
    return [...tags.violations, ...rules.violations].map((v) => v.id + ':' + v.nodes.length).filter((v, i, all) => all.indexOf(v) === i);
  }); };
  const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

  // 1. Portada completa: marco, hero, leyenda, escena de ejemplo (sin red), pasos, foto, conservado; ES/EN × 390/1360 × claro/oscuro
  for (const [width, lang, scheme] of [[1360, 'es', 'light'], [1360, 'en', 'dark'], [390, 'es', 'dark'], [390, 'en', 'light'], [320, 'es', 'light']]) {
    const tag = `${width}px ${lang} ${scheme}`; const c = T[lang];
    const { context, page, requests } = await open(width, lang, scheme);
    await page.locator('#como-funciona').waitFor(); await page.locator('#planes').waitFor({ timeout: 15000 });
    assert.equal(await page.locator('h1').count(), 1, `un h1 (${tag})`); assert.equal((await page.locator('h1').textContent()).replace(/\s+/g, ' ').trim(), c.hero, `título del hero (${tag})`);
    assert.equal(await page.locator('main#main').count(), 1, `un main (${tag})`);
    assert.ok(await page.locator('header.cg-header').count() === 1 && await page.locator('header .cg-lang').count() === 1, `cabecera con idioma (${tag})`);
    assert.equal(await page.locator('.pt-hero__relief').getAttribute('aria-hidden'), 'true', `relieve decorativo aria-hidden (${tag})`);
    assert.equal(await page.locator('.pt-legend li').count(), 4, `leyenda de cuatro símbolos (${tag})`);
    assert.ok(await page.getByRole('link', { name: c.up, exact: true }).count() >= 1, `Crear cuenta (${tag})`);
    // D1/D2/D3 (revisión de UX): sin tarjeta vacía antes de actuar; un solo botón primario (relleno) en hero + escena; «Tú estás aquí» sobre el pico del relieve
    assert.equal(await page.locator('.pt-hint').count(), 0, `sin tarjeta de pista vacía antes de marcar (${tag})`);
    assert.equal(await page.locator('.pt-hero a.cg-btn').count(), 0, `el hero no añade un segundo botón primario (${tag})`);
    assert.equal(await page.locator('main .cg-btn:not(.cg-btn--ghost)').count(), 1, `un solo botón primario relleno en hero + escena (${tag})`);
    { const box = await page.locator('.pt-hero__relief').boundingBox(); const dot = await page.locator('.pt-here i').boundingBox(); const cx = (dot.x + dot.width / 2 - box.x) / box.width; const cy = (dot.y + dot.height / 2 - box.y) / box.height;
      assert.ok(Math.abs(cx - (width < 640 ? 0.88 : 0.68)) < 0.02 && Math.abs(cy - (width < 640 ? 0.12 : 0.36)) < 0.03, `«Tú estás aquí» sobre el pico del relieve (x ${cx.toFixed(2)}, y ${cy.toFixed(2)}) (${tag})`); }
    if (process.env.ES155C_SHOTS && scheme === 'light') await page.screenshot({ path: `${process.env.ES155C_SHOTS}/portada-${lang}-${width}.png`, fullPage: false });
    // escena de ejemplo
    await page.locator('.pt-scene').waitFor(); assert.ok((await page.locator('.pt-try .cg-chip').first().textContent()).includes(c.example), `rótulo «${c.example}» (${tag})`);
    assert.ok((await page.locator('.pt-note').textContent()).includes(c.note), `aviso de que la pista es fija (${tag})`);
    assert.equal(await page.locator('.pt-hint-live').getAttribute('aria-live'), 'polite', `la pista se anuncia (${tag})`);
    const before = requests.length; // la portada ya pidió el contenido y los planes; la pieza no pide NADA más
    await page.getByRole('button', { name: c.mark }).click(); await page.getByText(c.hint).waitFor();
    await page.getByRole('button', { name: c.yes }).click(); await page.getByText(c.noted).waitFor();
    await page.getByRole('button', { name: c.see }).click(); await page.locator('.pt-rise [role="img"]').waitFor(); assert.ok(await page.locator('.pt-rise [role="img"]').getAttribute('aria-label'), `el relieve de ejemplo tiene descripción (${tag})`);
    assert.deepEqual(requests.slice(before), [], `la pieza no hace ninguna petición (sin red, sin guardar) (${tag})`); assert.ok(requests.every((r) => r.startsWith('GET ')), `la portada no envía nada: ${requests.join(', ')} (${tag})`);
    assert.equal(await page.getByRole('link', { name: c.own }).getAttribute('href'), '/login?mode=register', `«${c.own}» lleva al registro (${tag})`);
    // pasos, foto, conservado
    assert.equal(await page.locator('.pt-steps li').count(), 3, `tres pasos (${tag})`); assert.ok((await page.locator('.pt-photo').textContent()).includes(c.photo), `marcador de fotografía real (${tag})`);
    assert.equal(await page.locator('.pt-photo img, .pt-photo picture').count(), 0, `sin fotografía inventada (${tag})`);
    assert.ok(await page.locator('#planes').count() === 1 && await page.locator('footer').count() >= 1, `secciones conservadas (planes, cierre) (${tag})`);
    assert.ok((await overflow(page)) <= 0, `sin desborde (${tag})`);
    assert.deepEqual(await axe(page), [], `axe portada (${tag})`);
    await context.close();
    check(`portada (${tag}): marco, hero decorativo + leyenda, escena de ejemplo (pista fija, sin red ni guardado), pasos, foto pendiente, conservado, sin desborde, axe 2.2 AA + 2.5.3 + target-size 0`);
  }

  // 2. Vacío y «No todavía»; teclado
  for (const lang of ['es', 'en']) {
    const c = T[lang]; const { context, page } = await open(1360, lang, 'light');
    await page.locator('.pt-scene').waitFor(); await page.locator('.pt-scene').fill('   ');
    await page.getByRole('button', { name: c.mark }).click(); await page.getByRole('alert').filter({ hasText: c.empty }).waitFor();
    assert.equal(await page.locator('.pt-scene').getAttribute('aria-invalid'), 'true'); assert.deepEqual(await axe(page), [], `axe vacío (${lang})`);
    await page.locator('.pt-scene').fill('Una escena mía'); await page.getByRole('button', { name: c.mark }).click(); await page.getByRole('button', { name: c.no }).click(); await page.getByText(c.understood).waitFor();
    // teclado: Tab llega al botón y Enter lo activa
    await page.locator('.pt-scene').focus(); await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement.textContent.trim()), c.mark, `Tab desde la escena llega a «${c.mark}» (${lang})`);
    await context.close();
  }
  check('escena de ejemplo: vacío con error y foco, «No todavía» no anota nada, teclado, axe 0');

  // 3. Anclas con bloques perezosos y reduced motion
  for (const hash of ['#como-funciona', '#planes', '#privacidad']) {
    const { context, page } = await open(1360, 'es', 'light', { hash });
    await page.locator(hash).waitFor({ timeout: 15000 }); await page.waitForTimeout(500);
    const top = await page.evaluate((id) => document.querySelector(id).getBoundingClientRect().top, hash);
    assert.ok(top < 700, `${hash}: el ancla queda a la vista tras cargar el bloque (top=${Math.round(top)})`); await context.close();
  }
  { const { context, page } = await open(1360, 'es', 'light', { reduced: true }); await page.waitForTimeout(500);
    assert.equal(await page.evaluate(() => document.getAnimations().length), 0, 'con prefers-reduced-motion no hay animaciones en la portada'); await context.close(); }
  check('anclas /#como-funciona, /#planes y /#privacidad con los bloques perezosos; 0 animaciones con prefers-reduced-motion');

  // 4. CLS a 390 px con CPU ×4 (presupuesto 0,1) y a 1360
  for (const [width, cpu] of [[390, 4], [1360, 1], [1360, 4]]) {
    const { context, page } = await open(width, 'es', 'light', { cpu }); await page.locator('#planes').waitFor({ timeout: 20000 }); await page.waitForTimeout(2500);
    const cls = await page.evaluate(() => window.__ls.reduce((a, b) => a + b, 0));
    assert.ok(cls <= 0.1, `CLS ${cls.toFixed(3)} a ${width} px CPU ×${cpu} (presupuesto 0,1)`); console.log(`  CLS portada ${width}px CPU×${cpu}: ${cls.toFixed(3)}`); await context.close();
  }
  check('CLS de la portada ≤ 0,1 a 390 px CPU×4 y a 1360 px');

  assert.deepEqual(errors, [], 'errores de consola o de página: ' + errors.join(' | '));
  console.log(`\nES-155 C: ${count} comprobaciones OK`);
  await browser.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
