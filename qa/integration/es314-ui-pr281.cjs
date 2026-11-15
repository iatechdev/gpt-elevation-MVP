// [QA-Claude] ES-314 · PR #281 (etiquetas legibles de las respuestas de emparejamiento en la cola del equipo) · Chromium real contra el server.js REAL (PostgreSQL desechable, migraciones, build real servido por el backend). Datos sintéticos, 0 IA.
//   QA_SUT=<repo con frontend/dist ya compilado> QA314_DB=postgres://... OUT=<capturas> PLAYWRIGHT_MODULE=<ruta> PLAYWRIGHT_BROWSERS_PATH=<ruta> AXE_PATH=<axe.min.js> node qa/integration/es314-ui-pr281.cjs
const fs = require('fs'); const path = require('path');
const E = process.env; const SUT = path.join(E.QA_SUT || 'C:/Users/Usuario/Documents/qa-pr-test'); const OUT = E.OUT || '.'; fs.mkdirSync(OUT, { recursive: true });
const { startRealApi } = require(path.join(SUT, 'backend/test/support/realApi.cjs')); process.chdir(path.join(SUT, 'backend'));
const { chromium } = require(E.PLAYWRIGHT_MODULE || 'playwright'); const AXE = fs.readFileSync(E.AXE_PATH, 'utf8');
const hooks = []; const t = { after: (fn) => hooks.push(fn) }; const results = [];
const check = (id, ok, d = '') => { results.push({ id, ok: !!ok }); console.log(JSON.stringify({ id, ok: !!ok, detail: String(d).slice(0, 900) })); };
const info = (id, d) => console.log(JSON.stringify({ id, info: String(d).slice(0, 1200) }));
// Etiquetas esperadas (texto del catálogo de la pantalla de Progreso, ya existente salvo los 8 nuevos que acepta Infra)
const L = {
  area: { anxiety: ['Estrés y carga', 'Stress and workload'], depression: ['Depresión', 'Depression'], relationships: ['Relaciones', 'Relationships'], 'self-knowledge': ['Autoconocimiento', 'Self-knowledge'], habits: ['Hábitos', 'Habits'], 'personal growth': ['Crecimiento personal', 'Personal growth'], stress: ['Manejo del estrés', 'Stress management'], other: ['Otro', 'Other'] },
  style: { reflective: ['Reflexivo y exploratorio', 'Reflective and exploratory'], structured: ['Estructurado con objetivos', 'Structured with goals'], spiritual: ['Espiritual', 'Spiritual'], practical: ['Práctico', 'Practical'], 'reflective and exploratory': ['Reflexivo y exploratorio', 'Reflective and exploratory'], 'structured with goals': ['Estructurado con objetivos', 'Structured with goals'], 'empathetic and listening': ['Empático y de escucha', 'Empathetic and listening'], any: ['Cualquier estilo', 'Any style'] },
  language: { es: ['Español', 'Spanish'], en: ['Inglés', 'English'], both: ['Español e inglés', 'Spanish and English'], Spanish: ['Español', 'Spanish'], English: ['Inglés', 'English'], 'No preference': ['Sin preferencia', 'No preference'] },
};
const ROWS = [['anxiety', 'reflective', 'es'], ['depression', 'structured', 'en'], ['relationships', 'spiritual', 'both'], ['self-knowledge', 'practical', 'Spanish'], ['habits', 'reflective and exploratory', 'English'], ['personal growth', 'structured with goals', 'No preference'], ['stress', 'empathetic and listening', 'es'], ['other', 'any', 'en']];
const RAW_KEYS = /\banxiety\b|\bdepression\b|self-knowledge|personal growth|reflective and exploratory|structured with goals|empathetic and listening|\bboth\b|Ansiedad|\bpr_[a-z_]+/;
(async () => {
  const { q, mkUser, http, base } = await startRealApi(t, { envVar: 'QA314_DB', prefix: 'qa314' });
  const th = await mkUser('therapist'); const A = await mkUser('admin'); const S = await mkUser('superadmin');
  const seed = async (answersJson) => { const u = await mkUser('user'); const name = (await q('SELECT name FROM "Users" WHERE id=$1', [u.id]))[0].name;
    await q(`INSERT INTO "MatchingRequests" ("UserId", answers, suggestions, "chosenTherapistId", status, "createdAt", "updatedAt") VALUES ($1, $2, '[]', $3, 'pending', now(), now())`, [u.id, answersJson, th.id]); return { u, name }; };
  const browser = await chromium.launch({ headless: true });
  const open = async (who, url, { lang = 'es', vp = { width: 1360, height: 900 }, scheme = 'light' } = {}) => {
    const ctx = await browser.newContext({ viewport: vp, colorScheme: scheme });
    await ctx.addInitScript(([tk, r, l]) => { try { localStorage.setItem('elevation_token', tk); localStorage.setItem('elevation_role', r); localStorage.setItem('elv_lang', l); localStorage.setItem('elevation_lang', l); } catch { /* */ } }, [who.token, who.role, lang]);
    const page = await ctx.newPage(); const reqs = []; const errs = []; const dialogs = [];
    page.on('request', (r) => reqs.push({ m: r.method(), u: r.url(), b: r.postData() })); page.on('pageerror', (e) => errs.push(e.message)); page.on('dialog', (d) => { dialogs.push(d.message()); void d.dismiss(); });
    await page.goto(base + url); await page.waitForTimeout(1800); return { ctx, page, reqs, errs, dialogs };
  };
  const matchingTab = async (page) => { await page.getByRole('tab', { name: /Emparejamientos|Matches/i }).first().click({ timeout: 8000 }); await page.waitForTimeout(700); };
  const axeOn = async (page) => { await page.evaluate(AXE); const r = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })); return r.violations.map((v) => v.id + '(' + v.nodes.length + ')'); };

  // ── T1 · una solicitud por cada valor del catálogo ──
  const seeded = []; for (const [a, s, l] of ROWS) seeded.push({ a, s, l, ...(await seed(JSON.stringify({ area: a, style: s, language: l }))) });
  const bad = []; let okRows = 0; let views = 0;
  for (const [role, who] of [['admin', A], ['superadmin', S]]) for (const lang of ['es', 'en']) for (const w of [390, 1360]) {
    const o = await open(who, '/admin/users', { lang, vp: { width: w, height: 900 } }); views += 1;
    try { await matchingTab(o.page); const all = await o.page.locator('main').innerText();
      if (RAW_KEYS.test(all)) bad.push(`${role}/${lang}/${w}: clave cruda visible «${(all.match(RAW_KEYS) || [''])[0]}»`);
      for (const r of seeded) { const row = (await o.page.locator('li', { hasText: r.name }).first().innerText({ timeout: 4000 }).catch(() => '')).replace(/\s+/g, ' ');
        const i = lang === 'es' ? 0 : 1; const want = [L.area[r.a][i], L.style[r.s][i], L.language[r.l][i]];
        if (!row) bad.push(`${role}/${lang}/${w}: no está la fila de ${r.name}`); else if (want.every((x) => row.includes(x))) okRows += 1; else bad.push(`${role}/${lang}/${w}: ${r.a}/${r.s}/${r.l} → «${row.slice(0, 160)}»`); }
      if (o.errs.length) bad.push(`${role}/${lang}/${w}: error de página ${o.errs[0].slice(0, 80)}`);
      await o.page.screenshot({ path: path.join(OUT, `314-cola-${role}-${lang}-${w}.png`) }); } catch (e) { bad.push(`${role}/${lang}/${w}: ${String(e.message).slice(0, 100)}`); }
    await o.ctx.close(); }
  check('T1 cola del equipo: cada valor del catálogo (8 áreas, 8 estilos, 6 idiomas) con su etiqueta ES/EN, como admin y superadmin × ES/EN × 390/1360; sin claves crudas ni «Ansiedad»/«anxiety»', bad.length === 0 && okRows === ROWS.length * views, bad.join(' | ').slice(0, 800) || `${okRows}/${ROWS.length * views} filas × ${views} vistas`);

  // ── T2 · valores raros de solicitudes antiguas ──
  const weird = [['desconocido', { area: 'foo-bar', style: 'x', language: 'zz' }], ['vacío', { area: '', style: '', language: '' }], ['ausente', {}], ['mayúsculas', { area: 'ANXIETY', style: 'Reflective', language: 'ES' }], ['html', { area: '<img src=x onerror=alert(1)>', style: '<b>x</b>', language: '"><script>alert(2)</script>' }], ['largo', { area: 'a'.repeat(300), style: 'b'.repeat(80), language: 'c' }], ['número', { area: 123, style: 4.5, language: true }], ['objeto', { area: { a: 1 }, style: [1, 2], language: null }]];
  const wseed = []; for (const [k, v] of weird) wseed.push({ k, v, ...(await seed(JSON.stringify(v))) }); const wbad = []; const wshow = [];
  const nonJson = await seed('no es json'); const nullAns = await q(`SELECT 1`);
  { const o = await open(S, '/admin/users', { lang: 'es' }); await matchingTab(o.page);
    for (const r of wseed) { const row = (await o.page.locator('li', { hasText: r.name }).first().innerText({ timeout: 4000 }).catch(() => '')).replace(/\s+/g, ' '); wshow.push(`${r.k}: ${row.slice(row.indexOf('Área'), row.indexOf('Área') + 110)}`); if (!row) wbad.push(`${r.k}: no se pinta la fila`); }
    const rowNJ = (await o.page.locator('li', { hasText: nonJson.name }).first().innerText({ timeout: 4000 }).catch(() => '')).replace(/\s+/g, ' '); wshow.push('answers no JSON: ' + rowNJ.slice(rowNJ.indexOf('Área'), rowNJ.indexOf('Área') + 80)); if (!rowNJ) wbad.push('answers no JSON: no se pinta la fila');
    const injected = await o.page.evaluate(() => !!document.querySelector('img[src="x"], script:not([src]):not([type])') && document.querySelectorAll('img[src="x"]').length > 0);
    if (o.dialogs.length) wbad.push('se disparó un diálogo (XSS): ' + o.dialogs.join(','));
    if (injected) wbad.push('se inyectó HTML'); if (o.errs.length) wbad.push('error de página: ' + o.errs[0].slice(0, 80));
    const objShown = wshow.find((s) => s.startsWith('objeto')) || ''; if (/\[object Object\]/.test(objShown)) info('T2c OBSERVACIÓN (Bajo): un valor que es un objeto se muestra «[object Object]»; no rompe la pantalla (en main un objeto como hijo de React la rompería) y el servidor no deja guardar objetos (400)', objShown);
    await o.ctx.close(); }
  check('T2 valores raros (desconocido, vacío, ausente, mayúsculas, HTML, largo, número, objeto, answers no JSON): se pintan como texto o «—», sin romper ni XSS', wbad.length === 0, wbad.join(' | ') || 'ok'); info('T2b cómo se ven', wshow.join(' || '));

  // ── T6/T3 · cuestionario de la persona (Progreso): mismas opciones y mismos valores enviados ──
  const P = await mkUser('user');
  { const o = await open(P, '/app/progress', { lang: 'es' });
    await o.page.getByRole('button', { name: /Encontrar profesional|Find a professional/i }).first().click({ timeout: 8000 }); await o.page.waitForTimeout(500);
    const sels = await o.page.evaluate(() => [...document.querySelectorAll('dialog select, [role=dialog] select')].map((s) => [...s.options].map((x) => [x.value, x.textContent])));
    const wantEs = { area: [['anxiety', 'Estrés y carga'], ['depression', 'Depresión'], ['relationships', 'Relaciones'], ['personal growth', 'Crecimiento personal'], ['stress', 'Manejo del estrés'], ['other', 'Otro']], style: [['reflective and exploratory', 'Reflexivo y exploratorio'], ['structured with goals', 'Estructurado con objetivos'], ['empathetic and listening', 'Empático y de escucha'], ['any', 'Cualquier estilo']], language: [['Spanish', 'Español'], ['English', 'Inglés'], ['No preference', 'Sin preferencia']] };
    const got = { area: (sels[0] || []).filter((x) => x[0]), style: (sels[1] || []).filter((x) => x[0]), language: (sels[2] || []).filter((x) => x[0]) };
    const same = JSON.stringify(got) === JSON.stringify(wantEs);
    check('T6 el cuestionario de la persona ofrece las MISMAS opciones, en el MISMO orden y con los MISMOS textos que antes (6 áreas, 4 estilos, 3 idiomas; valor enviado → texto ES)', same, same ? 'idénticas' : JSON.stringify(got).slice(0, 500));
    const selects = o.page.locator('dialog select, [role=dialog] select'); await selects.nth(0).selectOption('anxiety'); await selects.nth(1).selectOption('reflective and exploratory'); await selects.nth(2).selectOption('Spanish');
    const wait = o.page.waitForResponse((r) => /\/api\/matching\/request/.test(r.url()), { timeout: 8000 }).catch(() => null); await o.page.getByRole('button', { name: /Encontrar mi profesional|Find my professional/i }).last().click(); const resp = await wait;
    const post = o.reqs.find((r) => r.m === 'POST' && /\/api\/matching\/request/.test(r.u)); const sent = post && JSON.parse(post.b);
    check('T3 el navegador envía exactamente answers {area:"anxiety", style:"reflective and exploratory", language:"Spanish"} (valores del contrato, no etiquetas) y el servidor real no los rechaza (≠ 400)', sent && JSON.stringify(sent.answers) === JSON.stringify({ area: 'anxiety', style: 'reflective and exploratory', language: 'Spanish' }) && resp && resp.status() !== 400, post ? post.b + ' → ' + (resp && resp.status()) : 'sin petición');
    await o.ctx.close(); }
  { const r1 = await http(P, 'POST', '/api/matching/request', { answers: { area: 'anxiety', style: 'reflective', language: 'es' } }); const r2 = await http(P, 'POST', '/api/matching/request', { answers: { area: 'Estrés y carga', style: 'reflective', language: 'es' } });
    check('T3b servidor real: la clave se acepta (≠ 400) y la etiqueta se rechaza (400): sin cambio de contrato', r1.status !== 400 && r2.status === 400, `clave → ${r1.status}; etiqueta → ${r2.status}`); }

  // ── T4 · cambio de idioma EN CALIENTE con el selector del marco (sin recargar) ──
  { const o = await open(A, '/admin/users', { lang: 'es' }); await matchingTab(o.page); const es = (await o.page.locator('li', { hasText: seeded[0].name }).first().innerText()).replace(/\s+/g, ' ');
    const sw = o.page.getByRole('button', { name: /^(EN|English|Inglés)$/i }).first(); const sel = o.page.locator('select').filter({ hasText: /English|Inglés/ }).first(); let done = false;
    if (await sw.count()) { await sw.click(); done = true; } else if (await sel.count()) { await sel.selectOption({ label: /English/.test(await sel.innerText()) ? 'English' : 'Inglés' }).catch(() => {}); done = true; }
    await o.page.waitForTimeout(800); const en = done ? (await o.page.locator('li', { hasText: seeded[0].name }).first().innerText().catch(() => '')).replace(/\s+/g, ' ') : '';
    if (!done) info('T4 no encontré un selector de idioma en el marco para probar el cambio en caliente (la carga en frío ES/EN ya la cubre T1)', ''); else check('T4 cambio de idioma EN CALIENTE: «Estrés y carga» → «Stress and workload» en la cola, sin recargar y sin claves', /Estrés y carga/.test(es) && /Stress and workload/.test(en) && !RAW_KEYS.test(en), `${es.slice(0, 80)} || ${en.slice(0, 80)}`); await o.ctx.close(); }

  // T8 se mide con filas de catálogo (válidas); las filas patológicas de T2 (p. ej. 300 caracteres sin espacios, que el servidor ya no deja guardar) se retiran y se miden aparte (T8c)
  { const o = await open(S, '/admin/users', { lang: 'en', vp: { width: 320, height: 700 } }); await matchingTab(o.page); const ov = await o.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); info('T8c con las filas patológicas de T2 presentes (valor de 300 caracteres sin espacios) a 320 px: desborde horizontal de ' + ov + ' px; la línea de detalle no lleva overflow-wrap y el diff del PR no toca su estilo (preexistente; el servidor limita hoy los valores a 60 caracteres)', ov); await o.ctx.close(); }
  await q('DELETE FROM "MatchingRequests" WHERE "UserId" = ANY($1)', [[...wseed.map((r) => r.u.id), nonJson.u.id]]);
  // ── T8 · accesibilidad de la pestaña del equipo ──
  { const viol = []; let n = 0;
    for (const lang of ['es', 'en']) for (const w of [390, 1360]) for (const scheme of ['light', 'dark']) { const o = await open(S, '/admin/users', { lang, vp: { width: w, height: 900 }, scheme }); await matchingTab(o.page); const v = await axeOn(o.page); n += 1; if (v.length) viol.push(`${lang}/${w}/${scheme}: ${v.join(',')}`); await o.ctx.close(); }
    info('T8a axe WCAG A/AA/2.1/2.2 AA en la pestaña Emparejamientos (' + n + ' combinaciones)', viol.length ? viol.join(' | ') : '0 violaciones'); results.push({ id: 'T8a', ok: viol.length === 0 });
    const o = await open(S, '/admin/users', { lang: 'en', vp: { width: 320, height: 700 } }); await matchingTab(o.page); const ov = await o.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check('T8b 320 px (EN, etiquetas más largas): sin desborde horizontal', ov <= 0, `desborde ${ov}px`); await o.ctx.close(); }

  fs.writeFileSync(path.join(OUT, 'ES-314-281.json'), JSON.stringify(results)); console.log('RESUMEN ' + results.filter((r) => r.ok).length + '/' + results.length);
  await browser.close(); for (const h of hooks.reverse()) await h(); process.exit(0);
})().catch((e) => { console.error('FATAL', e.stack); process.exit(1); });
