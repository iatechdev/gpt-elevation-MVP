// ES-303 (PR B) · Invitación de revisor con código de un solo uso, medida en Chromium sobre el build REAL de React contra el server.js REAL y PostgreSQL REAL (migraciones reales). Personas sintéticas, sin IA ni producción.
// Revisor (therapist): crear invitación (código UNA vez, copiar código/enlace, «Listo» lo descarta), tope de 10 activas, anular con confirmación. Persona: código por enlace (se limpia de la URL y NO se envía solo),
// continuar → elegir evidencias (ninguna marcada) → autorizar; error uniforme 404 (usado/anulado/vencido/inexistente), 429, corte de red con el MISMO requestId, actualizar evidencias, retirar acceso.
// Además: ES/EN × 1360/390/320 × claro/oscuro con axe (0 violaciones) y sin desbordes, CLS de carga, y que el código no queda en almacenamiento, DOM ni URL.
// Uso: ES303_BACKEND_DIR=<backend con node_modules> ES303_TEST_DATABASE_URL=postgres://…@127.0.0.1:54391/postgres PLAYWRIGHT_MODULE=<playwright> AXE_PATH=<axe.min.js> node scripts/es303-pantallas-check.cjs
const assert = require('node:assert/strict'); const fs = require('node:fs'); const path = require('node:path'); const os = require('node:os'); const http = require('node:http'); const { once } = require('node:events'); const { spawnSync } = require('node:child_process'); const crypto = require('node:crypto');

