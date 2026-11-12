// ES-160: /app/skill-map con el sistema Cartografía dentro del marco de persona (PersonFrame). Chromium, API simulada (page.route), datos sintéticos.
// Mide: marco (encabezado, un h1, un main, pie), tres vistas (Relieve por defecto, Lista, Radar), resumen solo con niveles, relieve con un botón por capacidad, detalle con autoevaluación y revisión por separado,
// estados vacío y de error con reintento, teclado, sin desborde horizontal y axe (WCAG 2 A/AA) en claro y oscuro, ES/EN × 390/1360.
// Uso: npx vite build && npx vite preview --host 127.0.0.1 --port 4160 --strictPort   y luego
//   ES160_URL=http://127.0.0.1:4160 PLAYWRIGHT_MODULE=<ruta a playwright> AXE_PATH=<axe.min.js> node scripts/es160-check.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');

(async () => {
  const { chromium } = process.env.PLAYWRIGHT_MODULE ? require(process.env.PLAYWRIGHT_MODULE) : await import('playwright');
  const base = process.env.ES160_URL ?? 'http://127.0.0.1:4160';
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Solo vista previa local');
  const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8');
  const browser = await chromium.launch({ headless: true });
  const errors = []; let count = 0;
  const check = (label) => { count++; console.log('PASS ' + label); };
  const T = {
    es: { relief: 'Relieve', list: 'Lista', radar: 'Radar', strong: 'Tus puntos más fuertes', none: 'Sin evidencia vigente', retry: 'Reintentar', loadError: 'No pudimos cargar', unassigned: 'Sin territorio asignado', foot: 'No es terapia ni diagnóstico', self: 'Autoevaluación', review: 'Revisión humana', hint: 'Elige una capacidad' },
    en: { relief: 'Relief', list: 'List', radar: 'Radar', strong: 'Your strongest points', none: 'No current evidence', retry: 'Retry', loadError: 'We could not load', unassigned: 'No territory assigned', foot: 'It is not therapy or diagnosis', self: 'Self-assessment', review: 'Human review', hint: 'Choose a skill' },
  };
  const mk = (levels) => Array.from({ length: levels.length }, (_, i) => {
    const lvl = levels[i];
    const track = (level) => (level ? { level, state: 'initial', stale: false, catalogOutdated: false, confidence: 'medium', confidenceReason: { es: 'Respaldo sintético', en: 'Synthetic support' }, evidenceCount: 2, authoring: 'person', rationale: null, needsReview: false } : null);
    return { skillKey: 'sint_' + i, type: i < 5 ? 'transversal' : 'domain', labels: { es: `Capacidad sintética ${i + 1}`, en: `Synthetic skill ${i + 1}` }, territories: i % 3 === 2 ? [] : [['dir', 'con', 'com', 'ing', 'inn'][i % 5]],
      rubric: { levels: Object.fromEntries([1, 2, 3, 4].map((n) => [String(n), { es: `Criterio del nivel ${n}`, en: `Level ${n} criterion` }])), source: 'sintético', verifiedAt: '2026-11-01' }, self: track(lvl), review: i === 0 && lvl ? track(Math.max(1, lvl - 1)) : null, state: lvl ? 'initial' : 'no_evidence' };
  });
  const WITH = mk([3, 2, null, 4, 1, null, 2, null, 3, null]); const EMPTY = mk([null, null, null, null, null, null]);

  async function open(width, lang, scheme, { skills = WITH, failMap = 0 } = {}) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' });
    const page = await context.newPage(); let mapCalls = 0;
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
    await page.addInitScript(([l]) => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l); }, [lang]);
    await page.route('**/api/**', (route) => {
      const p = new URL(route.request().url()).pathname;
      if (p === '/api/session') return route.fulfill({ json: { role: 'user', onboardingCompleted: true } });
      if (p === '/api/skill-map') { mapCalls += 1; return mapCalls <= failMap ? route.fulfill({ status: 500, json: {} }) : route.fulfill({ json: { catalogVersion: 1, skills } }); }
      if (p === '/api/consents') return route.fulfill({ json: { consents: [] } });
      return route.fulfill({ json: [] });
    });
    await page.goto(base + '/app/skill-map', { waitUntil: 'networkidle' });
    return { context, page };
  }
  const axe = async (page) => { await page.evaluate(axeSource); return page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] })).violations.map((v) => v.id + ':' + v.nodes.length)); };
  const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

  for (const [width, lang, scheme] of [[390, 'es', 'light'], [390, 'en', 'dark'], [1360, 'es', 'dark'], [1360, 'en', 'light']]) {
    const tag = `${width}px ${lang} ${scheme}`; const c = T[lang];
    const { context, page } = await open(width, lang, scheme);
    // Marco de persona + una sola entrada de contenido
    assert.equal(await page.locator('h1').count(), 1, `un h1 (${tag})`);
    assert.equal(await page.locator('main#main').count(), 1, `un main (${tag})`);
    assert.ok(await page.locator('header.cg-header nav a[aria-current="page"]').count() >= 1, `el menú marca la ruta activa (${tag})`);
    assert.match(await page.locator('footer').innerText(), new RegExp(c.foot, 'i'), `pie con el aviso (${tag})`);
    assert.equal(await page.locator('.cg-frame').getAttribute('data-theme'), null, `el marco sigue el tema del sistema (${tag})`);
    // Relieve por defecto, con resumen y un botón por capacidad
    assert.equal(await page.getByRole('button', { name: c.relief, exact: true }).getAttribute('aria-pressed'), 'true', `Relieve por defecto (${tag})`);
    await page.getByRole('heading', { name: c.strong }).waitFor();
    assert.equal(await page.locator('.skill-map-place').count(), WITH.length, `un botón por capacidad en el relieve (${tag})`);
    assert.equal(await page.locator('.skill-map-relief-box [role="img"]').count(), 1, `el relieve tiene su descripción (${tag})`);
    assert.ok((await overflow(page)) <= 0, `sin desborde horizontal (${tag})`);
    assert.deepEqual(await axe(page), [], `axe relieve (${tag})`);
    // Detalle: elegir una capacidad con nivel por la lista; autoevaluación y revisión por separado; el foco pasa al detalle
    await page.locator('.skill-map-place').first().focus(); await page.keyboard.press('Enter');
    await page.getByText(c.self, { exact: true }).first().waitFor(); await page.getByText(c.review, { exact: true }).first().waitFor();
    assert.equal(await page.locator('.skill-map-place').first().getAttribute('aria-pressed'), 'true', `el botón elegido queda marcado (${tag})`);
    assert.deepEqual(await axe(page), [], `axe con detalle (${tag})`);
    // Lista y Radar
    await page.getByRole('button', { name: c.list, exact: true }).click();
    assert.equal(await page.locator('.skill-map-relief').count(), 0, `la lista no dibuja el relieve (${tag})`);
    assert.ok(await page.getByRole('heading', { name: c.unassigned }).count() >= 1, `«${c.unassigned}» en la lista (${tag})`);
    assert.deepEqual(await axe(page), [], `axe lista (${tag})`);
    await page.getByRole('button', { name: c.radar, exact: true }).click();
    await page.locator('.radar-board').waitFor();
    assert.ok((await overflow(page)) <= 0, `radar sin desborde (${tag})`);
    assert.deepEqual(await axe(page), [], `axe radar (${tag})`);
    await context.close();
    check(`mapa (${tag}): marco, relieve + resumen + botones, detalle por teclado, lista, radar, sin desborde, axe 0`);
  }

  for (const [lang, scheme] of [['es', 'light'], ['en', 'dark']]) { // vacío y error con reintento
    const c = T[lang]; const tag = `${lang} ${scheme}`;
    { const { context, page } = await open(1360, lang, scheme, { skills: EMPTY });
      await page.locator('.skill-map-place').first().waitFor();
      assert.equal(await page.getByRole('heading', { name: c.strong }).count(), 0, `sin niveles no hay resumen (${tag})`);
      assert.equal(await page.locator('.skill-map-place.is-flat').count(), EMPTY.length, `todo plano: «${c.none}», nunca un déficit (${tag})`);
      assert.deepEqual(await axe(page), [], `axe vacío (${tag})`); await context.close(); }
    { const { context, page } = await open(1360, lang, scheme, { failMap: 1 });
      const alert = page.getByRole('alert').filter({ hasText: c.loadError }); await alert.waitFor();
      await alert.getByRole('button', { name: c.retry }).click();
      await page.locator('.skill-map-place').first().waitFor();
      assert.equal(await page.getByRole('alert').filter({ hasText: c.loadError }).count(), 0);
      await context.close(); }
    check(`estados (${tag}): vacío (plano, sin resumen) y error con «${c.retry}» que recupera el mapa`);
  }

  assert.deepEqual(errors, [], 'errores de consola o de página: ' + errors.join(' | '));
  console.log(`\nES-160: ${count} comprobaciones OK`);
  await browser.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
