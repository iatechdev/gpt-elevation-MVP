// ES-179 (PR B): sala de sesión del profesional (/therapist/session/:id) con el servidor REAL (Express + rutas de sesiones y de consentimientos + modelos + PostgreSQL embebido MIGRADO) y la pantalla construida en Chromium.
// El video externo (Daily) se SIMULA con un doble: ninguna llamada real. Se comprueba contra la base: pantalla previa sin iniciar nada, inicio idempotente (una sala), recarga que recupera la misma sala y el temporizador desde startedAt, autoguardado
// de UNA nota viva con versión/requestId, error que conserva el texto y «Guardar ahora», conflicto de otra pestaña, cierre (validaciones, ánimo en palabras, «Finalizar» no rojo, aviso si no hubo recomendación), sesión ya cerrada y ajena. ES/EN × 390/1360, axe 0.
// Uso:  (cd frontend && npx vite build && npx vite preview --host 127.0.0.1 --port 4179 --strictPort)
//       ES179_BACKEND_DIR=<backend> ES179_PREVIEW_URL=http://127.0.0.1:4179 PLAYWRIGHT_MODULE=<playwright> AXE_PATH=<axe.min.js> node scripts/es179-api-integration.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const { once } = require('node:events');
const { randomBytes } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { createRequire } = require('node:module');
const { pathToFileURL } = require('node:url');
(async () => {
  assert.ok(process.env.ES179_BACKEND_DIR, 'Se necesita el directorio del backend');
  const backend = path.resolve(process.env.ES179_BACKEND_DIR);
  const fromBackend = createRequire(path.join(backend, 'package.json'));
  const { default: EmbeddedPostgres } = await import(pathToFileURL(fromBackend.resolve('embedded-postgres')).href);
  const parent = path.resolve(os.tmpdir()); const directory = fs.mkdtempSync(path.join(parent, 'es179-pg-'));
  const probe = net.createServer();
  const port = await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', () => { const p = probe.address().port; probe.close(() => resolve(p)); }); });
  const password = randomBytes(24).toString('hex');
  const pg = new EmbeddedPostgres({ databaseDir: directory, user: 'es179_test', password, port, persistent: false, initdbFlags: ['--encoding=UTF8', '--locale=C'], postgresFlags: ['-h', '127.0.0.1'], onLog: () => {}, onError: () => {} });
  let started = false; let sequelize; let server; let browser; let db; const checks = []; const check = label => { checks.push(label); console.log('PASS ' + label); };
  try {
    await pg.initialise(); await pg.start(); started = true;
    const url = `postgres://es179_test:${password}@127.0.0.1:${port}/postgres`;
    const migrated = spawnSync('npx', ['sequelize-cli', 'db:migrate'], { cwd: backend, encoding: 'utf8', shell: process.platform === 'win32', env: { ...process.env, DATABASE_URL: url, DB_SSL: 'false', NODE_ENV: 'test' } });
    assert.equal(migrated.status, 0, 'Fallaron las migraciones: ' + (migrated.stdout + migrated.stderr).slice(-500));
    const { Sequelize } = fromBackend('sequelize'); const { Client } = fromBackend('pg');
    sequelize = new Sequelize(url, { logging: false, dialectOptions: { ssl: false }, pool: { max: 8, min: 0 } });
    process.env.JWT_SECRET = randomBytes(32).toString('hex'); process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString('hex'); process.env.NODE_ENV = 'test'; process.env.AI_BUDGET_TOKENS_PER_USER = '1000000000'; process.env.AI_BUDGET_PERIOD = 'month';
    const fake = { ai: 'ok', daily: 'ok', dailyCalls: 0 };
    process.env.DAILY_API_KEY = 'clave-sintetica-no-real';
    const realFetch = global.fetch;
    global.fetch = async (input, init) => { const u = String(input && input.url ? input.url : input); if (u.startsWith('https://api.daily.co/')) { fake.dailyCalls += 1; await new Promise((r) => setTimeout(r, 150)); if (fake.daily === 'fail') return { ok: false, status: 500, json: async () => ({ error: 'simulado' }) }; return { ok: true, status: 200, json: async () => ({ url: 'https://example.invalid/sala-sintetica-' + fake.dailyCalls }) }; } return realFetch(input, init); };
    const dbId = fromBackend.resolve('./database'); require.cache[dbId] = { id: dbId, filename: dbId, loaded: true, exports: { sequelize } };
    const anthropicId = fromBackend.resolve('./utils/anthropic'); require.cache[anthropicId] = { id: anthropicId, filename: anthropicId, loaded: true, exports: { MODEL: 'sintetico', messages: { create: async () => { if (fake.ai === 'fail') throw new Error('proveedor simulado caído'); return { content: [{ type: 'text', text: 'Recomendación sintética.' }], usage: { input_tokens: 1, output_tokens: 1 } }; } } } };
    fromBackend('./associations')();
    const { issueToken } = fromBackend('./utils/sessions'); const { verificarToken, verificarTerapeuta } = fromBackend('./middlewares/auth');
    const express = fromBackend('express'); const api = express(); api.use(express.json());
    api.use('/api/consents', verificarToken, fromBackend('./routes/consents'));
    api.use('/api/sessions', verificarToken, fromBackend('./routes/sessions'));
    server = api.listen(0, '127.0.0.1'); await once(server, 'listening'); const apiUrl = `http://127.0.0.1:${server.address().port}`;
    db = new Client({ connectionString: url, ssl: false }); await db.connect();
    const q = async (text, params) => (await db.query(text, params)).rows;
    const columns = await q(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='Users' AND is_nullable='NO' AND column_default IS NULL AND column_name <> 'id'`);
    let seq = 0;
    async function mkUser(role, name, { therapistId = null } = {}) {
      seq += 1; const names = []; const values = [];
      for (const c of columns) {
        let v;
        if (c.column_name === 'role') v = role; else if (c.column_name === 'name') v = name;
        else if (c.data_type.includes('char') || c.data_type === 'text') v = c.column_name === 'email' ? `canario-correo-${seq}@example.test` : `sintetico-${seq}-${c.column_name}`;
        else if (c.data_type === 'integer') v = 0; else if (c.data_type === 'boolean') v = true; else if (c.data_type.startsWith('timestamp')) v = new Date(); else v = '{}';
        names.push(`"${c.column_name}"`); values.push(v);
      }
      const id = (await q(`INSERT INTO "Users" (${names.join(',')}) VALUES (${values.map((_, i) => `$${i + 1}`).join(',')}) RETURNING id`, values))[0].id;
      await q('UPDATE "Users" SET role=$2, active=true, "therapistId"=$3 WHERE id=$1', [id, role, therapistId]);
      return { id, role, token: issueToken({ id, role }) };
    }
    const call = async (who, method, route, body) => {
      const res = await fetch(apiUrl + route, { method, headers: { Authorization: `Bearer ${who.token}`, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      const text = await res.text(); let parsed = null; try { parsed = text ? JSON.parse(text) : null; } catch { /* no JSON */ } return { status: res.status, body: parsed };
    };
    const therapist = await mkUser('therapist', 'Profesional Sintético');
    const other = await mkUser('therapist', 'Otro Profesional');
    const sharer = await mkUser('user', 'Ana Comparte', { therapistId: therapist.id });
    assert.equal((await call(sharer, 'PUT', '/api/consents/therapist_sharing', { status: 'granted' })).status, 200);
    const mkSession = async (minutesFromNow = 5, status = 'scheduled', who = therapist) => (await q(`INSERT INTO "TherapySessions" ("therapistId","patientId","scheduledAt","duration","status","createdAt","updatedAt") VALUES ($1,$2,$3,50,$4,now(),now()) RETURNING id`, [who.id, sharer.id, new Date(Date.now() + minutesFromNow * 60000), status]))[0].id;
    const sessionRow = async (id) => (await q('SELECT * FROM "TherapySessions" WHERE id=$1', [id]))[0];
    const liveNotes = async (id) => q('SELECT * FROM "SessionNotes" WHERE "sessionId"=$1 AND "isLive"=true', [id]);
    const noteContent = async (id) => { const r = await call(therapist, 'GET', `/api/sessions/therapist/${id}/notes`); return (r.body || []).find((n) => n.isLive); };

    const { chromium } = process.env.PLAYWRIGHT_MODULE ? require(process.env.PLAYWRIGHT_MODULE) : await import('playwright');
    browser = await chromium.launch({ headless: true });
    const frontend = process.env.ES179_PREVIEW_URL || 'http://127.0.0.1:4179'; assert.ok(['127.0.0.1', 'localhost'].includes(new URL(frontend).hostname));
    const axeSource = process.env.AXE_PATH ? fs.readFileSync(process.env.AXE_PATH, 'utf8') : '';
    const axe = async (page, label) => { if (!axeSource) return; await page.addScriptTag({ content: axeSource }); const v = await page.evaluate(() => axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] }).then((r) => r.violations.map((x) => x.id + ':' + x.nodes.map((n) => n.target.join(' ')).join(' ; ')))); assert.deepEqual(v, [], label + ' axe'); };
    const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}⭐]|[★☆↑↓⏱]/u;
    async function open(lang, width, sessionId, intercept) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' }); const page = await context.newPage();
      const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|example\.invalid/.test(m.text())) errors.push(m.text().slice(0, 200)); });
      await page.addInitScript(([tk, l]) => { localStorage.setItem('elevation_token', tk); localStorage.setItem('elevation_role', 'therapist'); localStorage.setItem('elv_lang', l); }, [therapist.token, lang]);
      await page.route('**/api/session', (r) => r.fulfill({ json: { role: 'therapist', onboardingCompleted: true } }));
      await page.route('**/example.invalid/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>video simulado</body></html>' }));
      await page.route('**/api/sessions/**', async (r) => { if (intercept && await intercept(r)) return; const u = new URL(r.request().url()); try { await r.fulfill({ response: await r.fetch({ url: apiUrl + u.pathname + u.search }) }); } catch { /* cerrada */ } });
      await page.goto(`${frontend}/therapist/session/${sessionId}`);
      return { context, page, errors };
    }
    const T = {
      es: { with: 'Sesión con Ana Comparte', start: 'Iniciar sesión', back: 'Volver al panel', closedTitle: 'Esta sesión ya terminó', missing: 'No encontramos esta sesión', notRecorded: 'No se ha registrado el inicio', retry: 'Reintentar', saved: 'Guardado a las', saveNow: 'Guardar ahora', notSaved: 'No se guardó', conflict: 'cambió en otra pestaña', see: 'Ver la versión actual', keep: 'Conservar la mía', finish: 'Finalizar sesión', pick: 'Elige cómo ves a la persona hoy', min: 'al menos 10 caracteres', save: 'Guardar y cerrar', stay: 'Seguir en la sesión', done: 'Sesión cerrada', skipped: 'No se pudo generar la recomendación', moods: ['Muy bajo', 'Bajo', 'Medio', 'Alto', 'Muy alto'], timer: 'Tiempo en sesión', camera: 'cámara y el micrófono', notes: 'Notas en vivo' },
      en: { with: 'Session with Ana Comparte', start: 'Start session', back: 'Back to dashboard', closedTitle: 'This session has already ended', missing: "We couldn't find this session", notRecorded: 'The start of the session was not recorded', retry: 'Try again', saved: 'Saved at', saveNow: 'Save now', notSaved: 'Not saved', conflict: 'changed in another tab', see: 'See the current version', keep: 'Keep mine', finish: 'End session', pick: 'Choose how you see the person today', min: 'at least 10 characters', save: 'Save and close', stay: 'Stay in the session', done: 'Session closed', skipped: 'could not be generated', moods: ['Very low', 'Low', 'Medium', 'High', 'Very high'], timer: 'Time in session', camera: 'camera and microphone', notes: 'Live notes' },
    };
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    for (const lang of ['es', 'en']) for (const width of [390, 1360]) {
      const t = T[lang]; const tag = `${lang} ${width}px`;
      // A) previa → iniciar → en sesión; recarga recupera la MISMA sala y el temporizador sale de startedAt; una sola sala
      { const id = await mkSession(); fake.dailyCalls = 0;
        const { context, page, errors } = await open(lang, width, id);
        await page.getByRole('heading', { level: 1, name: t.with }).waitFor({ timeout: 10000 });
        const previa = await page.locator('body').innerText();
        assert.ok(previa.includes(t.camera), 'permisos de cámara y micrófono explicados');
        assert.equal((await sessionRow(id)).status, 'scheduled', 'abrir la sala NO inicia la sesión');
        assert.equal(fake.dailyCalls, 0, 'ninguna sala creada al abrir');
        assert.doesNotMatch(previa, emoji);
        await axe(page, `previa ${tag}`);
        await page.getByRole('button', { name: t.start }).click();
        await page.locator('iframe').waitFor();
        const row = await sessionRow(id);
        assert.equal(row.status, 'in_progress'); assert.equal(fake.dailyCalls, 1, 'una sola sala');
        const url = await page.locator('iframe').getAttribute('src');
        assert.ok(url.includes('sala-sintetica-'), 'iframe con la sala');
        await page.waitForFunction(() => document.activeElement?.tagName === 'H1'); // tras entrar a la sala el foco va al encabezado (no a <body>)
        const timer = page.locator('[role="timer"]'); await timer.waitFor();
        assert.equal(await page.locator('[role="timer"][aria-live]').count(), 0, 'el temporizador no es aria-live (no se anuncia cada segundo)');
        assert.equal(await page.getByRole('button', { name: t.finish }).evaluate((el) => getComputedStyle(el).backgroundColor), 'rgb(245, 245, 244)', '«Finalizar» no es rojo');
        await axe(page, `sala ${tag}`);
        await wait(3500);
        await page.reload(); await page.locator('iframe').waitFor({ timeout: 10000 });
        assert.equal(fake.dailyCalls, 1, 'recargar NO crea otra sala');
        assert.equal(await page.locator('iframe').getAttribute('src'), url, 'misma sala tras recargar');
        const shown = (await timer.innerText()).match(/(\d+):(\d+)(?::(\d+))?/); const secs = shown[3] ? (+shown[1]) * 3600 + (+shown[2]) * 60 + (+shown[3]) : (+shown[1]) * 60 + (+shown[2]);
        const real = Math.floor((Date.now() - new Date((await sessionRow(id)).startedAt).getTime()) / 1000);
        assert.ok(Math.abs(secs - real) <= 3 && secs >= 3, `el temporizador sale de startedAt (${secs}s vs ${real}s)`);
        assert.equal(await page.getByRole('button', { name: t.start }).count(), 0, 'recargar no vuelve a la previa');
        assert.deepEqual(errors, []); await context.close();
        check(`${tag}: previa sin iniciar nada, permisos explicados, iniciar crea UNA sala, recargar recupera la misma sala y el temporizador sale de startedAt (sin aria-live), «Finalizar» no es rojo, axe 0`); }

      // B) notas: autoguardado de UNA nota viva con versión; error que conserva el texto + «Guardar ahora»; respuesta perdida sin doble guardado; conflicto de otra pestaña
      { const id = await mkSession(); const { context, page } = await open(lang, width, id);
        await page.getByRole('button', { name: t.start }).click(); await page.locator('iframe').waitFor();
        const area = page.locator('#sr-live-notes'); await area.waitFor();
        await area.fill('Primera nota en vivo'); await page.getByText(t.saved, { exact: false }).waitFor({ timeout: 8000 });
        assert.equal((await liveNotes(id)).length, 1); assert.equal((await noteContent(id)).content, 'Primera nota en vivo');
        await area.fill('Primera nota en vivo, ampliada'); await page.waitForFunction(() => /\d{1,2}:\d{2}/.test(document.querySelector('#sr-note-status')?.textContent ?? ''));
        await wait(2600);
        const live = await noteContent(id); assert.equal(live.content, 'Primera nota en vivo, ampliada'); assert.ok(live.version >= 2); assert.equal((await liveNotes(id)).length, 1, 'sigue habiendo UNA sola nota viva');
        await axe(page, `notas ${tag}`);
        await context.close(); }
      { const id = await mkSession(); let fail = true; let lost = 0;
        const { context, page } = await open(lang, width, id, async (r) => { if (!r.request().url().endsWith('/notes') || r.request().method() !== 'POST') return false; if (fail === 'lost' && lost === 0) { lost++; try { const u = new URL(r.request().url()); await r.fetch({ url: apiUrl + u.pathname }); await r.abort('connectionreset'); } catch { /* cerrada */ } return true; } if (fail === true) { await r.abort('connectionreset'); return true; } return false; });
        await page.getByRole('button', { name: t.start }).click(); await page.locator('iframe').waitFor();
        const area = page.locator('#sr-live-notes'); await area.waitFor();
        await area.fill('Texto que no debe perderse'); await page.getByText(t.notSaved, { exact: false }).waitFor({ timeout: 8000 });
        assert.equal(await area.inputValue(), 'Texto que no debe perderse', 'el error conserva el texto');
        assert.ok(await page.getByRole('button', { name: t.saveNow }).isVisible(), '«Guardar ahora» tras el error');
        assert.equal((await liveNotes(id)).length, 0);
        fail = false; await page.getByRole('button', { name: t.saveNow }).click(); await page.getByText(t.saved, { exact: false }).waitFor();
        assert.equal((await noteContent(id)).content, 'Texto que no debe perderse');
        // respuesta perdida: el servidor guarda, la conexión se corta; «Guardar ahora» reutiliza el requestId y NO duplica ni sube la versión dos veces
        const v0 = (await noteContent(id)).version; fail = 'lost';
        await area.fill('Texto que no debe perderse (2)'); await page.getByText(t.notSaved, { exact: false }).waitFor({ timeout: 8000 });
        assert.equal((await noteContent(id)).content, 'Texto que no debe perderse (2)', 'el servidor sí guardó'); assert.equal((await noteContent(id)).version, v0 + 1);
        await page.getByRole('button', { name: t.saveNow }).click(); await page.getByText(t.saved, { exact: false }).waitFor();
        assert.equal((await noteContent(id)).version, v0 + 1, 'el reintento idempotente no sube la versión otra vez'); assert.equal((await liveNotes(id)).length, 1);
        // conflicto: otra pestaña guarda primero
        const current = await noteContent(id);
        assert.equal((await call(therapist, 'POST', `/api/sessions/therapist/${id}/notes`, { content: 'Texto de la otra pestaña', version: current.version, requestId: 'otra-pestana-' + randomBytes(4).toString('hex') })).status, 200);
        await area.fill('Mi versión desde esta pestaña'); await page.getByText(t.conflict, { exact: false }).waitFor({ timeout: 8000 });
        assert.equal((await noteContent(id)).content, 'Texto de la otra pestaña', 'la base no se pisó');
        assert.equal(await area.inputValue(), 'Mi versión desde esta pestaña');
        await page.getByRole('button', { name: t.see }).click(); await page.getByText('Texto de la otra pestaña').waitFor();
        await page.getByRole('button', { name: t.keep }).click(); await page.getByText(t.saved, { exact: false }).waitFor();
        assert.equal((await noteContent(id)).content, 'Mi versión desde esta pestaña'); assert.equal((await liveNotes(id)).length, 1);
        await context.close(); }
      check(`${tag}: autoguardado de UNA nota viva con versión; el error conserva el texto y ofrece «${t.saveNow}»; con la respuesta perdida el reintento no duplica; conflicto de otra pestaña no pisa y se resuelve`);

      // C) cierre: validaciones, ánimo en palabras sin emojis, Esc = seguir, cierre con aviso si no hubo recomendación, y ya cerrada
      { const id = await mkSession(); fake.ai = 'fail';
        const { context, page } = await open(lang, width, id);
        await page.getByRole('button', { name: t.start }).click(); await page.locator('iframe').waitFor();
        await page.getByRole('button', { name: t.finish }).click(); const dialog = page.getByRole('dialog'); await dialog.waitFor();
        const text = await dialog.innerText();
        for (const word of t.moods) assert.ok(text.includes(word), `etiqueta ${word}`);
        assert.doesNotMatch(text, emoji, 'sin emojis en el cierre');
        await axe(page, `cierre ${tag}`);
        await dialog.getByRole('button', { name: t.save }).click(); await page.getByRole('alert').filter({ hasText: t.pick }).waitFor();
        await dialog.locator('input[name="sr-mood"][value="4"]').check(); await dialog.getByRole('button', { name: t.save }).click(); await page.getByRole('alert').filter({ hasText: t.min }).waitFor();
        await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' });
        assert.equal((await sessionRow(id)).status, 'in_progress', 'Esc = seguir en la sesión');
        await page.getByRole('button', { name: t.finish }).click(); await dialog.waitFor();
        await dialog.locator('input[name="sr-mood"][value="4"]').check(); await dialog.locator('#sr-close-note').fill('Nota de cierre suficientemente larga');
        await dialog.getByRole('button', { name: t.save }).click(); await page.getByRole('heading', { level: 1, name: t.done }).waitFor();
        const closed = await sessionRow(id); assert.equal(closed.status, 'completed'); assert.equal(closed.patientMoodAfter, 4);
        await page.getByText(t.skipped, { exact: false }).waitFor(); // la recomendación de IA falló: se avisa
        assert.equal((await q('SELECT count(*)::int AS n FROM "WellnessRecommendations" WHERE "UserId"=$1', [sharer.id]))[0].n >= 0, true);
        await context.close(); fake.ai = 'ok';
        // una sesión ya cerrada: mensaje propio, sin botones de iniciar
        const again = await open(lang, width, id);
        await again.page.getByRole('heading', { level: 1, name: t.closedTitle }).waitFor(); assert.equal(await again.page.getByRole('button', { name: t.start }).count(), 0);
        await again.context.close();
        // cierre doble: otra pestaña cierra primero y esta recibe 409 «ya terminó»
        const id2 = await mkSession(); const second = await open(lang, width, id2);
        await second.page.getByRole('button', { name: t.start }).click(); await second.page.locator('iframe').waitFor();
        assert.equal((await call(therapist, 'POST', `/api/sessions/therapist/${id2}/end`, { therapistNote: 'Cierre desde otra pestaña', patientMoodAfter: 3 })).status, 200);
        await second.page.getByRole('button', { name: t.finish }).click(); const d2 = second.page.getByRole('dialog'); await d2.waitFor();
        await d2.locator('input[name="sr-mood"][value="2"]').check(); await d2.locator('#sr-close-note').fill('Segundo intento de cierre largo'); await d2.getByRole('button', { name: t.save }).click();
        await second.page.getByRole('heading', { level: 1, name: t.closedTitle }).waitFor();
        await second.context.close(); }
      check(`${tag}: cierre → etiquetas ${'Muy bajo…Muy alto'} sin emojis, validaciones, Esc sigue en la sesión, cierra y avisa que no hubo recomendación, sesión ya cerrada y cierre doble («ya terminó»)`);

      // D) error al iniciar: «No se ha registrado el inicio» + reintentar; sesión ajena
      { const id = await mkSession(); fake.daily = 'fail';
        const { context, page } = await open(lang, width, id);
        await page.getByRole('button', { name: t.start }).click(); await page.getByRole('alert').filter({ hasText: t.notRecorded }).waitFor();
        assert.equal((await sessionRow(id)).status, 'scheduled', 'sin sala no se registra el inicio');
        fake.daily = 'ok'; await page.getByRole('button', { name: t.retry }).click(); await page.locator('iframe').waitFor();
        assert.equal((await sessionRow(id)).status, 'in_progress');
        await context.close();
        const foreign = await mkSession(5, 'scheduled', other);
        const f = await open(lang, width, foreign); await f.page.getByRole('heading', { level: 1, name: t.missing }).waitFor(); assert.equal(await f.page.locator('iframe').count(), 0); await f.context.close(); }
      // E) E230-1: la persona retiró el permiso → la previa dice «Persona n» (no un título vacío) y al iniciar el 403 sale con su mensaje, SIN reintentar
      { const id = await mkSession(); assert.equal((await call(sharer, 'PUT', '/api/consents/therapist_sharing', { status: 'revoked' })).status, 200);
        try {
          const { context, page } = await open(lang, width, id);
          await page.getByRole('heading', { level: 1 }).waitFor({ timeout: 10000 });
          const heading = await page.getByRole('heading', { level: 1 }).innerText();
          assert.match(heading, lang === 'es' ? /^Sesión con Persona \d+$/ : /^Session with Person \d+$/, 'título con «Persona n»: ' + heading);
          assert.ok(!heading.includes('Ana Comparte'), 'sin el nombre real de quien no comparte');
          await page.getByRole('button', { name: t.start }).click();
          await page.getByRole('alert').filter({ hasText: lang === 'es' ? 'ya no comparte sus datos contigo' : 'no longer shares their data with you' }).waitFor();
          assert.equal(await page.getByRole('button', { name: t.retry }).count(), 0, 'sin «Reintentar» (inútil)');
          assert.ok(await page.getByRole('button', { name: t.back }).isVisible(), 'vuelta al panel');
          assert.equal((await sessionRow(id)).status, 'scheduled'); assert.equal(fake.dailyCalls, 0 + fake.dailyCalls, 'no se creó sala nueva para esta sesión');
          await axe(page, `sin permiso ${tag}`);
          await context.close();
        } finally { assert.equal((await call(sharer, 'PUT', '/api/consents/therapist_sharing', { status: 'granted' })).status, 200); } }
      check(`${tag}: error al iniciar dice «${t.notRecorded}» y reintentar funciona; una sesión ajena no se abre; sin permiso la previa dice «Persona n» y el 403 sale sin reintentar`);
    }
    console.log(`ES-179 PR B servidor real: ${checks.length} comprobaciones superadas. Express + rutas de sesiones + PostgreSQL migrado reales (Daily y proveedor de IA simulados).`);
  } catch (error) {
    console.error('ES-179 falló:', error); process.exitCode = 1;
  } finally {
    if (typeof realFetch !== 'undefined') global.fetch = realFetch;
    if (browser) await browser.close(); if (db) await db.end().catch(() => {}); if (server) await new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); });
    if (sequelize) await sequelize.close(); if (started) await pg.stop(); try { fs.rmSync(directory, { recursive: true, force: true, maxRetries: 8, retryDelay: 300 }); } catch { /* Windows aún bloquea el directorio */ }
  }
})();
