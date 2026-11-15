// ES-177 (B1): panel profesional en navegador real (Chromium) con la forma REAL de las respuestas (test/fixtures/es-177-*.json, generadas por la prueba con
// Postgres real del backend) ampliada con casos de relleno de la misma forma: vacío, nadie comparte, 12 personas, y cada bloque fallando por separado.
// Uso: npx vite build && npx vite preview --host 127.0.0.1 --port 4177   y luego
//   ES177_URL=http://127.0.0.1:4177 PLAYWRIGHT_MODULE=<ruta a playwright> AXE_PATH=<axe.min.js> node scripts/es177-panel-check.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const fixture = (name) => JSON.parse(fs.readFileSync(path.join(__dirname, '../test/fixtures', name), 'utf8'));

(async () => {
  const { chromium } = process.env.PLAYWRIGHT_MODULE ? require(process.env.PLAYWRIGHT_MODULE) : await import('playwright');
  const base = process.env.ES177_URL ?? 'http://127.0.0.1:4177';
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Solo vista previa local');
  const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8');
  const browser = await chromium.launch({ headless: true });
  const errors = []; const checks = [];
  const check = (label) => { checks.push(label); console.log('PASS ' + label); };

  const real = fixture('es-177-pacientes.json').body; // 2 personas reales de PG: una comparte, otra no
  const alertsReal = fixture('es-177-alerts.json').body;
  const iso = (days) => new Date(Date.now() - days * 86400000).toISOString();
  const shaped = (n, over = {}) => ({ id: 100 + n, name: `Persona Sintética ${n}`, ordinal: n, email: `canario-correo-${n}@example.test`, active: true, createdAt: iso(60), sharing: true,
    lastMood: { checkin_mood: 4, checkout_mood: 5, date: iso(n % 4) }, moodTrend: 'up', avgRating: 4.5, totalSessions: 6, sessionsThisWeek: n % 2, trend: 'improving', ...over });
  const hiddenOf = (n) => ({ id: 200 + n, name: null, ordinal: n, email: '', active: true, createdAt: iso(40), sharing: false, lastMood: null, moodTrend: 'neutral', avgRating: null, totalSessions: 0, sessionsThisWeek: 0, trend: null });
  const twelve = [...Array.from({ length: 9 }, (_, i) => shaped(i + 1, i === 3 ? { trend: 'declining', avgRating: 3 } : i === 4 ? { trend: 'stable' } : {})), hiddenOf(10), hiddenOf(11), hiddenOf(12)];
  const upcomingFor = (people) => people.filter((p) => p.sharing).slice(0, 2).map((p, i) => ({ id: 50 + i, patientId: p.id, scheduledAt: new Date(Date.now() + (i + 1) * 3 * 3600000).toISOString(), duration: 50, status: 'scheduled', patientName: p.name }));
  const emptyPrompt = { hasPrompt: false, content: null, active: null, pending: null, rejected: null };
  const scenarios = {
    full: { people: twelve, alerts: { inactivePatients: [{ userId: 101, name: 'Persona Sintética 1', daysSinceLastSession: 9 }, { userId: 102, name: 'Persona Sintética 2', daysSinceLastSession: null }], notableProgress: [{ userId: 103, name: 'Persona Sintética 3', improved: true }] } },
    real: { people: real, alerts: alertsReal },
    empty: { people: [], alerts: { inactivePatients: [], notableProgress: [] } },
    nobody: { people: [hiddenOf(1), hiddenOf(2)], alerts: { inactivePatients: [], notableProgress: [] } },
  };
  const longName = 'N'.repeat(120); // sin espacios (E210-3)
  scenarios.dates = { people: [shaped(1, { name: 'Ana Fecha', lastMood: { checkin_mood: 4, checkout_mood: 4, date: '2026-11-10' } }), shaped(2, { name: 'Beto Fecha', lastMood: { checkin_mood: 3, checkout_mood: 3, date: '2026-11-09' } })], alerts: { inactivePatients: [], notableProgress: [] } };
  scenarios.long = { people: [shaped(1, { name: longName })], alerts: { inactivePatients: [{ userId: 101, name: longName, daysSinceLastSession: 9 }], notableProgress: [{ userId: 101, name: longName, improved: true }] } };
  const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}⭐⬆⬇]|[★☆↑↓]/u;

  async function open(width, lang, scenario, fail = {}, opts = {}) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', timezoneId: opts.timezone });
    const page = await context.newPage();
    if (opts.now) await page.clock.setFixedTime(opts.now);
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
    await page.addInitScript(([l]) => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'therapist'); localStorage.setItem('elv_lang', l); }, [lang]);
    const calls = {}; const { people, alerts } = scenarios[scenario];
    await page.route('**/api/**', (route) => {
      const p = new URL(route.request().url()).pathname; calls[p] = (calls[p] ?? 0) + 1;
      if (p === '/api/session') return route.fulfill({ json: { role: 'therapist', onboardingCompleted: true } });
      const body = {
        '/api/therapist/pacientes': people, '/api/sessions/therapist/upcoming': upcomingFor(people), '/api/therapist/alerts': alerts,
        '/api/therapist/prompt': emptyPrompt, '/api/therapist/validation/status': [], '/api/consents': { consents: [{ purpose: 'therapist_sharing', status: 'granted', required: false }] },
      }[p];
      if (body === undefined) return route.fulfill({ json: [] });
      if (fail[p] && calls[p] <= fail[p]) return route.fulfill({ status: 500, json: { error: 'x' } });
      return route.fulfill({ json: body });
    });
    await page.goto(base + '/therapist/dashboard', { waitUntil: 'networkidle' });
    await page.locator('h1').first().waitFor({ timeout: 8000 });
    return { context, page, calls };
  }
  // Solo los bloques de B1 (resumen, sesiones, personas, avisos): validación y guía para la IA se rehacen en B2 y aún traen sus emojis.
  const text = (page) => page.locator('section[aria-labelledby^="panel-"]').evaluateAll((els) => els.map((e) => e.innerText).join(' | '));
  const axe = async (page) => { await page.evaluate(axeSource); return page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] })).violations.map((v) => v.id + ':' + v.nodes.length)); };
  const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

  for (const [width, lang] of [[390, 'es'], [390, 'en'], [1360, 'es'], [1360, 'en']]) {
    const tag = `${width}px ${lang}`;
    // 12 personas
    let { context, page } = await open(width, lang, 'full');
    await page.getByRole('heading', { level: 2, name: lang === 'es' ? 'Personas' : 'People' }).waitFor();
    let body = await text(page);
    assert.doesNotMatch(body, emoji, `emoji/estrella/flecha en el panel (${tag})`);
    assert.equal((await page.locator('#panel-people-title ~ div li').count()), 12, `12 filas (${tag})`);
    assert.ok(body.includes(lang === 'es' ? '3,8 de 5' : '3.8 of 5') || /\d[.,]\d (de|of) 5/.test(body), `ánimo/valoración en «n de 5» (${tag})`);
    assert.ok(!/canario-correo/.test(body), 'ningún correo en pantalla');
    for (const n of [10, 11, 12]) assert.ok(body.includes(`${lang === 'es' ? 'Persona' : 'Person'} ${n}`), `«Persona ${n}» (${tag})`);
    assert.equal((body.match(lang === 'es' ? /Sin acceso a sus datos/g : /No access to their data/g) ?? []).length, 3, `3 sin acceso (${tag})`);
    assert.ok(lang === 'es' ? /mejorando/.test(body) && /bajando/.test(body) && /estable/.test(body) : /improving/.test(body) && /declining/.test(body) && /steady/.test(body), `tendencia en palabras (${tag})`);
    assert.ok(lang === 'es' ? /Sin sesiones hace 9 días|sin sesiones hace 9 días/i.test(body) && /El ánimo mejoró/.test(body) : /no sessions for 9 days/i.test(body) && /Mood improved/.test(body), `avisos en palabras (${tag})`);
    // la fila de quien no comparte no lleva cifras, correo ni tendencia
    const hiddenRow = await page.locator('#panel-people-title ~ div li', { hasText: lang === 'es' ? 'Persona 10' : 'Person 10' }).innerText();
    assert.doesNotMatch(hiddenRow, /\d{1,2}\s*(de|of)\s*5|registros|entries|mejorando|improving|@/i, `fila sin acceso sin datos (${tag}): ${hiddenRow}`);
    assert.equal(await overflow(page), 0, `sin desborde (${tag})`);
    assert.deepEqual(await axe(page), [], `axe (${tag})`);
    check(`12 personas ${tag}: sin emoji/estrella/flecha, «n de 5», tendencia y avisos en palabras, «Persona n» sin datos, sin correos, sin desborde, axe 0`);
    await context.close();

    // forma real (2 personas de PG)
    ({ context, page } = await open(width, lang, 'real'));
    body = await text(page);
    assert.ok(body.includes('Sintético 3') && body.includes(`${lang === 'es' ? 'Persona' : 'Person'} 2`), `respuesta real: nombre de quien comparte y «Persona 2» (${tag})`);
    assert.ok(!/canario-correo/.test(body));
    assert.ok(lang === 'es' ? /Sin datos/.test(body) : /No data/.test(body), `sin datos de ánimo/valoración → «Sin datos», no 0 ni — (${tag})`);
    assert.doesNotMatch(body, /—\s*$/m);
    check(`respuesta real de PG ${tag}: nombre/«Persona 2», «Sin datos» en promedios`);
    await context.close();

    // E210-1: el registro es una FECHA; a las 20:00 en Bogotá un registro de hoy dice «hoy», no «hace 1 d»
    ({ context, page } = await open(width, lang, 'dates', {}, { timezone: 'America/Bogota', now: '2026-11-11T01:00:00Z' }));
    body = await page.locator('section[aria-labelledby="panel-people-title"]').innerText();
    const ana = body.split('Ana Fecha')[1].split('Beto Fecha')[0]; const beto = body.split('Beto Fecha')[1];
    assert.ok(lang === 'es' ? /Último registro: hoy/.test(ana) && /hace 1 d/.test(beto) : /Last entry: today/.test(ana) && /1 d ago/.test(beto), `días por fecha de calendario en Bogotá a las 20:00 (${tag}): ${ana.slice(0, 120)} | ${beto.slice(0, 120)}`);
    await context.close();
    ({ context, page } = await open(width, lang, 'dates', {}, { timezone: 'Pacific/Auckland', now: '2026-11-10T20:00:00Z' })); // 11-nov 09:00 allí
    body = await page.locator('section[aria-labelledby="panel-people-title"]').innerText();
    assert.ok(lang === 'es' ? /hace 1 d/.test(body.split('Ana Fecha')[1].split('Beto Fecha')[0]) : /1 d ago/.test(body.split('Ana Fecha')[1].split('Beto Fecha')[0]), `un registro de ayer no dice «hoy» en Auckland (${tag})`);
    await context.close();
    check(`días por fecha de calendario (${tag}): hoy en Bogotá a las 20:00 y «hace 1 d» en Auckland`);

    // E210-2: objetivos táctiles ≥ 44 px en todos los botones del panel
    ({ context, page } = await open(width, lang, 'full'));
    await page.getByRole('heading', { level: 2, name: lang === 'es' ? 'Personas' : 'People' }).waitFor();
    const small = await page.evaluate(() => [...document.querySelectorAll('section[aria-labelledby^="panel-"] button, section[aria-labelledby^="panel-"] a')].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && (r.height < 43.5 || r.width < 43.5); }).map((el) => (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 30) + ' ' + Math.round(el.getBoundingClientRect().width) + 'x' + Math.round(el.getBoundingClientRect().height)));
    assert.deepEqual(small, [], `botones < 44 px (${tag}): ` + small.join(' | '));
    await context.close();
    // E210-3: un nombre de 120 caracteres sin espacios no ensancha la página
    ({ context, page } = await open(width, lang, 'long'));
    await page.getByRole('heading', { level: 2, name: lang === 'es' ? 'Personas' : 'People' }).waitFor();
    assert.equal(await overflow(page), 0, `nombre de 120 caracteres sin desborde (${tag})`);
    await context.close();
    check(`botones ≥ 44 px y un nombre de 120 caracteres sin espacios no desborda (${tag})`);

    // accesibilidad: cada «Reintentar» dice su bloque
    ({ context, page } = await open(width, lang, 'full', { '/api/therapist/pacientes': 1, '/api/therapist/alerts': 1 }));
    await page.locator('section[aria-labelledby="panel-alerts-title"]').getByRole('alert').waitFor();
    const retryNames = await page.getByRole('button', { name: new RegExp('^' + (lang === 'es' ? 'Reintentar' : 'Try again')) }).evaluateAll((els) => els.map((el) => el.getAttribute('aria-label') ?? el.textContent));
    assert.equal(retryNames.length, 3, `tres «Reintentar» (resumen, personas, avisos) (${tag}): ` + retryNames.join(' | '));
    assert.equal(new Set(retryNames).size, 3, 'nombres accesibles distintos: ' + retryNames.join(' | '));
    assert.ok(retryNames.every((n) => n.startsWith(lang === 'es' ? 'Reintentar' : 'Try again')), 'el nombre empieza por el texto visible');
    await context.close();
    check(`cada «Reintentar» tiene nombre accesible propio (${tag}): ${retryNames.join(' | ')}`);

    // vacío y nadie comparte
    ({ context, page } = await open(width, lang, 'empty'));
    body = await text(page);
    assert.ok(lang === 'es' ? /Aún no tienes personas asignadas/.test(body) && /No hay sesiones próximas/.test(body) && /Sin avisos/.test(body) : /don't have people assigned/.test(body) && /No upcoming sessions/.test(body) && /No notices/.test(body), `vacíos con texto (${tag})`);
    await context.close();
    ({ context, page } = await open(width, lang, 'nobody'));
    body = await text(page);
    assert.ok((lang === 'es' ? body.match(/Sin datos/g) : body.match(/No data/g)).length >= 2, `nadie comparte: promedios «Sin datos» (${tag})`);
    assert.doesNotMatch(body, /\b0 de 5|\b0 of 5/);
    check(`vacío y nadie comparte ${tag}: textos de vacío y «Sin datos»`);
    await context.close();

    // cada bloque falla por separado y se reintenta
    for (const [endpoint, mine, others] of [
      ['/api/therapist/alerts', 'panel-alerts', ['panel-summary', 'panel-people', 'panel-upcoming']],
      ['/api/sessions/therapist/upcoming', 'panel-upcoming', ['panel-summary', 'panel-people', 'panel-alerts']],
      ['/api/therapist/pacientes', 'panel-people', ['panel-upcoming', 'panel-alerts']],
    ]) {
      ({ context, page } = await open(width, lang, 'full', { [endpoint]: 1 }));
      const box = page.locator(`section[aria-labelledby="${mine}-title"]`);
      await box.getByRole('alert').waitFor();
      assert.ok(await box.getByRole('button', { name: lang === 'es' ? 'Reintentar' : 'Try again' }).isVisible(), `reintentar en ${mine} (${tag})`);
      for (const other of others) assert.equal(await page.locator(`section[aria-labelledby="${other}-title"]`).getByRole('alert').count(), 0, `${other} no se ve afectado por el fallo de ${mine} (${tag})`);
      if (endpoint === '/api/therapist/pacientes') assert.equal(await page.locator('section[aria-labelledby="panel-summary-title"]').getByRole('alert').count(), 1, 'el resumen comparte el endpoint y también ofrece reintentar');
      await box.getByRole('button', { name: lang === 'es' ? 'Reintentar' : 'Try again' }).click();
      await box.getByRole('alert').waitFor({ state: 'detached' });
      await page.waitForFunction((id) => document.activeElement?.id === id, `${mine}-title`, { timeout: 3000 }).catch(() => { throw new Error(`tras reintentar con éxito el foco no va al título del bloque (${tag}, ${mine})`); });
      await context.close();
    }
    check(`un bloque falla y los demás siguen (alertas, sesiones, personas) ${tag}; «Reintentar» recupera y mueve el foco al título`);

    // el error se mantiene y el foco queda en «Reintentar» si el reintento vuelve a fallar
    ({ context, page } = await open(width, lang, 'full', { '/api/therapist/alerts': 2 }));
    const alertsBox = page.locator('section[aria-labelledby="panel-alerts-title"]');
    const retry = alertsBox.getByRole('button', { name: lang === 'es' ? 'Reintentar' : 'Try again' });
    await retry.waitFor(); await retry.click();
    await alertsBox.getByRole('alert').waitFor();
    await page.waitForFunction(() => document.activeElement?.tagName === 'BUTTON' && /Reintentar|Try again/.test(document.activeElement.textContent ?? ''));
    check(`reintento que vuelve a fallar ${tag}: el foco queda en «Reintentar»`);
    await context.close();

    // validación y guía: el error ya no se traga
    ({ context, page } = await open(width, lang, 'full', { '/api/therapist/prompt': 1, '/api/therapist/validation/status': 1 }));
    assert.equal(await page.getByRole('alert').count() >= 2, true, `validación y guía muestran su error (${tag})`);
    await context.close();
  }

  assert.deepEqual(errors, [], 'errores de consola o de página: ' + errors.join(' | '));
  console.log(`\nES-177 B1: ${checks.length} comprobaciones (ES/EN × 390/1360) OK`);
  await browser.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
