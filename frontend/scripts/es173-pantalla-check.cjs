// ES-173 (HU-P22): «Tu progreso» (/app/progress) y «Tu opinión» (/app/feedback) con Cartografía, medidas en Chromium sobre el build real de React.
// Sin servidor real ni IA: la API se simula con page.route (datos SINTÉTICOS) y no se toca producción. Comprueba estados (datos, vacío, error con reintento, cargando), ES/EN × 390/1360 × claro/oscuro,
// sin desbordes (incluido texto largo sin espacios), axe (wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa: target-size 2.5.8 y label-content-name 2.5.3 incluidos), teclado, tamaño de objetivos,
// emparejamiento con el MISMO cuerpo hacia el servidor y «Opinión» sobre fixtures sin escrituras de red.
// Uso: PLAYWRIGHT_MODULE=<ruta a playwright> AXE_PATH=<axe.min.js> node scripts/es173-pantalla-check.cjs   (construye dos veces con vite; tarda ~1 min)
const fs = require('node:fs'); const path = require('node:path'); const http = require('node:http'); const os = require('node:os');
const { spawnSync } = require('node:child_process'); const { once } = require('node:events'); const assert = require('node:assert/strict');
const { fail } = require('./_exitOnFailure.cjs');

(async () => {
  const root = path.resolve(__dirname, '..'); const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'es173-')); const checks = []; const servers = []; let browser;
  const check = label => { checks.push(label); console.log('PASS ' + label); };
  const build = (name, preview) => {
    const out = path.join(tmp, name);
    const result = spawnSync(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', out], { cwd: root, encoding: 'utf8', env: { ...process.env, VITE_ENABLE_PILOT_FEEDBACK_PREVIEW: preview ? 'true' : 'false', VITE_PILOT_FEEDBACK_SCENARIO: '' } });
    if (result.status !== 0) throw new Error('build ' + name + ': ' + result.stderr); return out;
  };
  const serve = async dist => {
    const server = http.createServer((req, res) => {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); const target = path.resolve(dist, '.' + pathname);
      if (!target.startsWith(dist + path.sep) && target !== dist) { res.writeHead(404).end(); return; }
      const file = fs.existsSync(target) && fs.statSync(target).isFile() ? target : path.join(dist, 'index.html');
      res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' })[path.extname(file)] || 'text/html'); res.end(fs.readFileSync(file));
    }); server.listen(0, '127.0.0.1'); await once(server, 'listening'); servers.push(server); return `http://127.0.0.1:${server.address().port}`;
  };
  try {
    const progressOrigin = await serve(build('progress', false)); const feedbackOrigin = await serve(build('feedback', true));
    const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright'); browser = await chromium.launch({ headless: true });
    const axeSource = process.env.AXE_PATH ? fs.readFileSync(process.env.AXE_PATH, 'utf8') : '';
    assert.ok(axeSource, 'Se necesita AXE_PATH (axe.min.js)');
    const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
    const axe = async (page, label) => {
      await page.addScriptTag({ content: axeSource });
      const violations = await page.evaluate(tags => axe.run(document, { runOnly: { type: 'tag', values: tags } }).then(r => r.violations.map(v => v.id + ':' + v.nodes.length)), TAGS);
      assert.deepEqual(violations, [], label + ' axe'); check(label + ': axe 0 (wcag2a/2aa/21a/21aa/22aa)');
    };
    const noOverflow = async (page, label) => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), label + ': sin scroll horizontal');
    const targets = async (page, label) => {
      const small = await page.evaluate(() => [...document.querySelectorAll('main button, main a, main select, main input, header a, header button, dialog button')].filter(e => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && s.visibility !== 'hidden' && (e.type !== 'radio' && e.type !== 'checkbox') && (r.height < 24 || r.width < 24) }).map(e => e.tagName + ':' + (e.textContent || '').slice(0, 20)));
      assert.deepEqual(small, [], label + ': objetivos ≥ 24 px');
    };
    const LONG = 'X'.repeat(140);
    const day = n => new Date(Date.now() - n * 86400000).toISOString();
    const DATA = {
      stats: { totalSessions: 9, avgMood: 3.6, avgRating: 4, streak: 5 },
      moodLogs: [{ id: 1, date: day(0), checkin_mood: 2, checkout_mood: 4 }, { id: 2, date: day(1), checkin_mood: 3, checkout_mood: 3 }, { id: 3, date: day(2), checkin_mood: 4, checkout_mood: 2 }, { id: 4, date: day(3), checkin_mood: 3, checkout_mood: null }],
      ratings: [{ id: 1, date: day(0), rating: 5 }, { id: 2, date: day(1), rating: 4 }],
      recommendations: [{ id: 1, category: 'habit', content: 'Una pausa breve entre tareas. ' + LONG, generatedAt: day(0), seenByUser: false }, { id: 2, category: 'unknown_kind', content: '<b>texto</b> con etiquetas', generatedAt: day(1), seenByUser: true }],
    };
    const EMPTY = { stats: { totalSessions: 0, avgMood: null, avgRating: null, streak: 0 }, moodLogs: [], ratings: [], recommendations: [] };
    async function open(origin, route, { lang, width, scheme, progress = DATA, failFirst = false, delay = 0, matching } = {}) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' }); const page = await context.newPage();
      const runtime = []; const writes = []; page.on('pageerror', e => runtime.push(e.message));
      await context.addInitScript(([l]) => { localStorage.setItem('elevation_token', 'es173-synthetic-session'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l); }, [lang]);
      let calls = 0;
      await page.route('**/api/**', r => { if (r.request().method() !== 'GET') writes.push(r.request().method() + ' ' + new URL(r.request().url()).pathname); return r.fulfill({ json: {} }); });
      await page.route('**/api/session', r => r.fulfill({ json: { role: 'user', onboardingCompleted: true } }));
      await page.route('**/api/user/progress', async r => { calls++; if (failFirst && calls === 1) return r.abort('connectionreset'); if (delay) await new Promise(res => setTimeout(res, delay)); return r.fulfill({ json: progress }); });
      if (matching) await matching(page);
      await page.goto(origin + route); return { context, page, runtime, writes };
    }
    const T = {
      es: { h1: 'Tu progreso', up: 'Subió', same: 'Igual', down: 'Bajó', empty: 'Aún no hay registros.', go: 'Ir al registro', find: 'Encontrar profesional', error: 'No se pudo cargar tu progreso.', retry: 'Reintentar', fresh: 'Nueva', stress: 'Estrés y carga', fig: '3,6 de 5' },
      en: { h1: 'Your progress', up: 'Went up', same: 'Stayed the same', down: 'Went down', empty: 'No records yet.', go: 'Go to check-in', find: 'Find a professional', error: 'Could not load your progress.', retry: 'Retry', fresh: 'New', stress: 'Stress and workload', fig: '3.6 of 5' },
    };
    // 1) Progreso con datos: ES/EN × 390/1360 × claro/oscuro
    for (const lang of ['es', 'en']) for (const width of [390, 1360]) for (const scheme of ['light', 'dark']) {
      const t = T[lang]; const tag = `progreso ${lang} ${width}px ${scheme}`; const { context, page, runtime } = await open(progressOrigin, '/app/progress', { lang, width, scheme });
      await page.getByRole('heading', { level: 1, name: t.h1 }).waitFor(); await page.getByText(t.fig, { exact: false }).first().waitFor();
      const main = await page.locator('main').innerText(); const html = await page.locator('main').innerHTML();
      for (const word of [t.up, t.same, t.down, t.fresh]) assert.ok(main.toLowerCase().includes(word.toLowerCase()), tag + ': ' + word);
      assert.ok(main.includes('↑') && main.includes('↓') && main.includes('='), tag + ': símbolos de tendencia junto a la palabra');
      assert.ok(main.includes('<b>texto</b> con etiquetas'), tag + ': el contenido del servidor se muestra como texto'); assert.equal(await page.locator('main b').count(), 0);
      assert.doesNotMatch(main, /\p{Extended_Pictographic}|★|☆/u, tag + ': sin emojis ni estrellas'); assert.equal(await page.locator('[style]').count(), 0, tag + ': sin estilos en línea');
      assert.ok(html.includes('role="note"') || (await page.locator('[role=note]').count()) > 0, tag + ': aviso no clínico');
      await noOverflow(page, tag); await targets(page, tag); await axe(page, tag); assert.deepEqual(runtime, [], tag + ': sin errores de ejecución'); await context.close();
    }
    check('progreso con datos: palabra + símbolo, contenido como texto, sin emojis/estilos en línea, sin desbordes (texto largo incluido), objetivos ≥ 24 px');
    // 2) vacío y cargando
    for (const lang of ['es', 'en']) {
      const t = T[lang]; const { context, page } = await open(progressOrigin, '/app/progress', { lang, width: 390, scheme: 'light', progress: EMPTY });
      await page.getByText(t.empty, { exact: true }).waitFor(); await page.getByRole('link', { name: t.go }).waitFor(); assert.equal(await page.locator('main li').count(), 0); await axe(page, 'vacío ' + lang); await context.close();
    }
    { const { context, page } = await open(progressOrigin, '/app/progress', { lang: 'es', width: 390, scheme: 'light', delay: 900 }); await page.getByRole('status').filter({ hasText: 'Cargando tu progreso' }).waitFor(); await page.getByRole('heading', { level: 1 }).waitFor(); await axe(page, 'cargando'); await context.close(); }
    check('progreso vacío (con «Ir al registro») y cargando (role=status)');
    // 3) error con reintento y foco
    for (const lang of ['es', 'en']) {
      const t = T[lang]; const { context, page } = await open(progressOrigin, '/app/progress', { lang, width: 390, scheme: 'dark', failFirst: true });
      await page.getByRole('alert').filter({ hasText: t.error }).waitFor(); assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.textContent), t.retry, 'el foco cae en «Reintentar»');
      await axe(page, 'error ' + lang); await page.keyboard.press('Enter'); await page.getByText(t.fig, { exact: false }).first().waitFor(); assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.tagName), 'H1', 'tras recuperar el foco va al título'); await context.close();
    }
    check('error con «Reintentar» (foco en el botón y luego en el título), por teclado, ES/EN');
    // 4) emparejamiento: teclado, cuerpo hacia el servidor, foco
    for (const lang of ['es', 'en']) {
      const t = T[lang]; const bodies = [];
      const { context, page, runtime } = await open(progressOrigin, '/app/progress', { lang, width: 390, scheme: 'light', matching: async p => {
        await p.route('**/api/matching/request', r => { bodies.push(['request', r.request().postDataJSON()]); return r.fulfill({ json: { requestId: 77, suggestions: [{ therapistId: 5, therapistName: 'Profesional Sintética', reason: 'Motivo sintético ' + 'Y'.repeat(120) }] } }); });
        await p.route('**/api/matching/choose', r => { bodies.push(['choose', r.request().postDataJSON()]); return r.fulfill({ json: { ok: true } }); });
      } });
      const opener = page.getByRole('button', { name: t.find, exact: true }); await opener.waitFor(); await opener.focus(); await page.keyboard.press('Enter');
      const dialog = page.locator('dialog[open]'); await dialog.waitFor(); assert.equal(await dialog.evaluate(d => d.contains(document.activeElement)), true, 'el foco entra al diálogo'); await axe(page, 'diálogo ' + lang);
      assert.equal(await dialog.getByRole('button', { name: lang === 'es' ? 'Encontrar mi profesional' : 'Find my professional' }).isDisabled(), true);
      const selects = dialog.locator('select'); await selects.nth(0).selectOption('anxiety'); await selects.nth(1).selectOption('any'); await selects.nth(2).selectOption('No preference');
      assert.equal(await selects.nth(0).locator('option:checked').innerText(), t.stress, 'etiqueta «Estrés y carga» / «Stress and workload» con la clave interna anxiety');
      assert.equal((await selects.nth(0).locator('option').allInnerTexts()).some(x => /Ansiedad|Anxiety/.test(x)), false);
      await dialog.getByRole('button', { name: lang === 'es' ? 'Encontrar mi profesional' : 'Find my professional' }).click(); await dialog.getByText('Profesional Sintética').waitFor(); await noOverflow(page, 'diálogo resultados ' + lang); await axe(page, 'resultados ' + lang);
      await dialog.getByRole('button', { name: lang === 'es' ? 'Elegir a este profesional' : 'Choose this professional' }).click(); await dialog.getByRole('status').waitFor();
      assert.deepEqual(bodies, [['request', { answers: { area: 'anxiety', style: 'any', language: 'No preference' } }], ['choose', { requestId: 77, therapistId: 5 }]], 'cuerpos idénticos a los del contrato HU-060');
      await dialog.getByRole('button', { name: lang === 'es' ? 'Cerrar' : 'Close' }).click(); await page.locator('dialog[open]').waitFor({ state: 'detached' }).catch(() => {}); assert.equal(await page.locator('dialog[open]').count(), 0);
      assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.textContent), t.find, 'el foco vuelve al botón que abrió el diálogo'); assert.deepEqual(runtime, []);
      await opener.focus(); await page.keyboard.press('Enter'); await page.locator('dialog[open]').waitFor(); await page.keyboard.press('Escape'); assert.equal(await page.locator('dialog[open]').count(), 0, 'Escape cierra'); assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.textContent), t.find);
      await context.close();
    }
    check('emparejamiento: diálogo con foco atrapado/devuelto y Escape, «Estrés y carga» con clave anxiety, cuerpos de request/choose idénticos, axe 0 en cada paso, ES/EN');
    // 5) Opinión (fixtures): franja, estados y teclado
    for (const lang of ['es', 'en']) for (const width of [390, 1360]) for (const scheme of ['light', 'dark']) {
      const tag = `opinión ${lang} ${width}px ${scheme}`; const { context, page, runtime, writes } = await open(feedbackOrigin, '/app/feedback', { lang, width, scheme });
      await page.getByRole('heading', { level: 1 }).waitFor(); const preview = lang === 'es' ? 'Vista de revisión · datos ficticios' : 'Review preview · fictional data';
      await page.getByText(preview, { exact: true }).waitFor(); assert.equal(await page.locator('main input[type=radio]').count() > 0, true); assert.equal(await page.locator('[style]').count(), 0, tag + ': sin estilos en línea');
      assert.equal(await page.locator('main textarea, main input[type=text]').count(), 0, tag + ': sin texto libre');
      await noOverflow(page, tag); await targets(page, tag); await axe(page, tag); assert.deepEqual(runtime, []); assert.deepEqual(writes, [], tag + ': ninguna escritura de red'); await context.close();
    }
    { const { context, page, writes } = await open(feedbackOrigin, '/app/feedback', { lang: 'es', width: 390, scheme: 'light' });
      await page.getByRole('heading', { level: 1 }).waitFor(); const first = page.locator('input[name="listened"]').first(); await first.focus(); await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown');
      assert.equal(await page.locator('input[name="listened"]:checked').count(), 1, 'las flechas mueven la selección del grupo');
      await page.getByRole('button', { name: 'Guardar respuestas (simulación)', exact: true }).click(); await page.getByText('Guardado solo en la simulación.', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Retirar respuesta (simulación)', exact: true }).click(); const dialog = page.locator('dialog[open]'); await dialog.waitFor();
      assert.equal(await dialog.evaluate(d => d.contains(document.activeElement)), true); await axe(page, 'opinión diálogo'); await page.keyboard.press('Escape'); assert.equal(await page.locator('dialog[open]').count(), 0);
      assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.textContent), 'Retirar respuesta (simulación)', 'Escape devuelve el foco al botón');
      await page.getByRole('button', { name: 'Retirar respuesta (simulación)', exact: true }).click(); await page.locator('dialog[open]').getByRole('button', { name: 'Confirmar retirada', exact: true }).click(); await page.getByText('Respuesta retirada de la simulación.', { exact: true }).waitFor();
      assert.equal(await page.locator('main input:checked').count(), 0); assert.deepEqual(writes, []); await context.close(); }
    check('opinión (fixtures): franja «datos ficticios» presente, sin texto libre, axe 0 ES/EN × 390/1360 × claro/oscuro, flechas, guardar/retirar con diálogo y foco, cero escrituras de red');
    console.log('\nES-173 pantalla: ' + checks.length + ' comprobaciones PASS');
  } catch (error) { console.error('ES-173 pantalla falló:', error); fail(); }
  finally { await browser?.close(); for (const server of servers) server.close(); fs.rmSync(tmp, { recursive: true, force: true }); }
})();
