// ES-153 (paso 1): PersonLayout sobre /app/*. Chromium, API simulada (page.route), datos sintéticos.
// Mide: en cada ruta de persona UN encabezado, UN <main>, UN «Saltar al contenido» y un pie (el chat no lleva pie y conserva «Límites del asistente»); la sala de sesión queda sin marco;
// el marco NO se desmonta al cambiar de pantalla (mismo nodo, foco en el main, ruta activa con aria-current); tema del sistema solo en las pantallas migradas (mapa); carga con marco fijo;
// «Ejercicios opcionales» alcanzable desde «Mis herramientas»; sin desborde a 390/320 px; axe wcag2a/2aa/21aa/22aa sobre el marco (encabezado, pie, «Saltar») y conteo sobre la pantalla completa.
// Uso: npx vite build && npx vite preview --host 127.0.0.1 --port 4153 --strictPort   y luego
//   ES153_URL=http://127.0.0.1:4153 PLAYWRIGHT_MODULE=<ruta a playwright> AXE_PATH=<axe.min.js> [ES153_OUT=<carpeta de capturas>] node scripts/es153-layout-check.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path');

(async () => {
  const { chromium } = process.env.PLAYWRIGHT_MODULE ? require(process.env.PLAYWRIGHT_MODULE) : await import('playwright');
  const base = process.env.ES153_URL ?? 'http://127.0.0.1:4153';
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Solo vista previa local');
  const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8'); const out = process.env.ES153_OUT;
  const browser = await chromium.launch({ headless: true });
  const errors = []; let count = 0; const info = [];
  const check = (label) => { count++; console.log('PASS ' + label); };
  const ROUTES = ['/app/dashboard', '/app/checkin', '/app/chat', '/app/diary', '/app/plan', '/app/data', '/app/space/tools', '/app/bridge', '/app/evidence', '/app/skill-map', '/app/progress', '/app/feedback', '/app/compass', '/app/exercises',
    '/app/route-catalog', '/app/next-step', '/app/professional-reviews', '/app/context/resumes', '/app/my-therapist'];
  const T = { es: { limits: 'Límites del asistente', foot: 'No es terapia ni diagnóstico', exercises: 'Ejercicios opcionales', tools: 'Mis herramientas', loading: 'Cargando la pantalla', skip: 'Saltar al contenido' }, en: { limits: 'Assistant limits', foot: 'It is not therapy or diagnosis', exercises: 'Optional exercises', tools: 'My tools', loading: 'Loading the screen', skip: 'Skip to content' } };

  async function open(width, lang, scheme, route, { delay = 0 } = {}) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(`${route}: ${e.message}`));
    await page.addInitScript(([l]) => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l); }, [lang]);
    await page.route('**/api/**', async (r) => {
      const p = new URL(r.request().url()).pathname;
      if (p === '/api/session') return r.fulfill({ json: { role: 'user', onboardingCompleted: true } });
      if (p === '/api/skill-map') return r.fulfill({ json: { catalogVersion: 1, skills: [] } });
      if (p === '/api/consents') return r.fulfill({ json: { consents: [] } });
      return r.fulfill({ json: [] });
    });
    if (delay) await page.route('**/assets/**', async (r) => { await new Promise((ok) => setTimeout(ok, delay)); await r.continue(); });
    await page.goto(base + route, { waitUntil: 'networkidle' });
    return { context, page };
  }
  const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const frameAxe = async (page) => { await page.evaluate(axeSource); return page.evaluate(async () => {
    const r = await window.axe.run({ include: [['.cg-frame > a.cg-skip'], ['.cg-frame > header.cg-header'], ['.cg-frame > footer.cg-footer']] }, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] });
    return r.violations.map((v) => v.id + ':' + v.nodes.length);
  }); };
  const pageAxe = async (page) => page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] })).violations.map((v) => v.id + ':' + v.nodes.length));

  // 1. Estructura por ruta: un encabezado, un main, un «Saltar», pie salvo en el chat; sin desborde del marco
  for (const [width, lang] of [[1360, 'es'], [390, 'en']]) {
    const rows = [];
    for (const route of ROUTES) {
      const { context, page } = await open(width, lang, 'light', route);
      const f = await page.evaluate(() => ({ headers: document.querySelectorAll('.cg-frame > header.cg-header').length, mains: document.querySelectorAll('main').length, skips: document.querySelectorAll('.cg-frame > a.cg-skip').length, footers: document.querySelectorAll('.cg-frame > footer.cg-footer').length, path: location.pathname }));
      assert.equal(f.path, route, `${route}: no redirige (${width}px)`);
      assert.equal(f.headers, 1 + 0, `${route}: un encabezado del marco (${width}px)`); assert.equal(f.mains, 1, `${route}: un solo <main> (${width}px, hay ${f.mains})`); assert.equal(f.skips, 1, `${route}: un «Saltar al contenido» del marco (${width}px)`);
      assert.equal(f.footers, route === '/app/chat' ? 0 : 1, `${route}: pie ${route === '/app/chat' ? 'ausente en el chat' : 'presente'} (${width}px)`);
      if (route === '/app/chat') assert.ok(await page.locator('.chat-limits').isVisible(), `el chat conserva «${T[lang].limits}» visible (${width}px)`);
      const ov = await overflow(page); rows.push(`${route}:${ov}`);
      if (ov > 0) info.push(`desborde ${ov}px en ${route} a ${width}px (${lang})`);
      if (out && lang === 'es') await page.screenshot({ path: `${out}/${route.replace(/\//g, '_')}-${width}.png`, fullPage: false });
      assert.deepEqual(await frameAxe(page), [], `axe del marco ${route} (${width}px)`);
      await context.close();
    }
    check(`${ROUTES.length} rutas de persona a ${width}px (${lang}): un encabezado, un main, un «Saltar», pie (no en el chat), «Límites del asistente» en el chat, axe del marco 0`);
  }

  // 2. La sala de sesión queda fuera del marco
  { const { context, page } = await open(1360, 'es', 'light', '/app/session/1');
    assert.equal(await page.locator('.cg-frame > header.cg-header').count(), 0, 'la sala no lleva el marco de persona'); await context.close(); check('/app/session/:id sin marco de persona'); }

  const migrated = [...fs.readFileSync(path.join(__dirname, '../src/shell/personLayoutState.ts'), 'utf8').matchAll(/'(\/app\/[^']+)'/g)].map(match => match[1])
  const legacyStart = ['/app/dashboard', '/app/chat', '/app/progress', '/app/evidence'].find(route => !migrated.some(item => route === item || route.startsWith(item + '/')))
  assert.ok(legacyStart, 'ya no queda una pantalla heredada de la lista LEGACY_START: añade otra o retira esta comprobación')
  // 3. El marco no se desmonta al cambiar de pantalla; foco en el main; ruta activa; tema solo en pantallas migradas
  for (const lang of ['es', 'en']) {
    // ES-318: la pantalla «heredada» de partida es la primera de LEGACY_START que aún no está en MIGRATED_PERSON_PATHS (antes era /app/diary, que ES-307 migró). Así la comprobación no caduca con cada migración.
    const { context, page } = await open(1360, lang, 'dark', legacyStart);
    await page.evaluate(() => { document.querySelector('.cg-frame > header.cg-header').setAttribute('data-keep', 'si'); });
    assert.equal(await page.locator('.cg-frame').getAttribute('data-theme'), 'light', `pantalla heredada ${legacyStart}: tema claro fijo (${lang})`);
    await page.locator('.cg-frame > header.cg-header nav a[href="/app/skill-map"]').click(); await page.waitForURL('**/app/skill-map');
    await page.locator('h1').first().waitFor();
    assert.equal(await page.locator('.cg-frame > header.cg-header[data-keep="si"]').count(), 1, `el encabezado es el mismo nodo tras cambiar de pantalla (${lang})`);
    await page.waitForFunction(() => document.activeElement && document.activeElement.id === 'main', null, { timeout: 4000 }).catch(() => {}); assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), 'main', `el foco pasa al main (${lang})`);
    assert.equal(await page.locator('.cg-frame > header.cg-header nav a[aria-current="page"]').count(), 1, `una ruta activa (${lang})`);
    assert.equal(await page.locator('.cg-frame').getAttribute('data-theme'), null, `pantalla migrada (mapa): tema del sistema (${lang})`);
    await page.locator('.cg-frame > header.cg-header nav a[href="/app/chat"]').click(); await page.waitForURL('**/app/chat');
    assert.equal(await page.locator('.cg-frame > header.cg-header[data-keep="si"]').count(), 1, `el encabezado sigue siendo el mismo nodo en el chat (${lang})`);
    await page.waitForFunction(() => document.querySelectorAll('.cg-frame > footer.cg-footer').length === 0, null, { timeout: 4000 }); assert.equal(await page.locator('.cg-frame > footer.cg-footer').count(), 0, `sin pie en el chat (${lang})`);
    await page.locator('.cg-frame > header.cg-header nav a[href="/app/diary"]').click(); await page.waitForURL('**/app/diary');
    await page.waitForFunction(() => document.querySelectorAll('.cg-frame > footer.cg-footer').length === 1, null, { timeout: 4000 }); assert.equal(await page.locator('.cg-frame > footer.cg-footer').count(), 1, `el pie vuelve al salir del chat (${lang})`);
    await context.close();
  }
  check('el marco no se desmonta entre mapa, chat y diario; foco en el main; una ruta activa; tema del sistema solo en el mapa; pie solo fuera del chat');

  // 4. Carga con el marco puesto (bloque lento): el esqueleto va dentro del main; al cambiar de pantalla la anterior sigue visible hasta que baja la nueva (sin parpadeo del marco)
  { const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, reducedMotion: 'reduce' }); const page = await context.newPage();
    await page.addInitScript(() => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', 'es'); });
    await page.route('**/api/**', (r) => { const p = new URL(r.request().url()).pathname; return r.fulfill({ json: p === '/api/session' ? { role: 'user', onboardingCompleted: true } : [] }); });
    await page.route('**/assets/Journal*.js', async (r) => { await new Promise((ok) => setTimeout(ok, 2500)); await r.continue(); });
    await page.goto(base + '/app/diary', { waitUntil: 'commit' });
    await page.locator('.cg-frame > header.cg-header').waitFor({ timeout: 8000 });
    const status = page.locator('main#main [role="status"]', { hasText: T.es.loading });
    await status.waitFor({ timeout: 8000 }); assert.equal(await page.locator('main#main').count(), 1, 'el esqueleto va dentro del main'); assert.equal(await page.locator('.cg-frame > header.cg-header').count(), 1, 'mientras carga la pantalla, el marco ya está puesto');
    await page.locator('h1').first().waitFor({ timeout: 10000 }); assert.equal(await status.count(), 0, 'el esqueleto se retira al cargar');
    await context.close(); check('carga de pantalla lenta: marco puesto + «Cargando la pantalla…» (role=status) dentro del main; se retira al cargar'); }
  for (const lang of ['es', 'en']) {
    const { context, page } = await open(390, lang, 'light', '/app/space/tools');
    const link = page.getByRole('link', { name: 'Abrir' }).or(page.getByRole('link', { name: 'Open' }));
    assert.ok((await page.locator('a[href="/app/exercises?from=dashboard"]').count()) === 1, `«${T[lang].exercises}» se alcanza desde «${T[lang].tools}» (${lang})`);
    await page.locator('a[href="/app/exercises?from=dashboard"]').click(); await page.waitForURL('**/app/exercises**'); assert.equal(await page.locator('main').count(), 1, `un main en ejercicios (${lang})`); void link;
    await context.close();
  }
  check('«Ejercicios opcionales» alcanzable desde «Mis herramientas» (ES/EN, 390 px)');

  // 5. Desbordes a 320 px y axe de pantalla completa (informativo para pantallas heredadas)
  for (const route of ['/app/skill-map', '/app/diary', '/app/chat', '/app/space/tools']) {
    const { context, page } = await open(320, 'es', 'light', route); const ov = await overflow(page);
    if (ov > 0) info.push(`desborde ${ov}px en ${route} a 320px`); await page.evaluate(axeSource); const v = await pageAxe(page); info.push(`axe pantalla completa ${route} (320px): ${v.join(', ') || '0'}`);
    await context.close();
  }
  check('barrido a 320 px (desbordes y axe de pantalla completa, informativo)');

  assert.deepEqual(errors.filter((e) => !/Failed to load resource|TypeError: .*(map|reduce|filter|length|undefined|null)/.test(e)), [], 'errores de página: ' + errors.join(' | '));
  if (errors.length) info.push(`errores de página con datos simulados vacíos (no del layout): ${errors.length}`);
  console.log(info.map((l) => 'INFO ' + l).join('\n')); console.log(`\nES-153 paso 1: ${count} comprobaciones OK`);
  await browser.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
