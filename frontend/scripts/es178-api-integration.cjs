// ES-178 (F1): ficha de la persona (/therapist/patient/:id) con el servidor REAL (Express + rutas del profesional + consentimientos + modelos + PostgreSQL embebido migrado) y la pantalla construida en Chromium.
// Se comparan las cifras de la pantalla con la base; se prueba el 403 sin autorización (cero datos), las notas (crear, filtrar, límites por código), el conflicto de edición 409 (la base no se pisa),
// la respuesta perdida, que Esc no pierde lo escrito, sin emojis/estrellas/flechas, axe 0 y ES/EN × 390/1360. Datos sintéticos, base efímera en 127.0.0.1, sin IA ni producción.
// Uso:  (cd frontend && npx vite build && npx vite preview --host 127.0.0.1 --port 4178 --strictPort)
//       ES178_BACKEND_DIR=<backend> ES178_PREVIEW_URL=http://127.0.0.1:4178 PLAYWRIGHT_MODULE=<playwright> AXE_PATH=<axe.min.js> node scripts/es178-api-integration.cjs
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
  assert.ok(process.env.ES178_BACKEND_DIR, 'Se necesita el directorio del backend');
  const backend = path.resolve(process.env.ES178_BACKEND_DIR);
  const fromBackend = createRequire(path.join(backend, 'package.json'));
  const { default: EmbeddedPostgres } = await import(pathToFileURL(fromBackend.resolve('embedded-postgres')).href);
  const parent = path.resolve(os.tmpdir()); const directory = fs.mkdtempSync(path.join(parent, 'es178-pg-'));
  const probe = net.createServer();
  const port = await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', () => { const p = probe.address().port; probe.close(() => resolve(p)); }); });
  const password = randomBytes(24).toString('hex');
  const pg = new EmbeddedPostgres({ databaseDir: directory, user: 'es178_test', password, port, persistent: false, initdbFlags: ['--encoding=UTF8', '--locale=C'], postgresFlags: ['-h', '127.0.0.1'], onLog: () => {}, onError: () => {} });
  let started = false; let sequelize; let server; let browser; let db; const checks = []; const check = label => { checks.push(label); console.log('PASS ' + label); };
  try {
    await pg.initialise(); await pg.start(); started = true;
    const url = `postgres://es178_test:${password}@127.0.0.1:${port}/postgres`;
    const migrated = spawnSync('npx', ['sequelize-cli', 'db:migrate'], { cwd: backend, encoding: 'utf8', shell: process.platform === 'win32', env: { ...process.env, DATABASE_URL: url, DB_SSL: 'false', NODE_ENV: 'test' } });
    assert.equal(migrated.status, 0, 'Fallaron las migraciones: ' + (migrated.stdout + migrated.stderr).slice(-500));
    const { Sequelize } = fromBackend('sequelize'); const { Client } = fromBackend('pg');
    sequelize = new Sequelize(url, { logging: false, dialectOptions: { ssl: false }, pool: { max: 8, min: 0 } });
    process.env.JWT_SECRET = randomBytes(32).toString('hex'); process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString('hex'); process.env.NODE_ENV = 'test'; process.env.AI_BUDGET_TOKENS_PER_USER = '1000000000'; process.env.AI_BUDGET_PERIOD = 'month';
    const dbId = fromBackend.resolve('./database'); require.cache[dbId] = { id: dbId, filename: dbId, loaded: true, exports: { sequelize } };
    const anthropicId = fromBackend.resolve('./utils/anthropic'); require.cache[anthropicId] = { id: anthropicId, filename: anthropicId, loaded: true, exports: { MODEL: 'sintetico', messages: { create: async () => ({ content: [{ type: 'text', text: 'Resumen sintético.' }], usage: { input_tokens: 1, output_tokens: 1 } }) } } };
    fromBackend('./associations')();
    const { issueToken } = fromBackend('./utils/sessions'); const { verificarToken, verificarTerapeuta } = fromBackend('./middlewares/auth');
    const express = fromBackend('express'); const api = express(); api.use(express.json());
    api.use('/api/consents', verificarToken, fromBackend('./routes/consents'));
    api.use('/api/therapist', verificarTerapeuta, fromBackend('./routes/therapistRoutes'));
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
    const sharer = await mkUser('user', 'Ana Comparte', { therapistId: therapist.id });
    const hidden = await mkUser('user', 'Secreto Nombre Oculto', { therapistId: therapist.id });
    assert.equal((await call(sharer, 'PUT', '/api/consents/therapist_sharing', { status: 'granted' })).status, 200);
    const day = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
    for (let n = 0; n < 62; n += 1) await q(`INSERT INTO "MoodLogs" ("UserId","checkin_mood","checkout_mood","date","createdAt","updatedAt") VALUES ($1,$2,$3,$4,now(),now())`, [sharer.id, n % 5 === 0 ? null : 1 + (n % 5), n % 7 === 0 ? null : 1 + ((n + 2) % 5), day(n)]);
    for (const [n, r] of [[0, 4], [1, null], [2, 4], [3, null], [4, 5]]) await q(`INSERT INTO "SessionRatings" ("UserId","rating","date","createdAt","updatedAt") VALUES ($1,$2,$3,now(),now())`, [sharer.id, r, day(n)]);
    await q(`INSERT INTO "MoodLogs" ("UserId","checkin_mood","checkout_mood","date","createdAt","updatedAt") VALUES ($1,5,5,$2,now(),now())`, [hidden.id, day(0)]);
    const mkNote = async (content, type = 'session_note', offset = 0) => (await call(therapist, 'POST', `/api/therapist/pacientes/${sharer.id}/notas`, { content, type, sessionDate: day(offset) })).body.note;
    const n1 = await mkNote('Primera nota <script>alert(1)</script> sintética', 'session_note', 1); await mkNote('Observación sintética', 'observation', 2);
    const noteRow = async (id) => (await q('SELECT * FROM "ClinicalNotes" WHERE id=$1', [id]))[0];
    const noteText = async (id) => { const r = await call(therapist, 'GET', `/api/therapist/pacientes/${sharer.id}/historia`); return r.body.notes.find((n) => n.id === id)?.content; };

    const { chromium } = process.env.PLAYWRIGHT_MODULE ? require(process.env.PLAYWRIGHT_MODULE) : await import('playwright');
    browser = await chromium.launch({ headless: true });
    const frontend = process.env.ES178_PREVIEW_URL || 'http://127.0.0.1:4178'; assert.ok(['127.0.0.1', 'localhost'].includes(new URL(frontend).hostname));
    const axeSource = process.env.AXE_PATH ? fs.readFileSync(process.env.AXE_PATH, 'utf8') : '';
    const axe = async (page, label) => { if (!axeSource) return; await page.addScriptTag({ content: axeSource }); const v = await page.evaluate(() => axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] }).then((r) => r.violations.map((x) => x.id + ':' + x.nodes.map((n) => n.target.join(' ')).join(' ; ')))); assert.deepEqual(v, [], label + ' axe'); };
    const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}⭐]|[★☆↑↓]/u;
    async function open(lang, width, personId, intercept, opts = {}) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', timezoneId: opts.timezone }); const page = await context.newPage();
      if (opts.now) await page.clock.setFixedTime(opts.now);
      const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 200)); });
      await page.addInitScript(([t, l]) => { localStorage.setItem('elevation_token', t); localStorage.setItem('elevation_role', 'therapist'); localStorage.setItem('elv_lang', l); }, [therapist.token, lang]);
      await page.route('**/api/session', (r) => r.fulfill({ json: { role: 'therapist', onboardingCompleted: true } }));
      await page.route('**/api/therapist/**', async (r) => { if (intercept && await intercept(r)) return; const u = new URL(r.request().url()); try { const response = await r.fetch({ url: apiUrl + u.pathname + u.search }); await r.fulfill({ response }); } catch { /* cerrada */ } });
      await page.route('**/api/sessions/**', async (r) => { if (intercept && await intercept(r)) return; const u = new URL(r.request().url()); try { await r.fulfill({ response: await r.fetch({ url: apiUrl + u.pathname + u.search }) }); } catch { /* cerrada */ } });
      await page.route('**/api/consents**', async (r) => { const u = new URL(r.request().url()); try { await r.fulfill({ response: await r.fetch({ url: apiUrl + u.pathname + u.search }) }); } catch { /* cerrada */ } });
      await page.goto(`${frontend}/therapist/patient/${personId}`);
      return { context, page, errors };
    }
    const T = {
      es: { notes: 'Notas de seguimiento', new: 'Nueva nota', edit: 'Editar', save: 'Guardar', saved: 'Nota guardada.', empty: 'No hay notas de este tipo.', required: 'El texto de la nota es obligatorio', long: 'supera el máximo', changed: 'La nota cambió mientras la editabas', see: 'Ver la versión actual', keep: 'Conservar la mía', noData: 'Sin datos', notShared: 'no ha autorizado compartir', history: 'Historial emocional', cap: 'Últimos 60 registros', ratings: 'Valoraciones de sesiones', filter: 'Tipo', obs: 'Observación', goal: 'Objetivo',
        aiGen: 'Generar resumen', aiRegen: 'Volver a generar', aiRetry: 'Reintentar', aiLabel: 'No incluye tus notas', aiBudget: 'límite de uso de IA', schOpen: 'Agendar sesión', schDone: 'Sesión agendada', schConfirm: 'Agendar', schConflict: 'Ya tienes una sesión en ese horario', schPast: 'deben ser futuras', schCancel: 'Cancelar' },
      en: { notes: 'Follow-up notes', new: 'New note', edit: 'Edit', save: 'Save', saved: 'Note saved.', empty: 'No notes of this type.', required: 'The note text is required', long: 'exceeds the maximum', changed: 'The note changed while you were editing it', see: 'See the current version', keep: 'Keep mine', noData: 'No data', notShared: 'not authorized sharing|no longer|has not authorized', history: 'Emotional history', cap: 'Last 60 entries', ratings: 'Session ratings', filter: 'Type', obs: 'Observation', goal: 'Goal',
        aiGen: 'Generate summary', aiRegen: 'Generate again', aiRetry: 'Try again', aiLabel: 'does not include your notes', aiBudget: 'usage limit', schOpen: 'Schedule session', schDone: 'Session scheduled', schConfirm: 'Schedule', schConflict: 'You already have a session at that time', schPast: 'must be in the future', schCancel: 'Cancel' },
    };
    // valores esperados, calculados DE LA BASE con una regla independiente (solo valores válidos 1-5)
    const moodRows = await q('SELECT * FROM "MoodLogs" WHERE "UserId"=$1 ORDER BY date DESC LIMIT 60', [sharer.id]);
    const ratingRows = await q('SELECT * FROM "SessionRatings" WHERE "UserId"=$1 ORDER BY date DESC LIMIT 60', [sharer.id]);
    const mean = (xs) => { const v = xs.filter((x) => x >= 1 && x <= 5); return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null; };
    const expectedMood = mean(moodRows.flatMap((r) => [r.checkin_mood, r.checkout_mood]).filter((x) => x !== null)); const expectedRating = mean(ratingRows.map((r) => r.rating).filter((x) => x !== null));

    for (const lang of ['es', 'en']) for (const width of [390, 1360]) {
      const t = T[lang]; const tag = `${lang} ${width}px`;
      assert.equal((await call(therapist, 'PUT', `/api/therapist/notas/${n1.id}`, { content: 'Primera nota <script>alert(1)</script> sintética' })).status, 200); const fmt = (n) => n.toLocaleString(lang === 'es' ? 'es-CO' : 'en-US', { maximumFractionDigits: 1 });
      // A) ficha: cifras = base, sin emojis/estrellas/flechas, historial en palabras, tope de 60, axe, sin desborde
      { const { context, page, errors } = await open(lang, width, sharer.id);
        await page.getByRole('heading', { level: 2, name: t.notes }).waitFor({ timeout: 10000 });
        const main = await page.locator('main, body').first().innerText();
        assert.ok(main.includes('Ana Comparte'), 'nombre real de quien comparte en el encabezado');
        assert.ok(lang === 'es' ? main.includes(`${fmt(expectedMood)} de 5`) && main.includes(`${fmt(expectedRating)} de 5`) : main.includes(`${fmt(expectedMood)} of 5`) && main.includes(`${fmt(expectedRating)} of 5`), `cifras de la base: ánimo ${expectedMood}, valoración ${expectedRating} (${tag})`);
        assert.ok(expectedRating === 4.3, 'la calificación nula no cuenta como 0: (4+4+5)/3 = 4,3');
                const f1 = await page.locator('section[aria-label], section[aria-labelledby^="fu-"]').evaluateAll((els) => els.map((e) => e.innerText).join(' | ')); // bloques de F1; el resumen con IA y agendar (F2) conservan su interfaz
        assert.doesNotMatch(f1, emoji, `sin emojis/estrellas/flechas en los bloques de F1 (${tag})`);
        assert.ok(main.includes(t.cap), 'aviso de los últimos 60 registros');
        assert.ok(lang === 'es' ? /subió|bajó|igual/.test(main) : /went up|went down|same/.test(main), 'cambio de ánimo en palabras');
        assert.equal(await page.locator('section[aria-labelledby="fu-history-title"] li').count(), 60, '60 filas de historial');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0, 'sin desborde');
        await axe(page, `ficha ${tag}`);
        assert.deepEqual(errors, []); await context.close();
        check(`${tag}: ficha → nombre real, cifras = base (ánimo ${expectedMood}, valoración ${expectedRating} con NULL fuera), sin emojis/estrellas/flechas, historial en palabras con tope de 60, sin desborde, axe 0`); }

      // A2) E226-2: con el tope de 60 alcanzado, las cifras lo dicen junto al número (sin inventar un total) — la base tiene 62 registros
      { const { context, page } = await open(lang, width, sharer.id);
        await page.getByRole('heading', { level: 2, name: t.notes }).waitFor({ timeout: 10000 });
        const figures = await page.locator('section[aria-label]').first().innerText();
        assert.ok(lang === 'es' ? figures.includes('Registros de ánimo (últimos 60)') && figures.includes('Ánimo promedio de los últimos 60 registros') : figures.includes('Mood entries (last 60)') && figures.includes('Average mood of the last 60 entries'), 'etiquetas con el tope: ' + figures);
        assert.ok(figures.includes('60') && !figures.includes('62'), 'muestra 60, no inventa un total');
        assert.equal((await q('SELECT count(*)::int AS n FROM "MoodLogs" WHERE "UserId"=$1', [sharer.id]))[0].n, 62);
        await context.close(); }

      // A3) E226-1: la fecha propuesta de una nota nueva es HOY en calendario local (Bogotá 20:00 del 10-nov; Auckland 09:00 del 11-nov)
      for (const [timezone, now, expected] of [['America/Bogota', '2026-11-11T01:00:00Z', '2026-11-10'], ['Pacific/Auckland', '2026-11-10T20:00:00Z', '2026-11-11']]) {
        const { context, page } = await open(lang, width, sharer.id, undefined, { timezone, now });
        await page.getByRole('heading', { level: 2, name: t.notes }).waitFor({ timeout: 10000 });
        await page.getByRole('button', { name: t.new }).click(); await page.getByRole('dialog').waitFor();
        assert.equal(await page.locator('input[type=date]').inputValue(), expected, `fecha propuesta en ${timezone}`);
        assert.equal(await page.locator('input[type=date]').getAttribute('max'), expected, `máximo del campo en ${timezone}`);
        await context.close();
      }
      check(`${tag}: con 62 registros en la base la ficha dice «últimos 60» junto a las cifras; la fecha de una nota nueva es HOY local en Bogotá y en Auckland`);

      // B) sin autorización: pantalla propia, cero datos de la persona
      { const { context, page } = await open(lang, width, hidden.id);
        await page.getByText(new RegExp(t.notShared, 'i')).first().waitFor({ timeout: 10000 });
        const body = await page.locator('body').innerText();
        assert.ok(!body.includes('Secreto Nombre Oculto') && !body.includes('canario-correo'), 'ni el nombre ni el correo de quien no comparte');
        assert.equal(await page.getByRole('heading', { level: 2, name: t.notes }).count(), 0, 'sin notas ni cifras');
        await context.close();
        check(`${tag}: sin autorización → pantalla propia sin nombre, correo ni cifras`); }

      // C) notas: crear, límites por código, tipo y filtro, XSS como texto
      { const { context, page } = await open(lang, width, sharer.id);
        await page.getByRole('heading', { level: 2, name: t.notes }).waitFor({ timeout: 10000 });
        assert.ok((await page.locator('section[aria-labelledby="fu-notes-title"]').innerText()).includes('<script>alert(1)</script>'), 'XSS se ve como texto');
        await page.getByRole('button', { name: t.new }).click(); await page.getByRole('dialog').waitFor();
        await page.getByRole('button', { name: t.save }).click(); await page.getByRole('alert').filter({ hasText: t.required }).waitFor();
        await page.locator('#fu-text').fill('x'.repeat(10001)); await page.getByRole('button', { name: t.save }).click(); await page.getByRole('alert').filter({ hasText: t.long }).waitFor();
        assert.equal((await q('SELECT count(*)::int AS n FROM "ClinicalNotes" WHERE "UserId"=$1', [sharer.id]))[0].n >= 2, true);
        const unique = `Nota de ${tag} ${randomBytes(3).toString('hex')}`; await page.locator('#fu-text').fill(unique); await page.getByRole('button', { name: t.save }).click();
        await page.getByText(t.saved).waitFor(); await page.getByRole('dialog').waitFor({ state: 'detached' });
        assert.ok(await page.locator('section[aria-labelledby="fu-notes-title"]').getByText(unique).isVisible());
        assert.equal((await q('SELECT count(*)::int AS n FROM "ClinicalNotes" WHERE "UserId"=$1', [sharer.id]))[0].n >= 3, true);
        await page.locator('section[aria-labelledby="fu-notes-title"] select').first().selectOption('goal');
        await page.getByText(t.empty).waitFor();
        await context.close();
        check(`${tag}: notas → vacío y 10.001 caracteres por código, se guarda y aparece, filtro por tipo con su vacío, HTML como texto`); }

      // D) conflicto: otra sesión edita la misma nota; la base no se pisa
      { const { context, page, errors } = await open(lang, width, sharer.id);
        await page.getByRole('heading', { level: 2, name: t.notes }).waitFor({ timeout: 10000 });
        const row = page.locator('section[aria-labelledby="fu-notes-title"] li', { hasText: 'Primera nota' }); await row.getByRole('button', { name: new RegExp('^' + t.edit) }).click(); await page.getByRole('dialog').waitFor();
        await page.locator('#fu-text').fill('Mi versión de la nota'); // la otra sesión guarda primero (con la versión vigente)
        const current = (await call(therapist, 'GET', `/api/therapist/pacientes/${sharer.id}/historia`)).body.notes.find((n) => n.id === n1.id);
        assert.equal((await call(therapist, 'PUT', `/api/therapist/notas/${n1.id}`, { content: 'Su versión de la nota', expectedUpdatedAt: current.updatedAt })).status, 200);
        await page.getByRole('button', { name: t.save }).click(); await page.getByRole('alert').filter({ hasText: t.changed }).waitFor();
        assert.equal(await noteText(n1.id), 'Su versión de la nota', 'la base NO se pisó');
        assert.equal(await page.locator('#fu-text').inputValue(), 'Mi versión de la nota', 'lo escrito se conserva');
        await page.getByRole('button', { name: t.see }).click(); assert.ok((await page.getByRole('dialog').innerText()).includes('Su versión de la nota'));
        await axe(page, `conflicto ${tag}`);
        await page.getByRole('button', { name: t.keep }).click(); await page.getByRole('button', { name: t.save }).click(); await page.getByText(t.saved).waitFor();
        assert.equal(await noteText(n1.id), 'Mi versión de la nota', 'tras decidirlo, se guarda lo mío');
        assert.deepEqual(errors, []); await context.close();
        check(`${tag}: conflicto 409 → la base no se pisa, lo escrito se conserva, «${t.see}», «${t.keep}» y luego guarda`); }
      await q('UPDATE "ClinicalNotes" SET "updatedAt" = now() WHERE id=$1', [n1.id]);

      // E) respuesta perdida: el servidor guarda y la conexión se corta → se relee y dice «guardada»; Esc no pierde lo escrito
      { let dropped = 0;
        const { context, page } = await open(lang, width, sharer.id, async (r) => { if (r.request().method() !== 'PUT' || dropped > 0) return false; dropped++; try { const u = new URL(r.request().url()); await r.fetch({ url: apiUrl + u.pathname }); await r.abort('connectionreset'); } catch { /* cerrada */ } return true; });
        await page.getByRole('heading', { level: 2, name: t.notes }).waitFor({ timeout: 10000 });
        const row = page.locator('section[aria-labelledby="fu-notes-title"] li', { hasText: 'Mi versión de la nota' }); await row.getByRole('button', { name: new RegExp('^' + t.edit) }).click(); await page.getByRole('dialog').waitFor();
        await page.locator('#fu-text').fill('Borrador que sobrevive a Esc'); await page.keyboard.press('Escape'); await page.getByRole('dialog').waitFor({ state: 'detached' });
        await row.getByRole('button', { name: new RegExp('^' + t.edit) }).click(); await page.getByRole('dialog').waitFor();
        assert.equal(await page.locator('#fu-text').inputValue(), 'Borrador que sobrevive a Esc', 'Esc no pierde lo escrito');
        await page.getByRole('button', { name: t.save }).click(); await page.getByText(t.saved).waitFor();
        assert.equal(dropped, 1); assert.equal(await noteText(n1.id), 'Borrador que sobrevive a Esc', 'el servidor sí guardó');
        await context.close();
        check(`${tag}: Esc conserva el borrador; con la respuesta perdida se relee y dice «${t.saved}»`); }
      await q('UPDATE "ClinicalNotes" SET "updatedAt" = now() WHERE id=$1', [n1.id]);

      // F) resumen con IA: etiqueta con fecha y n sin «y n notas»; límite de IA sin reintento; error con reintento
      { const { context, page } = await open(lang, width, sharer.id);
        await page.getByRole('heading', { level: 2, name: lang === 'es' ? 'Resumen con IA' : 'AI summary' }).waitFor({ timeout: 10000 });
        await page.getByRole('button', { name: t.aiGen }).click();
        const section = page.locator('section[aria-labelledby="fu-ai-title"]');
        await section.getByText('Resumen sintético.').waitFor();
        await page.waitForFunction(() => document.activeElement?.id === 'fu-ai-button'); // E227-1: tras generar con éxito el foco sigue en el botón (no en <main>)
        const text = await section.innerText();
        assert.ok(new RegExp(t.aiLabel, 'i').test(text) && /60/.test(text) === false, 'etiqueta «No incluye tus notas»: ' + text);
        assert.doesNotMatch(text, /y \d+ notas|and \d+ notes/i, 'nunca «y n notas»');
        assert.ok(new RegExp('\\b62\\b|\\b60\\b').test(text) === true || /\d+ (registros|mood entries)/.test(text), 'n de registros en la etiqueta');
        assert.doesNotMatch(text.replace(/\d{1,2} \w+\.? \d{4}/g, ''), emoji, 'sin emojis');
        assert.ok(await page.getByRole('button', { name: t.aiRegen }).isVisible());
        await axe(page, `resumen ${tag}`);
        await context.close(); }
      { let calls = 0;
        const { context, page } = await open(lang, width, sharer.id, async (r) => { if (!r.request().url().includes('/resumen-ia')) return false; calls++; await r.fulfill({ status: 429, json: { code: 'ai_budget_exhausted', retryable: false, resetsAt: '2026-12-01T00:00:00.000Z' } }); return true; });
        await page.locator('#fu-ai-button').waitFor({ timeout: 10000 });
        await page.locator('#fu-ai-button').click(); const alert = page.getByRole('alert').filter({ hasText: new RegExp(t.aiBudget, 'i') }); await alert.waitFor();
        const budgetText = await alert.first().innerText();
        assert.ok(/UTC/.test(budgetText) && /(1 (de )?dic|Dec 1|1 Dec)/i.test(budgetText) && /00:00/.test(budgetText), 'fecha de reinicio con zona explícita: ' + budgetText); // E227 (a)
        assert.equal(await page.getByRole('button', { name: t.aiRetry }).count(), 0, 'el límite de IA no se reintenta');
        assert.equal(await page.locator('#fu-ai-button').getAttribute('aria-disabled'), 'true', '«Generar» con aria-disabled tras el límite'); // E227 (b)
        assert.equal(await page.locator('#fu-ai-button').getAttribute('aria-describedby'), 'fu-ai-problem');
        await page.waitForFunction(() => document.activeElement?.id === 'fu-ai-button'); // el foco no se pierde
        await page.locator('#fu-ai-button').click({ force: true }); await page.waitForTimeout(300);
        assert.equal(calls, 1, 'con el límite alcanzado no se vuelve a llamar al servidor');
        await context.close(); }
      { let calls = 0;
        const { context, page } = await open(lang, width, sharer.id, async (r) => { if (!r.request().url().includes('/resumen-ia')) return false; calls++; if (calls === 1) { await r.fulfill({ status: 502, json: { code: 'provider_unavailable', retryable: true } }); return true; } return false; });
        await page.locator('#fu-ai-button').waitFor({ timeout: 10000 });
        await page.locator('#fu-ai-button').click(); await page.getByRole('button', { name: t.aiRetry }).waitFor();
        await page.waitForFunction(() => document.activeElement?.id === 'fu-ai-retry'); // E227-1: tras un fallo el foco va a «Reintentar» (no a <body>)
        await page.getByRole('button', { name: t.aiRetry }).click(); await page.locator('section[aria-labelledby="fu-ai-title"]').getByText('Resumen sintético.').waitFor();
        await page.waitForFunction(() => document.activeElement?.id === 'fu-ai-button'); // y tras recuperar, al botón
        await context.close(); }
      { // E227-2: si la persona ya movió el foco a otro control mientras se genera, el foco NO se le quita; el resultado se anuncia en un role=status
        const { context, page } = await open(lang, width, sharer.id, async (r) => { if (!r.request().url().includes('/resumen-ia')) return false; await new Promise((resolve) => setTimeout(resolve, 1500)); return false; });
        await page.locator('#fu-ai-button').waitFor({ timeout: 10000 });
        await page.locator('#fu-ai-button').click(); await page.waitForTimeout(300);
        await page.getByRole('button', { name: t.schOpen }).focus();
        await page.locator('section[aria-labelledby="fu-ai-title"]').getByText('Resumen sintético.').waitFor({ timeout: 10000 });
        await page.waitForTimeout(300);
        const focused = await page.evaluate(() => (document.activeElement?.textContent ?? '').trim());
        assert.equal(focused, t.schOpen, 'el foco sigue en «Agendar sesión» (no vuelve al botón del resumen): ' + focused);
        assert.ok((await page.locator('section[aria-labelledby="fu-ai-title"] [role="status"]').innerText()).trim().length > 0, 'el resultado se anuncia en un role=status');
        await context.close(); }
      check(`${tag}: resumen con IA → etiqueta sin «y n notas», límite de IA sin reintento, error con reintento que recupera, foco que no se roba (E227-2)`);

      // G) agendar: éxito, choque y fecha pasada por campo con foco, Esc devuelve el foco, respuesta perdida sin duplicar
      { const slot = (k) => { const d = new Date(Date.now() + (3 + k + (lang === 'en' ? 40 : 0) + (width === 1360 ? 20 : 0)) * 86400000); d.setHours(10, 0, 0, 0); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
        const { context, page } = await open(lang, width, sharer.id);
        await page.getByRole('button', { name: t.schOpen }).waitFor({ timeout: 10000 });
        const sessions = async () => (await q('SELECT count(*)::int AS n FROM "TherapySessions" WHERE "patientId"=$1', [sharer.id]))[0].n;
        const before = await sessions();
        await page.getByRole('button', { name: t.schOpen }).click(); await page.getByRole('dialog').waitFor();
        await page.keyboard.press('Escape'); await page.getByRole('dialog').waitFor({ state: 'detached' });
        await page.waitForFunction((name) => document.activeElement?.textContent === name, t.schOpen);
        await page.getByRole('button', { name: t.schOpen }).click(); await page.getByRole('dialog').waitFor();
        await page.locator('#fu-sch-when').fill('2020-01-01T10:00'); await page.getByRole('dialog').getByRole('button', { name: t.schConfirm, exact: true }).click();
        await page.locator('#fu-sch-when-error').filter({ hasText: new RegExp(t.schPast, 'i') }).waitFor();
        await page.waitForFunction(() => document.activeElement?.id === 'fu-sch-when');
        assert.equal(await sessions(), before, 'una fecha pasada no crea nada');
        await page.locator('#fu-sch-when').fill(slot(0)); await page.getByRole('dialog').getByRole('button', { name: t.schConfirm, exact: true }).click();
        await page.getByText(t.schDone).first().waitFor(); assert.equal(await sessions(), before + 1);
        await page.getByRole('button', { name: t.schOpen }).click(); await page.getByRole('dialog').waitFor();
        await page.locator('#fu-sch-when').fill(slot(0)); await page.getByRole('dialog').getByRole('button', { name: t.schConfirm, exact: true }).click();
        await page.locator('#fu-sch-when-error').filter({ hasText: t.schConflict }).waitFor();
        await page.waitForFunction(() => document.activeElement?.id === 'fu-sch-when');
        assert.equal(await sessions(), before + 1, 'el choque no crea otra sesión');
        await axe(page, `agendar ${tag}`);
        await context.close(); }
      { const { context, page } = await open(lang, width, sharer.id, async (r) => { if (r.request().method() !== 'POST' || !r.request().url().endsWith('/api/sessions/therapist')) return false; await r.fulfill({ status: 400, json: { code: 'duration_invalid', field: 'duration', error: 'duration must be between 15 and 120 minutes.' } }); return true; });
        await page.getByRole('button', { name: t.schOpen }).waitFor({ timeout: 10000 });
        await page.getByRole('button', { name: t.schOpen }).click(); await page.getByRole('dialog').waitFor();
        await page.getByRole('dialog').getByRole('button', { name: t.schConfirm, exact: true }).click();
        await page.waitForFunction(() => (document.querySelector('#fu-sch-duration-error')?.textContent ?? '').length > 0);
        await page.selectOption('#fu-sch-duration', '60');
        await page.waitForFunction(() => (document.querySelector('#fu-sch-duration-error')?.textContent ?? '') === ''); // E227 (c): el error se limpia al cambiar el campo
        assert.equal(await page.locator('#fu-sch-duration').getAttribute('aria-invalid'), null);
        await context.close(); }
      { let dropped = 0; const slotLost = (() => { const d = new Date(Date.now() + (9 + (lang === 'en' ? 40 : 0) + (width === 1360 ? 20 : 0)) * 86400000); d.setHours(11, 0, 0, 0); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); })();
        const { context, page } = await open(lang, width, sharer.id, async (r) => { if (r.request().method() !== 'POST' || !r.request().url().endsWith('/api/sessions/therapist') || dropped > 0) return false; dropped++; try { const u = new URL(r.request().url()); await r.fetch({ url: apiUrl + u.pathname }); await r.abort('connectionreset'); } catch { /* cerrada */ } return true; });
        await page.getByRole('button', { name: t.schOpen }).waitFor({ timeout: 10000 });
        const before = (await q('SELECT count(*)::int AS n FROM "TherapySessions" WHERE "patientId"=$1', [sharer.id]))[0].n;
        await page.getByRole('button', { name: t.schOpen }).click(); await page.getByRole('dialog').waitFor();
        await page.locator('#fu-sch-when').fill(slotLost); await page.getByRole('dialog').getByRole('button', { name: t.schConfirm, exact: true }).click();
        await page.getByText(t.schDone).first().waitFor();
        assert.equal(dropped, 1);
        assert.equal((await q('SELECT count(*)::int AS n FROM "TherapySessions" WHERE "patientId"=$1', [sharer.id]))[0].n, before + 1, 'una sola sesión: no se reenvió a ciegas');
        await context.close(); }
      check(`${tag}: agendar → Esc devuelve el foco, fecha pasada y choque por campo con foco sin crear nada, éxito crea una, respuesta perdida se resuelve sin duplicar`);
    }
    console.log(`ES-178 F1 servidor real: ${checks.length} comprobaciones superadas. Express + rutas del profesional + PostgreSQL migrado reales.`);
  } catch (error) {
    console.error('ES-178 falló:', error); require('./_exitOnFailure.cjs').fail();
  } finally {
    if (browser) await browser.close(); if (db) await db.end().catch(() => {}); if (server) await new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); });
    if (sequelize) await sequelize.close(); if (started) await pg.stop(); try { fs.rmSync(directory, { recursive: true, force: true, maxRetries: 8, retryDelay: 300 }); } catch { /* Windows aún bloquea el directorio */ }
  }
})();
