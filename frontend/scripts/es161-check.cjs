// ES-161: «Analizar mi evidencia con IA» (tres pasos) y «Revocar todos» dentro de /app/skill-map, con el sistema Cartografía. Chromium, API simulada (page.route), datos sintéticos, IA simulada (0 llamadas reales).
// Mide: pasos (indicador con paso actual y hechos), elegir (0 elegidas = «Analizar» deshabilitado, contador), analizando (cancelable), revisar (propuesta con nivel «n de 4», razón, cita, avisos,
// opciones aceptar/bajar/sin evaluar/no guardar, nunca subir), guardar (cuerpo exacto), guardado, sin evidencias, errores (límite, proveedor, vencida, cambió, respuesta perdida con el MISMO requestId, sesión vencida)
// y el diálogo de revocación (foco que entra y vuelve, Esc), con axe wcag2a+wcag2aa+wcag21aa+wcag22aa en ES/EN × 390/1360 × claro/oscuro.
// Uso: npx vite build && npx vite preview --host 127.0.0.1 --port 4161 --strictPort   y luego
//   ES161_URL=http://127.0.0.1:4161 PLAYWRIGHT_MODULE=<ruta a playwright> AXE_PATH=<axe.min.js> node scripts/es161-check.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');

(async () => {
  const { chromium } = process.env.PLAYWRIGHT_MODULE ? require(process.env.PLAYWRIGHT_MODULE) : await import('playwright');
  const base = process.env.ES161_URL ?? 'http://127.0.0.1:4161';
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Solo vista previa local');
  const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8');
  const browser = await chromium.launch({ headless: true });
  const errors = []; let count = 0;
  const check = (label) => { count++; console.log('PASS ' + label); };
  const T = {
    es: { open: 'Analizar mi evidencia con IA', go: 'Analizar', cancel: 'Cancelar', save: 'Guardar las aceptadas', retry: 'Intentar de nuevo', fresh: 'Pedir una propuesta nueva', budget: 'límite de análisis', analyzing: 'Analizando tu evidencia', tag: 'Propuesta de la IA', level: 'nivel 3 de 4', revokeAll: 'Revocar todos', revokeTitle: '¿Revocar todos los permisos?', revokeCancel: 'Cancelar', done: 'Guardado', noev: 'Primero necesitas una evidencia confirmada', steps: 'Pasos' },
    en: { open: 'Analyze my evidence with AI', go: 'Analyze', cancel: 'Cancel', save: 'Save the accepted ones', retry: 'Try again', fresh: 'Ask for a new proposal', budget: 'analysis limit', analyzing: 'Analyzing your evidence', tag: 'AI proposal', level: 'level 3 of 4', revokeAll: 'Revoke all', revokeTitle: 'Revoke all permissions?', revokeCancel: 'Cancel', done: 'Saved', noev: 'You first need a confirmed evidence item', steps: 'Steps' },
  };
  const track = (level) => (level ? { level, state: 'initial', stale: false, catalogOutdated: false, confidence: 'medium', confidenceReason: { es: 'Respaldo sintético', en: 'Synthetic support' }, evidenceCount: 2, authoring: 'person', rationale: null, needsReview: false } : null);
  const SKILLS = Array.from({ length: 6 }, (_, i) => ({ skillKey: 'sint_' + i, type: 'transversal', labels: { es: `Capacidad sintética ${i + 1}`, en: `Synthetic skill ${i + 1}` }, territories: [['dir', 'con', 'com'][i % 3]],
    rubric: { levels: Object.fromEntries([1, 2, 3, 4].map((n) => [String(n), { es: `Criterio del nivel ${n}`, en: `Level ${n} criterion` }])), source: 'sintético', verifiedAt: '2026-11-01' }, self: track(i === 1 ? 2 : i === 0 ? 3 : null), review: null, state: i < 2 ? 'initial' : 'no_evidence' }));
  const EVIDENCE = [1, 2].map((id) => ({ id, version: 1, status: 'confirmed', authoring: 'person', createdAt: '2026-11-01T10:00:00Z',
    payload: { title: `Evidencia sintética ${id}`, situation: 'Situación sintética', responsibility: { text: 'Mi parte', source: 'self_report' }, actions: [{ text: 'Acción', source: 'self_report' }], delivered: { text: 'Entregable', source: 'self_report' }, observedEffect: { known: false }, autonomy: 'autonomous' } }));
  const proposed = () => ({ token: 'tok-sintetico', expiresAt: new Date(Date.now() + 600000).toISOString(),
    warnings: [{ skillKey: 'sint_0', code: 'level_capped' }],
    proposals: [
      { skillKey: 'sint_0', level: 3, evidenceRefs: [{ evidenceId: 1, version: 1, quote: 'Frase citada sintética' }], rationale: 'Razón sintética de la IA.', confidence: 'medium', confidenceReason: { es: 'Respaldo sintético', en: 'Synthetic support' } },
      { skillKey: 'sint_1', level: null, evidenceRefs: [], rationale: 'La evidencia aún no alcanza.', confidence: null, confidenceReason: null },
      { skillKey: 'sint_2', level: 2, evidenceRefs: [{ evidenceId: 2, version: 1 }], rationale: 'Otra razón sintética.', confidence: 'low', confidenceReason: { es: 'Poca evidencia', en: 'Little evidence' } },
    ] });

  async function open(width, lang, scheme, opts = {}) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const seen = { proposals: 0, confirm: [], revoke: 0 };
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
    await page.addInitScript(([l]) => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l); }, [lang]);
    await page.route('**/api/**', async (route) => {
      const request = route.request(); const p = new URL(request.url()).pathname;
      if (p === '/api/session') return route.fulfill({ json: { role: 'user', onboardingCompleted: true } });
      if (p === '/api/skill-map') return route.fulfill({ json: { catalogVersion: 1, skills: SKILLS } });
      if (p === '/api/evidence') return route.fulfill({ json: { evidence: opts.noEvidence ? [] : EVIDENCE } });
      if (p === '/api/consents' && request.method() === 'GET') return route.fulfill({ json: { consents: [{ purpose: 'professional_bridge', status: 'granted' }] } });
      if (p === '/api/consents/professional_bridge') { seen.revoke += 1; return route.fulfill({ json: {} }); }
      if (p === '/api/skill-map/proposals') {
        seen.proposals += 1;
        if (opts.delay) await new Promise((r) => setTimeout(r, opts.delay));
        const status = typeof opts.proposalStatus === 'function' ? opts.proposalStatus(seen.proposals) : (opts.proposalStatus ?? 200);
        return route.fulfill({ status, json: status === 200 ? proposed() : { code: opts.proposalCode ?? 'x' } });
      }
      if (p === '/api/skill-map/proposals/confirm') {
        seen.confirm.push(JSON.parse(request.postData() ?? '{}'));
        const status = typeof opts.confirmStatus === 'function' ? opts.confirmStatus(seen.confirm.length) : (opts.confirmStatus ?? 200);
        return route.fulfill({ status, json: status === 200 ? { created: true } : { code: 'x' } });
      }
      return route.fulfill({ json: [] });
    });
    await page.goto(base + '/app/skill-map', { waitUntil: 'networkidle' });
    return { context, page, seen };
  }
  const axe = async (page) => { await page.evaluate(axeSource); return page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] })).violations.map((v) => v.id + ':' + v.nodes.length)); };
  const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const openPanel = async (page, c) => { await page.getByRole('button', { name: c.open }).first().click(); await page.locator('.ai-panel').waitFor(); };
  const boxes = (page) => page.locator('.ai-panel input[type="checkbox"]');
  const uncheckAll = async (page) => { const n = await boxes(page).count(); for (let i = 0; i < n; i++) await boxes(page).nth(i).uncheck(); };
  const pickTwo = async (page) => { await uncheckAll(page); for (const i of [0, 1, 2]) await boxes(page).nth(i).check(); };
  const steps = (page) => page.locator('.ai-steps li');

  // 1. Camino completo: elegir → analizar → revisar → guardar → guardado (ES/EN × 390/1360 × claro/oscuro)
  for (const [width, lang, scheme] of [[390, 'es', 'light'], [390, 'en', 'dark'], [1360, 'es', 'dark'], [1360, 'en', 'light']]) {
    const tag = `${width}px ${lang} ${scheme}`; const c = T[lang];
    const { context, page, seen } = await open(width, lang, scheme, { delay: 350 });
    await openPanel(page, c);
    assert.equal(await page.locator('.ai-steps').getAttribute('aria-label'), c.steps, `lista de pasos con nombre (${tag})`);
    assert.equal(await steps(page).count(), 3); assert.equal(await page.locator('.ai-steps li[aria-current="step"]').count(), 1, `un paso actual (${tag})`);
    assert.equal(await page.locator('.ai-steps li[aria-current="step"]').evaluate((el) => [...el.parentElement.children].indexOf(el)), 0, `paso 1 actual (${tag})`);
    // elegir: la entrada general preselecciona hasta 8 capacidades; con cero elegidas «Analizar» está deshabilitado
    assert.equal(await page.locator('.ai-panel input[type="checkbox"]:checked').count(), 6, `la entrada general preselecciona las capacidades (${tag})`);
    await uncheckAll(page);
    assert.equal(await page.getByRole('button', { name: c.go, exact: true }).isDisabled(), true, `con cero capacidades elegidas «${c.go}» está deshabilitado (${tag})`);
    assert.deepEqual(await axe(page), [], `axe elegir (${tag})`);
    assert.ok((await overflow(page)) <= 0, `sin desborde (${tag})`);
    await pickTwo(page);
    assert.equal(await page.getByRole('button', { name: c.go, exact: true }).isEnabled(), true);
    await page.getByRole('button', { name: c.go, exact: true }).click();
    await page.getByText(new RegExp(c.analyzing)).waitFor(); assert.equal(await page.locator('.ai-steps li[aria-current="step"]').evaluate((el) => [...el.parentElement.children].indexOf(el)), 1, `paso 2 actual (${tag})`);
    assert.equal(await page.locator('.ai-steps li.is-done').count(), 1, `el paso 1 queda hecho (${tag})`);
    assert.deepEqual(await axe(page), [], `axe analizando (${tag})`);
    // revisar
    await page.locator('.ai-prop').first().waitFor(); assert.equal(await page.locator('.ai-prop').count(), 3, `tres propuestas (${tag})`);
    assert.equal(await page.locator('.ai-steps li[aria-current="step"]').evaluate((el) => [...el.parentElement.children].indexOf(el)), 2, `paso 3 actual (${tag})`);
    const first = page.locator('.ai-prop').first(); const text = await first.textContent();
    assert.ok(text.toLowerCase().includes(c.level), `nivel «n de 4» en palabras (${tag}): ${text.slice(0, 120)}`);
    assert.ok(text.includes('Razón sintética') || text.includes('Synthetic'), `razón visible (${tag})`);
    assert.ok(text.includes('Frase citada sintética'), `cita de la evidencia (${tag})`);
    assert.equal(await page.locator('.ai-prop').first().locator('.ai-tag').count(), 1, `etiqueta «${c.tag}» (${tag})`);
    assert.ok((await page.locator('.ai-warn').count()) >= 1, `aviso de nivel limitado o sin propuesta (${tag})`);
    // nunca subir: las opciones de la propuesta de nivel 3 son 3 (aceptar), 2, 1, sin evaluar, no guardar; ninguna por encima
    assert.equal(await first.locator('input[type="radio"]').count(), 5, `opciones de la propuesta de nivel 3 (${tag})`);
    assert.equal(await page.locator('.ai-prop').nth(1).locator('input[type="radio"]').count() >= 1, true);
    await page.locator('.ai-prop').first().locator('input[type="radio"]').nth(1).check(); // bajar a 2
    assert.deepEqual(await axe(page), [], `axe revisar (${tag})`);
    await page.getByRole('button', { name: c.save }).click();
    await page.getByText(c.done, { exact: true }).first().waitFor();
    assert.equal(seen.confirm.length, 1); const body = seen.confirm[0];
    assert.deepEqual(body.accept.sort(), ['sint_0', 'sint_2'], `solo se acepta lo elegido; la propuesta sin nivel no se guarda (${tag})`);
    assert.deepEqual(body.overrides, { sint_0: 2 }, `bajar a 2 viaja como override, nunca más alto (${tag})`);
    assert.ok(typeof body.requestId === 'string' && body.requestId.length >= 8 && body.token === 'tok-sintetico', `requestId y token (${tag})`);
    assert.deepEqual(await axe(page), [], `axe guardado (${tag})`);
    await context.close();
    check(`análisis (${tag}): pasos, cero elegidas deshabilitado, analizando, revisar (nivel «n de 4», razón, cita, avisos, no sube), guardar con cuerpo exacto, guardado, axe 0`);
  }

  // 1b. Cerrar el panel devuelve el foco al botón que lo abrió
  { const c = T.es; const { context, page } = await open(1360, 'es', 'light'); const opener = page.getByRole('button', { name: c.open }).first(); await opener.click(); await page.locator('.ai-panel').waitFor();
    await page.locator('.ai-panel').getByRole('button', { name: c.cancel }).click(); await page.locator('.ai-panel').waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(() => document.activeElement?.textContent?.trim()), c.open, 'cerrar el panel devuelve el foco al botón que lo abrió'); await context.close(); check('cerrar el panel devuelve el foco al botón que lo abrió'); }

  // 2. Sin evidencias confirmadas
  for (const [lang, scheme] of [['es', 'light'], ['en', 'dark']]) {
    const c = T[lang]; const { context, page, seen } = await open(390, lang, scheme, { noEvidence: true });
    await openPanel(page, c); await page.getByText(c.noev).first().waitFor();
    assert.equal(seen.proposals, 0, 'sin evidencias no se llama a la IA');
    assert.ok(await page.locator('.ai-panel a[href="/app/evidence"]').count() >= 1, 'enlace a Evidencias');
    assert.deepEqual(await axe(page), [], `axe sin evidencias (${lang})`); await context.close();
  }
  check('sin evidencias confirmadas: se explica cómo conseguirlas, enlace a Evidencias y no se llama a la IA');

  // 3. Errores: límite, proveedor (reintento), sesión vencida; lo elegido se conserva
  for (const [lang, scheme] of [['es', 'light'], ['en', 'dark']]) {
    const c = T[lang];
    { const { context, page } = await open(1360, lang, scheme, { proposalStatus: 429 });
      await openPanel(page, c); await pickTwo(page); await page.getByRole('button', { name: c.go, exact: true }).click();
      await page.getByRole('alert').filter({ hasText: /./ }).first().waitFor();
      assert.equal(await page.locator('.ai-panel input[type="checkbox"]:checked').count(), 3, `un fallo no borra lo elegido (${lang})`);
      assert.deepEqual(await axe(page), [], `axe error de límite (${lang})`); await context.close(); }
    { const { context, page, seen } = await open(1360, lang, scheme, { proposalStatus: (n) => (n === 1 ? 502 : 200), proposalCode: 'provider' });
      await openPanel(page, c); await pickTwo(page); await page.getByRole('button', { name: c.go, exact: true }).click();
      await page.getByRole('button', { name: c.retry }).waitFor(); await page.getByRole('button', { name: c.retry }).click(); await page.locator('.ai-prop').first().waitFor();
      assert.equal(seen.proposals, 2); await context.close(); }
    { const { context, page } = await open(390, lang, scheme, { proposalStatus: 401 });
      await openPanel(page, c); await pickTwo(page); await page.getByRole('button', { name: c.go, exact: true }).click();
      await page.getByRole('alert').filter({ hasText: /./ }).first().waitFor(); assert.ok(await page.locator('.ai-panel .ai-error a[href="/login"]').count() >= 1, `sesión vencida: enlace para entrar (${lang})`); await context.close(); }
    // guardado con respuesta perdida (500): reintento con el MISMO requestId; vencida y cambió: pedir una nueva
    { const { context, page, seen } = await open(1360, lang, scheme, { confirmStatus: (n) => (n === 1 ? 500 : 200) });
      await openPanel(page, c); await pickTwo(page); await page.getByRole('button', { name: c.go, exact: true }).click(); await page.locator('.ai-prop').first().waitFor();
      await page.getByRole('button', { name: c.save }).click(); await page.getByRole('button', { name: c.retry }).waitFor();
      assert.deepEqual(await axe(page), [], `axe respuesta perdida (${lang})`);
      await page.getByRole('button', { name: c.retry }).click(); await page.getByText(c.done, { exact: true }).first().waitFor();
      assert.equal(seen.confirm.length, 2); assert.equal(seen.confirm[0].requestId, seen.confirm[1].requestId, `el reintento usa el mismo requestId: no se duplica (${lang})`); await context.close(); }
    for (const status of [410, 409]) {
      const { context, page } = await open(1360, lang, scheme, { confirmStatus: status });
      await openPanel(page, c); await pickTwo(page); await page.getByRole('button', { name: c.go, exact: true }).click(); await page.locator('.ai-prop').first().waitFor();
      await page.getByRole('button', { name: c.save }).click(); await page.getByRole('button', { name: c.fresh }).waitFor(); await context.close();
    }
    check(`errores (${lang} ${scheme}): límite, proveedor con reintento, sesión vencida, respuesta perdida con el mismo requestId, vencida y cambió piden una propuesta nueva; lo elegido se conserva; axe 0`);
  }

  // 4. Diálogo de revocación: foco que entra y vuelve, Esc, axe
  for (const [width, lang, scheme] of [[390, 'es', 'dark'], [1360, 'en', 'light']]) {
    const tag = `${width}px ${lang} ${scheme}`; const c = T[lang];
    const { context, page, seen } = await open(width, lang, scheme);
    const trigger = page.getByRole('button', { name: c.revokeAll }).first(); await trigger.click();
    await page.getByRole('dialog', { name: c.revokeTitle }).waitFor();
    assert.equal(await page.evaluate(() => document.activeElement?.textContent?.trim()), c.revokeCancel, `el foco entra al diálogo en «${c.revokeCancel}» (${tag})`);
    assert.deepEqual(await axe(page), [], `axe diálogo (${tag})`);
    await page.keyboard.press('Escape'); await page.getByRole('dialog').waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(() => document.activeElement?.textContent?.trim()), c.revokeAll, `Esc cierra y devuelve el foco al botón (${tag})`);
    assert.equal(seen.revoke, 0, `cancelar no revoca (${tag})`);
    await context.close();
    check(`diálogo de revocación (${tag}): foco entra en Cancelar, axe 0, Esc cierra sin revocar y devuelve el foco`);
  }

  assert.deepEqual(errors, [], 'errores de consola o de página: ' + errors.join(' | '));
  console.log(`\nES-161: ${count} comprobaciones OK`);
  await browser.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