const CODE_RE = /^[A-Z0-9]{4}(-[A-Z0-9]{4}){3}$/;
(async () => {
  assert.ok(process.env.ES303_BACKEND_DIR && process.env.ES303_TEST_DATABASE_URL, 'Se necesitan ES303_BACKEND_DIR y ES303_TEST_DATABASE_URL');
  const backend = path.resolve(process.env.ES303_BACKEND_DIR); const root = path.resolve(__dirname, '..'); const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'es303-'));
  const cleanups = []; const checks = []; const check = (label) => { checks.push(label); console.log('PASS ' + label); };
  const { startRealApi } = require(path.join(backend, 'test/support/realApi.cjs'));
  let browser; let web;
  try {
    const api = await startRealApi({ after: (fn) => cleanups.push(fn) }, { envVar: 'ES303_TEST_DATABASE_URL', prefix: 'es303ui' });
    const { base, q, mkUser, http: call } = api; const rid = () => crypto.randomUUID();
    const reviewer = await mkUser('therapist'); await q('UPDATE "Users" SET name=$2 WHERE id=$1', [reviewer.id, 'Ana Revisora']);
    const person = await mkUser('user'); const other = await mkUser('user');
    const payload = (title) => ({ title, situation: 'Un proyecto', responsibility: { text: 'Yo coordinaba' }, actions: [{ text: 'Organicé tareas' }], delivered: { text: 'Un plan' }, observedEffect: { known: false }, autonomy: 'autonomous' });
    const mkEvidence = async (who, title) => { const out = await call(who, 'POST', '/api/evidence', { payload: payload(title), status: 'confirmed', requestId: rid() }); assert.equal(out.status, 201, JSON.stringify(out.body)); return out.body.id; };
    const evs = []; for (const title of ['Evidencia uno', 'Evidencia dos', 'Evidencia tres']) evs.push(await mkEvidence(person, title));
    await mkEvidence(other, 'Evidencia de otra persona');
    const newInvite = async () => { const out = await call(reviewer, 'POST', '/api/reviewer/invites', { requestId: rid() }); assert.equal(out.status, 201, JSON.stringify(out.body)); return out.body; };

    // Build real (VITE_BACKEND_URL vacío = mismo origen; un servidor propio sirve el build y reenvía /api al servidor real).
    const out = path.join(tmp, 'web'); const built = spawnSync(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', out], { cwd: root, encoding: 'utf8', env: { ...process.env, VITE_BACKEND_URL: '' } });
    if (built.status !== 0) throw new Error('build: ' + built.stderr + built.stdout);
    const apiRequests = [];
    web = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://x');
      if (url.pathname.startsWith('/api/')) {
        const chunks = []; req.on('data', (c) => chunks.push(c)); req.on('end', () => {
          const body = Buffer.concat(chunks); apiRequests.push({ method: req.method, path: url.pathname, body: body.toString('utf8') });
          const upstream = http.request(base + req.url, { method: req.method, headers: { ...req.headers, host: new URL(base).host } }, (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
          upstream.on('error', () => { res.statusCode = 502; res.end(); }); upstream.end(body);
        }); return;
      }
      const p = decodeURIComponent(url.pathname); const target = path.resolve(out, '.' + p); const file = target.startsWith(out) && fs.existsSync(target) && fs.statSync(target).isFile() ? target : path.join(out, 'index.html');
      res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png' })[path.extname(file)] || 'text/html'); res.end(fs.readFileSync(file));
    });
    web.listen(0, '127.0.0.1'); await once(web, 'listening'); const origin = `http://127.0.0.1:${web.address().port}`;
    const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright'); browser = await chromium.launch({ headless: true });
    const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8'); const jsErrors = [];
    async function open(who, { lang = 'es', width = 1360, scheme = 'light', hash = '' } = {}) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce', timezoneId: 'America/Bogota', permissions: ['clipboard-read', 'clipboard-write'] });
      const page = await context.newPage();
      page.on('pageerror', (e) => jsErrors.push(String(e).slice(0, 160))); page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) jsErrors.push(m.text().slice(0, 160)); });
      await context.addInitScript(([t, l, r]) => { try { if (!localStorage.getItem('elevation_token')) { localStorage.setItem('elevation_token', t); localStorage.setItem('elevation_role', r); localStorage.setItem('elv_lang', l); } } catch { /* sin almacenamiento */ } }, [who.token, lang, who.role]);
      await page.goto(origin + '/app/professional-reviews' + hash); return { context, page };
    }
    const settled = async (page) => { await page.waitForSelector('main h1, #main h1, h1'); await page.waitForLoadState('networkidle'); };
    const axe = async (page, label) => { await page.addScriptTag({ content: axeSource }); const v = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }).then((r) => r.violations.map((x) => x.id + ': ' + x.nodes.length))); assert.deepEqual(v, [], 'axe ' + label); };
    const overflow = async (page, label) => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'desborde ' + label);
    const storageHas = (page, text) => page.evaluate((t) => JSON.stringify([localStorage, sessionStorage]).includes(t) || [...Array(localStorage.length)].some((_, i) => (localStorage.getItem(localStorage.key(i)) || '').includes(t)) || [...Array(sessionStorage.length)].some((_, i) => (sessionStorage.getItem(sessionStorage.key(i)) || '').includes(t)), text);

    // ───────── REVISOR ─────────
    const R = await open(reviewer); await settled(R.page);
    assert.equal(await R.page.locator('h1').first().textContent(), 'Invitar a una persona'); await R.page.getByText('Aún no has creado invitaciones.').waitFor();
    check('Revisor: «Invitar a una persona» con la lista vacía («Aún no has creado invitaciones.»)');
    await R.page.getByRole('button', { name: 'Crear invitación' }).click(); await R.page.locator('.rv-code').waitFor();
    const code = (await R.page.locator('.rv-code').innerText()).trim(); assert.match(code, CODE_RE);
    assert.ok(await R.page.getByText('Este código se muestra solo ahora. Cópialo y envíaselo a la persona.').isVisible());
    assert.equal(await R.page.evaluate(() => document.activeElement && document.activeElement.closest('section[aria-labelledby="rv-new-title"]') !== null), true, 'el foco va al panel del código');
    assert.equal(await R.page.locator('dialog[open], [role=dialog][aria-modal=true]').count(), 0, 'el panel del código NO es modal');
    assert.ok(await R.page.locator('[aria-live=polite]').count() >= 1);
    check('Revisor: «Crear invitación» muestra el código (4 grupos de 4) UNA vez, con el aviso, el foco en el panel y SIN diálogo modal');
    await R.page.getByRole('button', { name: 'Copiar código' }).click(); assert.equal(await R.page.evaluate(() => navigator.clipboard.readText()), code); await R.page.getByText('Código copiado').waitFor();
    await R.page.getByRole('button', { name: 'Copiar enlace' }).click(); const link = await R.page.evaluate(() => navigator.clipboard.readText()); assert.equal(link, `${origin}/app/professional-reviews#code=${encodeURIComponent(code)}`); assert.equal(new URL(link).search, '');
    check('Revisor: «Copiar código» y «Copiar enlace» (el código va en el FRAGMENTO, nunca en la ruta ni en la consulta)');
    await axe(R.page, 'revisor con código (ES 1360 claro)');
    await R.page.getByRole('button', { name: 'Listo' }).click(); await R.page.locator('.rv-code').waitFor({ state: 'detached' });
    assert.ok(!(await R.page.locator('body').innerText()).includes(code), 'el código ya no está en la pantalla'); assert.equal(await storageHas(R.page, code), false, 'ni en el almacenamiento'); assert.ok(!R.page.url().includes(code));
    await R.page.reload(); await settled(R.page); assert.ok(!(await R.page.locator('body').innerText()).includes(code), 'tras recargar tampoco'); assert.ok(await R.page.locator('.cg-chip', { hasText: 'Activa' }).first().isVisible());
    const listed = await call(reviewer, 'GET', '/api/reviewer/invites'); assert.ok(!JSON.stringify(listed.body).includes(code.replace(/-/g, '')), 'el servidor no devuelve el código');
    check('Revisor: «Listo» descarta el código; ni la pantalla recargada, ni el almacenamiento, ni el servidor lo vuelven a mostrar (solo la lista con «Activa»)');
    const dbInvites = await q('SELECT count(*)::int n FROM "ReviewerInvites" WHERE "reviewerId"=$1', [reviewer.id]); assert.equal(dbInvites[0].n, 1);
    // doble clic: UNA sola invitación
    await R.page.getByRole('button', { name: 'Crear invitación' }).dblclick(); await R.page.locator('.rv-code').waitFor(); await R.page.waitForLoadState('networkidle');
    assert.equal((await q('SELECT count(*)::int n FROM "ReviewerInvites" WHERE "reviewerId"=$1', [reviewer.id]))[0].n, 2, 'un doble clic crea UNA invitación, no dos');
    check('Revisor: doble clic en «Crear invitación» crea UNA sola invitación (botón deshabilitado y mismo requestId)');
    await R.page.getByRole('button', { name: 'Listo' }).click();
    // anular con confirmación
    await R.page.getByRole('button', { name: 'Anular' }).first().click(); await R.page.getByRole('dialog').waitFor(); assert.match(await R.page.getByRole('dialog').textContent(), /¿Anular esta invitación\? La persona ya no podrá usar el código\./);
    await R.page.keyboard.press('Escape'); await R.page.getByRole('dialog').waitFor({ state: 'detached' }); assert.equal((await q(`SELECT count(*)::int n FROM "ReviewerInvites" WHERE "revokedAt" IS NOT NULL`))[0].n, 0, 'Escape no anula');
    await R.page.getByRole('button', { name: 'Anular' }).first().click(); await axe(R.page, 'diálogo de anular'); await R.page.getByRole('button', { name: 'Sí, anular' }).click(); await R.page.locator('.cg-chip', { hasText: 'Anulada' }).first().waitFor();
    assert.equal((await q(`SELECT count(*)::int n FROM "ReviewerInvites" WHERE "reviewerId"=$1 AND "revokedAt" IS NOT NULL`, [reviewer.id]))[0].n, 1);
    check('Revisor: «Anular» pide confirmación (Escape conserva), «Sí, anular» anula de verdad y la lista dice «Anulada»');
    // tope de 10 activas
    for (let i = 0; i < 9; i += 1) await newInvite(); await R.page.reload(); await settled(R.page);
    await R.page.getByText('Ya tienes 10 invitaciones activas. Anula alguna o espera a que venzan.').waitFor(); assert.equal(await R.page.getByRole('button', { name: 'Crear invitación' }).isDisabled(), true);
    check('Revisor: con 10 activas aparece el aviso y «Crear invitación» queda deshabilitado');
    const fullOut = await call(reviewer, 'POST', '/api/reviewer/invites', { requestId: rid() }); assert.equal(fullOut.status, 409);
    await R.context.close();

    // ───────── PERSONA ─────────
    const inv1 = await newInvite().catch(async () => { await q(`UPDATE "ReviewerInvites" SET "revokedAt"=now() WHERE id IN (SELECT id FROM "ReviewerInvites" WHERE "reviewerId"=$1 AND "usedAt" IS NULL AND "revokedAt" IS NULL ORDER BY id LIMIT 3)`, [reviewer.id]); return newInvite(); });
    const P = await open(person, { hash: '#code=' + encodeURIComponent(inv1.code) }); await settled(P.page);
    assert.equal(await P.page.locator('h1').first().textContent(), 'Revisiones profesionales');
    assert.equal(await P.page.inputValue('input[autocomplete=off]'), inv1.code); assert.equal(await P.page.evaluate(() => window.location.hash), '', 'el fragmento se limpió de la URL');
    await P.page.getByText('El código llegó por el enlace; revísalo y pulsa Continuar').waitFor();
    assert.equal(apiRequests.filter((r) => /review-invites\/lookup/.test(r.path)).length, 0, 'el código del enlace NO se envía solo');
    const historyLength = await P.page.evaluate(() => history.length); assert.ok(historyLength <= 2);
    check('Persona: el código del enlace rellena el campo con aviso, el fragmento se LIMPIA de la URL y NO se envía solo');
    await axe(P.page, 'persona con código por enlace (ES 1360 claro)');
    await P.page.getByRole('button', { name: 'Continuar' }).click(); await P.page.getByText(/Ana Revisora te ofrece revisar tus evidencias\. La invitación vence el/).waitFor();
    const boxes = P.page.locator('.rv-chk input'); assert.equal(await boxes.count(), 3); for (let i = 0; i < 3; i += 1) assert.equal(await boxes.nth(i).isChecked(), false, 'ninguna marcada por defecto');
    assert.equal(await P.page.getByRole('button', { name: 'Autorizar a Ana Revisora' }).isDisabled(), true); await P.page.getByText('Seleccionadas: 0').waitFor();
    assert.equal(await P.page.getByText('Evidencia de otra persona').count(), 0, 'solo las evidencias PROPIAS');
    check('Persona: «Continuar» muestra a Ana Revisora y SOLO mis 3 evidencias, ninguna marcada, «Autorizar» deshabilitado');
    await boxes.nth(0).check(); await boxes.nth(2).check(); await P.page.getByText('Seleccionadas: 2').waitFor(); await axe(P.page, 'persona eligiendo evidencias (ES 1360 claro)');
    await P.page.getByRole('button', { name: 'Autorizar a Ana Revisora' }).click(); await P.page.getByText(/Listo\. Autorizaste esta revisión\./).waitFor();
    const authReq = apiRequests.filter((r) => r.method === 'POST' && /review-shares$/.test(r.path)).pop(); const authBody = JSON.parse(authReq.body); assert.deepEqual(Object.keys(authBody).sort(), ['evidenceIds', 'inviteCode', 'requestId']); assert.ok(!('reviewerId' in authBody)); assert.deepEqual(authBody.evidenceIds.sort(), [evs[0], evs[2]].sort());
    const shares = await q('SELECT id, status, "materialVersion", jsonb_array_length("evidenceRefs"::jsonb) n FROM "ReviewShares" WHERE "UserId"=$1', [person.id]); assert.equal(shares.length, 1); assert.equal(shares[0].status, 'granted'); assert.equal(shares[0].n, 2);
    assert.ok((await q('SELECT "usedAt" FROM "ReviewerInvites" WHERE "reviewerId"=$1 AND "usedAt" IS NOT NULL', [reviewer.id])).length === 1, 'el código quedó gastado');
    await P.page.getByText('2 evidencias').waitFor(); assert.equal(await P.page.locator('.rv-row__top strong').first().textContent(), 'Ana Revisora', 'Mis autorizaciones muestra el NOMBRE (ES-367)'); assert.ok(await P.page.locator('.cg-chip', { hasText: 'Activa' }).first().isVisible());
    assert.equal(await P.page.locator('input[autocomplete=off]').inputValue(), '', 'el campo queda vacío tras autorizar'); assert.equal(await storageHas(P.page, inv1.code), false, 'el código no está en el almacenamiento'); assert.ok(!(await P.page.locator('body').innerText()).includes(inv1.code));
    check('Persona: autorizar guarda EXACTAMENTE las 2 evidencias elegidas, sin reviewerId en la solicitud, el código queda gastado y no sobrevive en pantalla, URL ni almacenamiento; «Mis autorizaciones» lo lista');
    await axe(P.page, 'persona con «Mis autorizaciones» (ES 1360 claro)');

    // 404 uniforme: usado, anulado, vencido, inexistente
    const revoked = await newInvite().catch(() => null) || (await (async () => { await q(`UPDATE "ReviewerInvites" SET "revokedAt"=now() WHERE id=(SELECT id FROM "ReviewerInvites" WHERE "reviewerId"=$1 AND "usedAt" IS NULL AND "revokedAt" IS NULL ORDER BY id LIMIT 1)`, [reviewer.id]); return newInvite(); })());
    const expired = await newInvite().catch(() => null) || (await (async () => { await q(`UPDATE "ReviewerInvites" SET "revokedAt"=now() WHERE id=(SELECT id FROM "ReviewerInvites" WHERE "reviewerId"=$1 AND "usedAt" IS NULL AND "revokedAt" IS NULL ORDER BY id LIMIT 1)`, [reviewer.id]); return newInvite(); })());
    await call(reviewer, 'DELETE', '/api/reviewer/invites/' + revoked.invite.id); await q(`UPDATE "ReviewerInvites" SET "expiresAt"=now() - interval '1 day' WHERE id=$1`, [expired.invite.id]);
    const Q = await open(other); await settled(Q.page); const field = Q.page.locator('input[autocomplete=off]'); const messages = new Set();
    for (const [label, value] of [['usado', inv1.code], ['anulado', revoked.code], ['vencido', expired.code], ['inexistente', 'ZZZZ-ZZZZ-ZZZZ-ZZZZ']]) {
      await field.fill(value); await Q.page.getByRole('button', { name: 'Continuar' }).click(); await Q.page.getByText('No encontramos esa invitación. Revisa el código o pide uno nuevo.').waitFor();
      const info = await field.evaluate((el) => ({ invalid: el.getAttribute('aria-invalid'), focused: document.activeElement === el, describedby: el.getAttribute('aria-describedby') })); assert.equal(info.invalid, 'true', label); assert.equal(info.focused, true, 'el foco vuelve al campo (' + label + ')');
      messages.add(await Q.page.locator('.cg-error').first().textContent());
      const last = apiRequests.filter((r) => /review-invites\/lookup/.test(r.path)).pop(); assert.ok(last, 'hubo lookup');
    }
    assert.equal(messages.size, 1, 'UN solo mensaje para las cuatro causas');
    assert.ok(![...messages][0].match(/vencid|usad|anulad/i), 'el mensaje no revela la causa');
    check('Persona: código usado, anulado, vencido o inexistente → el MISMO mensaje, en el campo (aria-invalid), con el foco en el campo y sin revelar la causa');
    await axe(Q.page, 'error uniforme (ES 1360 claro)');
    // 429: tope por persona (30/h) agotado por API; la pantalla dice «Demasiados intentos»
    let limited = false; for (let i = 0; i < 45 && !limited; i += 1) { const r = await call(other, 'POST', '/api/me/review-invites/lookup', { code: 'ZZZZ-ZZZZ-ZZZZ-' + String(i).padStart(4, 'Z') }); limited = r.status === 429; }
    assert.ok(limited, 'se alcanzó el tope por persona'); await field.fill('ZZZZ-ZZZZ-ZZZZ-ZZZY'); await Q.page.getByRole('button', { name: 'Continuar' }).click(); await Q.page.getByText('Demasiados intentos seguidos. Inténtalo más tarde.').waitFor();
    check('Persona: al agotar el tope de intentos la pantalla dice «Demasiados intentos seguidos. Inténtalo más tarde.» (429 real)');
    await Q.context.close();

    // Corte de red con el MISMO requestId, actualizar evidencias, retirar
    const inv2 = await (async () => { await q(`UPDATE "ReviewerInvites" SET "revokedAt"=now() WHERE id=(SELECT id FROM "ReviewerInvites" WHERE "reviewerId"=$1 AND "usedAt" IS NULL AND "revokedAt" IS NULL ORDER BY id LIMIT 1)`, [reviewer.id]); return newInvite(); })();
    const person2 = await mkUser('user'); const ev2 = await mkEvidence(person2, 'Evidencia propia'); const P2 = await open(person2); await settled(P2.page);
    await P2.page.locator('input[autocomplete=off]').fill(inv2.code); await P2.page.getByRole('button', { name: 'Continuar' }).click(); await P2.page.locator('.rv-chk input').first().check();
    const seen = []; await P2.page.route('**/api/me/review-shares', (route) => { if (route.request().method() === 'POST' && seen.length === 0) { seen.push(JSON.parse(route.request().postData()).requestId); return route.abort(); } return route.continue(); });
    await P2.page.getByRole('button', { name: /Autorizar a Ana Revisora/ }).click(); await P2.page.getByText('No pudimos guardar la autorización. Tu código no se gastó: inténtalo de nuevo.').waitFor();
    assert.equal((await q('SELECT count(*)::int n FROM "ReviewShares" WHERE "UserId"=$1', [person2.id]))[0].n, 0); await axe(P2.page, 'error al autorizar (ES 1360 claro)');
    await P2.page.getByRole('button', { name: 'Reintentar' }).click(); await P2.page.getByText(/Listo\. Autorizaste esta revisión\./).waitFor();
    const posts = apiRequests.filter((r) => r.method === 'POST' && /review-shares$/.test(r.path) && JSON.parse(r.body).evidenceIds && JSON.parse(r.body).evidenceIds[0] === ev2); assert.ok(posts.length >= 1);
    assert.equal(JSON.parse(posts[posts.length - 1].body).requestId, seen[0], 'el reintento reutiliza el MISMO requestId'); assert.equal((await q('SELECT count(*)::int n FROM "ReviewShares" WHERE "UserId"=$1', [person2.id]))[0].n, 1, 'una sola autorización');
    check('Persona: con un corte de red al autorizar, «Tu código no se gastó…» + «Reintentar» reutiliza el MISMO requestId y queda UNA sola autorización');
    // Actualizar evidencias (sin código) y retirar
    await P2.page.getByRole('button', { name: 'Actualizar evidencias' }).click(); await P2.page.getByRole('heading', { name: /Actualizar las evidencias de esta persona revisora/ }).waitFor();
    assert.equal(await P2.page.locator('input[autocomplete=off]').count(), 0, 'no pide código nuevo'); const ev3 = await mkEvidence(person2, 'Evidencia nueva'); await P2.page.getByRole('button', { name: 'Cancelar' }).click();
    await P2.page.getByRole('button', { name: 'Actualizar evidencias' }).click(); await P2.page.getByText('Evidencia nueva').waitFor(); const checked = await P2.page.locator('.rv-chk input:checked').count(); assert.equal(checked, 0, 'ninguna marcada por defecto al actualizar');
    await P2.page.getByLabel(/Evidencia nueva/).check(); await P2.page.getByRole('button', { name: 'Autorizar revisión' }).click(); await P2.page.getByText(/Listo\. Autorizaste esta revisión\./).waitFor();
    const updated = await q('SELECT status, "materialVersion" FROM "ReviewShares" WHERE "UserId"=$1 ORDER BY id', [person2.id]); assert.deepEqual(updated.map((r) => r.status), ['superseded', 'granted']); assert.equal(updated[1].materialVersion, 2); assert.equal(await P2.page.locator('.cg-chip', { hasText: 'Activa' }).count(), 1, 'una fila por persona revisora');
    void ev3; check('Persona: «Actualizar evidencias» no pide código, no marca nada, crea la versión 2 y la lista sigue con UNA fila');
    await P2.page.getByRole('button', { name: 'Retirar acceso' }).click(); await P2.page.getByText('Retiraste el acceso.').waitFor(); await P2.page.locator('.cg-chip', { hasText: 'Retirada' }).waitFor();
    assert.equal((await q(`SELECT status FROM "ReviewShares" WHERE "UserId"=$1 AND status='granted'`, [person2.id])).length, 0); assert.equal(await P2.page.getByRole('button', { name: 'Actualizar evidencias' }).count(), 0);
    check('Persona: «Retirar acceso» retira de verdad (la fila pasa a «Retirada» y desaparecen las acciones)');
    await P2.context.close(); await P.context.close();

    // S8c (QA-Claude-6, sobrevivía a mi prueba): se PIERDE LA RESPUESTA de autorizar (la petición SÍ llegó al servidor). «Reintentar» reutiliza el MISMO requestId: 2 peticiones, 1 id, UNA sola autorización y éxito.
    { const pr = await mkUser('user'); const e1 = await mkEvidence(pr, 'Reintento uno'); const inv = await newInvite().catch(async () => { await q('UPDATE "ReviewerInvites" SET "revokedAt"=now() WHERE id=(SELECT id FROM "ReviewerInvites" WHERE "reviewerId"=$1 AND "usedAt" IS NULL AND "revokedAt" IS NULL ORDER BY id LIMIT 1)', [reviewer.id]); return newInvite(); });
      const L = await open(pr); await settled(L.page); await L.page.locator('input[autocomplete=off]').fill(inv.code); await L.page.getByRole('button', { name: 'Continuar' }).click(); await L.page.locator('.rv-chk input').first().check();
      const lost = []; await L.page.route('**/api/me/review-shares', async (route) => { if (route.request().method() === 'POST' && lost.length === 0) { lost.push(JSON.parse(route.request().postData()).requestId); await route.fetch(); return route.abort(); } return route.continue(); });
      const before = apiRequests.filter((r) => r.method === 'POST' && /review-shares$/.test(r.path)).length;
      await L.page.getByRole('button', { name: /Autorizar a Ana Revisora/ }).click(); await L.page.getByText('No pudimos guardar la autorización. Tu código no se gastó: inténtalo de nuevo.').waitFor();
      assert.equal((await q('SELECT count(*)::int n FROM "ReviewShares" WHERE "UserId"=$1', [pr.id]))[0].n, 1, 'la primera petición SÍ llegó: ya hay una autorización aunque la respuesta se perdió');
      await L.page.getByRole('button', { name: 'Reintentar' }).click(); await L.page.getByText(/Listo\. Autorizaste esta revisión\./).waitFor();
      const posts = apiRequests.filter((r) => r.method === 'POST' && /review-shares$/.test(r.path)).slice(before); assert.equal(posts.length, 2, 'dos peticiones'); assert.equal(new Set(posts.map((r) => JSON.parse(r.body).requestId)).size, 1, 'un solo requestId'); assert.equal(JSON.parse(posts[1].body).requestId, lost[0]);
      assert.equal((await q('SELECT count(*)::int n FROM "ReviewShares" WHERE "UserId"=$1', [pr.id]))[0].n, 1, 'UNA sola autorización tras el reintento (idempotente)'); void e1; await L.context.close(); }
    check('Persona: con la RESPUESTA de autorizar perdida (la petición sí llegó), «Reintentar» usa el MISMO requestId y queda UNA sola autorización con éxito (S8c de QA-6)');
    // S6e (QA-Claude-6): evidencias NO elegibles (origen en el chat o «para revisión») no se ofrecen aunque el servidor las liste.
    { const pe = await mkUser('user'); const a1 = await mkEvidence(pe, 'Elegible A'); const a2 = await mkEvidence(pe, 'Del chat B'); const a3 = await mkEvidence(pe, 'Para revisión C'); const inv = await newInvite().catch(async () => { await q('UPDATE "ReviewerInvites" SET "revokedAt"=now() WHERE id=(SELECT id FROM "ReviewerInvites" WHERE "reviewerId"=$1 AND "usedAt" IS NULL AND "revokedAt" IS NULL ORDER BY id LIMIT 1)', [reviewer.id]); return newInvite(); });
      const E = await open(pe); await settled(E.page);
      await E.page.route('**/api/evidence', async (route) => { if (route.request().method() !== 'GET') return route.continue(); const response = await route.fetch(); const body = await response.json();
        for (const row of body.evidence) { if (row.id === a2) row.fromChat = true; if (row.id === a3) row.origin = { kind: 'resume', version: 1, date: '2026-11-01T10:00:00.000Z', needsReview: true }; } return route.fulfill({ response, json: body }); });
      await E.page.locator('input[autocomplete=off]').fill(inv.code); await E.page.getByRole('button', { name: 'Continuar' }).click(); await E.page.locator('.rv-chk input').first().waitFor();
      const labels = await E.page.locator('.rv-chk').allTextContents(); assert.equal(labels.length, 1, JSON.stringify(labels)); assert.ok(labels[0].includes('Elegible A')); void a1; await E.context.close(); }
    check('Persona: la evidencia del chat y la «para revisión» NO se ofrecen aunque el servidor las liste; solo la elegible (S6e de QA-6)');

    // ───────── Idiomas, anchos, temas: axe 0 y sin desbordes ─────────
    const person3 = await mkUser('user'); await mkEvidence(person3, 'Evidencia propia'); const reviewer2 = await mkUser('therapist'); await q('UPDATE "Users" SET name=$2 WHERE id=$1', [reviewer2.id, 'Ana Revisora']);
    let combos = 0;
    for (const [lang, width, scheme] of [['es', 1360, 'light'], ['es', 390, 'dark'], ['es', 320, 'light'], ['en', 1360, 'dark'], ['en', 390, 'light'], ['en', 320, 'dark']]) {
      const invite = (await call(reviewer2, 'POST', '/api/reviewer/invites', { requestId: rid() })).body;
      const A = await open(reviewer2, { lang, width, scheme }); await settled(A.page); await A.page.locator('button.cg-btn', { hasText: lang === 'es' ? 'Crear invitación' : 'Create invitation' }).click(); await A.page.locator('.rv-code').waitFor();
      await axe(A.page, `revisor ${lang} ${width} ${scheme}`); await overflow(A.page, `revisor ${lang} ${width}`); await A.context.close();
      const B = await open(person3, { lang, width, scheme }); await settled(B.page); await B.page.locator('input[autocomplete=off]').fill(invite.code); await B.page.locator('button.cg-btn', { hasText: lang === 'es' ? 'Continuar' : 'Continue' }).click(); await B.page.locator('.rv-chk').first().waitFor();
      await axe(B.page, `persona ${lang} ${width} ${scheme}`); await overflow(B.page, `persona ${lang} ${width}`);
      if (lang === 'en') assert.ok(await B.page.getByText('Choose which evidence they can see').isVisible()); await B.context.close(); combos += 2;
      await call(reviewer2, 'DELETE', '/api/reviewer/invites/' + invite.invite.id);
    }
    check(`ES/EN × 1360/390/320 × claro/oscuro (${combos} pantallas): axe 0 violaciones y sin desbordes`);

    // ───────── CLS de carga y alcanzabilidad por rol ─────────
    const cls = async (who) => { const c = await browser.newContext({ viewport: { width: 1360, height: 900 }, reducedMotion: 'reduce' }); await c.addInitScript(([t, r]) => { localStorage.setItem('elevation_token', t); localStorage.setItem('elevation_role', r); window.__cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); }, [who.token, who.role]);
      const p = await c.newPage(); await p.goto(origin + '/app/professional-reviews'); await p.waitForLoadState('networkidle'); await p.waitForTimeout(800); const v = await p.evaluate(() => window.__cls); await c.close(); return v; };
    const clsPerson = await cls(person3); const clsReviewer = await cls(reviewer2); console.log(`INFO CLS de carga: persona ${clsPerson.toFixed(4)}, revisor ${clsReviewer.toFixed(4)}`);
    assert.ok(clsPerson <= 0.1 && clsReviewer <= 0.1, 'CLS de carga ≤ 0.1'); check(`CLS de carga ≤ 0,1 (persona ${clsPerson.toFixed(3)}, revisor ${clsReviewer.toFixed(3)})`);
    for (const [who, label] of [[person3, 'persona'], [reviewer2, 'profesional']]) {
      const c = await browser.newContext({ viewport: { width: 1360, height: 900 } }); await c.addInitScript(([t, r]) => { localStorage.setItem('elevation_token', t); localStorage.setItem('elevation_role', r); }, [who.token, who.role]);
      const p = await c.newPage(); await p.goto(origin + '/app/dashboard'); await p.waitForLoadState('networkidle'); const url = who.role === 'therapist' ? '/therapist/dashboard' : '/app/dashboard'; if (who.role === 'therapist') await p.goto(origin + url);
      await p.waitForLoadState('networkidle'); const links = await p.locator('a[href="/app/professional-reviews"]').count(); assert.ok(links >= 1, `${label}: hay un enlace a /app/professional-reviews en la navegación`); await c.close();
    }
    check('Alcanzabilidad: persona y profesional tienen el enlace a /app/professional-reviews en su navegación');
    assert.deepEqual(jsErrors, [], 'errores de JS: ' + jsErrors.join(' | ')); check('Sin errores de JavaScript ni de consola en ninguna pantalla');
    console.log(`\nES-303 PR B pantallas: ${checks.length} comprobaciones OK`);
  } finally {
    if (browser) await browser.close().catch(() => {}); if (web) web.close(); for (const fn of cleanups.reverse()) await fn().catch(() => {}); fs.rmSync(tmp, { recursive: true, force: true });
  }
})().catch((error) => { console.error('FALLO', error && error.stack ? error.stack : error); process.exit(1); });
