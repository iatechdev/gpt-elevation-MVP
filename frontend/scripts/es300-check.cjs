// ES-300: radar a la forma del prototipo (ejes como botones, anillos 1–4, tabla alternativa, N dinámico) + E258-2 (relieve sin solapes), E258-3 (Lista con «Nivel n de 4») y la regla única de nivel.
// Chromium, API simulada (page.route), datos sintéticos. axe con wcag2a, wcag2aa, wcag21aa y wcag22aa (incluye target-size 2.5.8) en Relieve, Lista y Radar, ES/EN × 390/1360 × claro/oscuro.
// Uso: npx vite build && npx vite preview --host 127.0.0.1 --port 4300 --strictPort   y luego
//   ES300_URL=http://127.0.0.1:4300 PLAYWRIGHT_MODULE=<ruta a playwright> AXE_PATH=<axe.min.js> node scripts/es300-check.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');

(async () => {
  const { chromium } = process.env.PLAYWRIGHT_MODULE ? require(process.env.PLAYWRIGHT_MODULE) : await import('playwright');
  const base = process.env.ES300_URL ?? 'http://127.0.0.1:4300';
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Solo vista previa local');
  const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8');
  const browser = await chromium.launch({ headless: true });
  const errors = []; let count = 0;
  const check = (label) => { count++; console.log('PASS ' + label); };
  const T = {
    es: { relief: 'Relieve', list: 'Lista', radar: 'Radar', table: 'Ver los niveles como tabla', noLevel: 'Sin nivel', level: (n) => `Nivel ${n} de 4`, noEvidence: 'Sin evidencia vigente' },
    en: { relief: 'Relief', list: 'List', radar: 'Radar', table: 'See the levels as a table', noLevel: 'No level', level: (n) => `Level ${n} of 4`, noEvidence: 'No current evidence' },
  };
  const track = (level, review = false) => (level ? { level, state: 'initial', stale: false, catalogOutdated: false, confidence: 'medium', confidenceReason: { es: 'Respaldo sintético', en: 'Synthetic support' }, evidenceCount: 2, authoring: 'person', rationale: null, needsReview: false } : null);
  // N capacidades con niveles variados; la #0 tiene autoevaluación 3 y revisión humana 2 (regla única: el nivel mostrado es la autoevaluación); cada 7.ª sin territorio
  const mk = (n, { empty = false, all = false } = {}) => Array.from({ length: n }, (_, i) => {
    const level = empty ? null : all ? ((i % 4) + 1) : (i % 3 === 2 ? null : ((i % 4) + 1));
    return { skillKey: 'sint_' + i, type: i < 6 ? 'transversal' : 'domain', labels: { es: `Capacidad sintética número ${i + 1}`, en: `Synthetic skill number ${i + 1}` }, territories: i % 7 === 6 ? [] : [['dir', 'con', 'com', 'ing', 'inn'][i % 5], ...(i % 4 === 3 ? ['con'] : [])],
      rubric: { levels: Object.fromEntries([1, 2, 3, 4].map((k) => [String(k), { es: `Criterio del nivel ${k}`, en: `Level ${k} criterion` }])), source: 'sintético', verifiedAt: '2026-11-01' },
      self: track(i === 0 && !empty ? 3 : level), review: i === 0 && !empty ? track(2, true) : null, state: level ? 'initial' : 'no_evidence' };
  });

  async function open(width, lang, scheme, skills) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
    await page.addInitScript(([l]) => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l); }, [lang]);
    await page.route('**/api/**', (route) => {
      const p = new URL(route.request().url()).pathname;
      if (p === '/api/session') return route.fulfill({ json: { role: 'user', onboardingCompleted: true } });
      if (p === '/api/skill-map') return route.fulfill({ json: { catalogVersion: 1, skills } });
      if (p === '/api/consents') return route.fulfill({ json: { consents: [] } });
      return route.fulfill({ json: [] });
    });
    await page.goto(base + '/app/skill-map', { waitUntil: 'networkidle' });
    return { context, page };
  }
  const axe = async (page) => { await page.evaluate(axeSource); return page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] })).violations.map((v) => v.id + ':' + v.nodes.length)); };
  const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const view = (page, name) => page.locator('.skill-map-views').getByRole('button', { name, exact: true }).click();
  // ¿algún par de botones visibles se solapa? (rectángulo real de cada botón; el nombre oculto de la marca no cuenta)
  const overlapping = (page, selector) => page.evaluate((sel) => {
    const rects = [...document.querySelectorAll(sel)].map((el) => el.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0);
    let bad = 0; for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) { const a = rects[i], b = rects[j]; if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5) bad++; }
    return bad;
  }, selector);

  // 1. Relieve, Lista y Radar con 12 capacidades (el catálogo de QA): axe 2.2 AA = 0, sin solapes, nivel en la Lista, regla única de nivel
  for (const [width, lang, scheme] of [[1360, 'es', 'light'], [1360, 'en', 'dark'], [390, 'es', 'dark'], [390, 'en', 'light']]) {
    const tag = `${width}px ${lang} ${scheme}`; const c = T[lang];
    const { context, page } = await open(width, lang, scheme, mk(12));
    await page.locator('.skill-map-place').first().waitFor();
    assert.equal(await page.locator('.skill-map-place').count(), 12, `un botón por capacidad en el relieve (${tag})`);
    assert.equal(await overlapping(page, '.skill-map-place'), 0, `ningún botón del relieve se solapa (${tag})`);
    assert.deepEqual(await axe(page), [], `axe relieve (${tag})`);
    assert.ok((await overflow(page)) <= 0, `sin desborde (${tag})`);
    assert.equal(await page.locator('.skill-map-place').first().getAttribute('aria-label'), `${lang === 'es' ? 'Capacidad sintética número 1' : 'Synthetic skill number 1'}: ${c.level(3)}`, `relieve: la capacidad 1 (autoevaluación 3, revisión 2) dice Nivel 3 (${tag})`);
    await view(page, c.list); await page.locator('.skill-map-pick').first().waitFor();
    const first = await page.locator('.skill-map-pick').first().innerText();
    assert.ok(first.toLowerCase().includes(c.level(3).toLowerCase()), `lista: «${c.level(3)}» en la capacidad 1 (${tag}): ${first.replace(/\n/g, ' | ')}`);
    const levelled = await page.locator('.skill-map-pick').evaluateAll((els) => new Set(els.filter((el) => /(Nivel|Level) \d (de|of) 4/.test(el.textContent)).map((el) => el.querySelector('.skill-map-pick-name').textContent)).size);
    assert.equal(levelled, 8, `lista: las 8 capacidades con nivel lo dicen y las 4 sin nivel no (${tag})`);
    assert.deepEqual(await axe(page), [], `axe lista (${tag})`);
    await view(page, c.radar); await page.locator('.radar-poly').waitFor();
    assert.equal(await page.locator('.radar-axis').count(), 12, `radar: un eje por capacidad (${tag})`);
    assert.equal(await page.locator('.radar-axis').first().getAttribute('aria-label'), `${lang === 'es' ? 'Capacidad sintética número 1' : 'Synthetic skill number 1'}: ${c.level(3)}`, `radar: MISMO nivel que el relieve y la lista (${tag})`);
    assert.equal(await page.locator('.radar-axis[aria-label$="' + c.noLevel + '"]').count(), 4, `radar: «${c.noLevel}» en las 4 sin nivel (${tag})`);
    assert.equal(await page.locator('.radar-poly svg circle').count(), 8, `radar: un punto por capacidad con nivel y ninguno sin nivel (${tag})`);
    assert.equal(await page.locator('.radar-poly svg .radar-fill').count(), 0, `radar: sin relleno mientras falte alguna (${tag})`);
    assert.equal(await overlapping(page, '.radar-axis'), 0, `radar: ningún eje se solapa (${tag})`);
    assert.ok((await overflow(page)) <= 0, `radar sin desborde (${tag})`);
    assert.deepEqual(await axe(page), [], `axe radar (${tag})`);
    // teclado: Tab llega a los ejes en el orden del catálogo; Enter abre el mismo detalle y marca aria-pressed
    await page.locator('.radar-axis').nth(1).focus(); await page.keyboard.press('Enter');
    assert.equal(await page.locator('.radar-axis').nth(1).getAttribute('aria-pressed'), 'true', `Enter en un eje lo elige (${tag})`);
    await page.locator('#skill-detail-title').waitFor(); assert.ok((await page.locator('#skill-detail-title').innerText()).includes(lang === 'es' ? 'número 2' : 'number 2'), `abre el detalle de esa capacidad (${tag})`);
    // tabla alternativa: cerrada por defecto, mismo contenido (12 filas), el nombre de la fila abre el detalle
    assert.equal(await page.locator('details.radar-table').getAttribute('open'), null, `tabla cerrada con 12 capacidades (${tag})`);
    await page.locator('details.radar-table summary').click();
    assert.equal(await page.locator('details.radar-table tbody tr').count(), 12, `tabla con una fila por capacidad (${tag})`);
    assert.ok((await page.locator('details.radar-table summary').textContent()).includes(c.table), `resumen «${c.table}» (${tag})`);
    assert.deepEqual(await axe(page), [], `axe radar con tabla abierta (${tag})`);
    await page.locator('.radar-table-skill').nth(4).click(); assert.ok((await page.locator('#skill-detail-title').innerText()).includes(lang === 'es' ? 'número 5' : 'number 5'), `la tabla abre el mismo detalle (${tag})`);
    await context.close();
    check(`mapa con 12 capacidades (${tag}): relieve sin solapes y axe 2.2 AA 0, lista con «${c.level(3)}», radar con ejes-botón, puntos solo con nivel, sin relleno, mismo nivel en las 3 vistas, teclado y tabla`);
  }

  // 2. N dinámico: 3 (con relleno si todas tienen nivel), 16 (solo marcas) y 30 (imagen + tabla abierta)
  { const { context, page } = await open(1360, 'es', 'light', mk(5, { all: true }));
    await view(page, 'Radar'); await page.locator('.radar-poly').waitFor();
    assert.equal(await page.locator('.radar-axis').count(), 5, 'N = 5 ejes (no fijo en 8)'); assert.equal(await page.locator('.radar-poly svg .radar-fill').count(), 1, 'con todas las capacidades con nivel aparece el relleno');
    assert.equal(await page.locator('.radar-poly svg circle').count(), 5); assert.deepEqual(await axe(page), [], 'axe radar completo'); await context.close(); }
  { const { context, page } = await open(1360, 'es', 'dark', mk(16));
    await view(page, 'Radar'); await page.locator('.radar-poly.is-marks').waitFor();
    assert.equal(await page.locator('.radar-axis').count(), 16, '16 ejes como marcas'); assert.equal(await overlapping(page, '.radar-axis'), 0, '16 marcas sin solape');
    assert.equal(await page.locator('.radar-axis').first().evaluate((el) => Math.round(el.getBoundingClientRect().width)), 28, 'objetivo de 28 px');
    assert.deepEqual(await axe(page), [], 'axe radar con 16 capacidades'); await context.close(); }
  { const { context, page } = await open(390, 'en', 'light', mk(30));
    await view(page, 'Radar'); await page.locator('.radar-poly.is-image').waitFor();
    assert.equal(await page.locator('.radar-axis').count(), 0, 'con 30 capacidades el gráfico es una imagen'); assert.notEqual(await page.locator('details.radar-table').getAttribute('open'), null, 'la tabla se abre sola');
    assert.equal(await page.locator('details.radar-table tbody tr').count(), 30); assert.deepEqual(await axe(page), [], 'axe radar con 30 capacidades');
    await page.locator('.radar-table-skill').nth(7).click(); assert.ok((await page.locator('#skill-detail-title').innerText()).includes('number 8'), 'la tabla es la superficie interactiva'); await context.close(); }
  check('N dinámico: 5 ejes con relleno (todas con nivel), 16 solo marcas de 28 px sin solape, 30 imagen + tabla abierta que abre el detalle; axe 2.2 AA 0');

  // 3. Estados: sin niveles (radar sin puntos, guía), relieve con 30 capacidades sin solapes
  { const { context, page } = await open(1360, 'es', 'light', mk(12, { empty: true }));
    await view(page, 'Radar'); await page.locator('.radar-poly').waitFor();
    assert.equal(await page.locator('.radar-poly svg circle').count(), 0, 'sin niveles: ningún punto'); assert.equal(await page.locator('.radar-axis[aria-label$="Sin nivel"]').count(), 12);
    assert.ok(await page.getByText('12 capacidades aún no tienen nivel').count() >= 1, 'aviso de capacidades sin nivel'); assert.deepEqual(await axe(page), [], 'axe radar sin niveles'); await context.close(); }
  { const { context, page } = await open(1360, 'es', 'light', mk(30));
    await page.locator('.skill-map-place').first().waitFor(); assert.equal(await overlapping(page, '.skill-map-place'), 0, 'relieve con 30 capacidades sin solapes (rótulos o solo marcas)');
    assert.deepEqual(await axe(page), [], 'axe relieve con 30 capacidades'); await context.close(); }
  check('estados: radar sin niveles (sin puntos, aviso) y relieve con 30 capacidades sin solapes, axe 0');

  assert.deepEqual(errors, [], 'errores de consola o de página: ' + errors.join(' | '));
  console.log(`\nES-300: ${count} comprobaciones OK`);
  await browser.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
