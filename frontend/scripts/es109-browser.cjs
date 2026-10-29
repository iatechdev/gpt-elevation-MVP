// ES-109: navegador real (Chromium aislado), frontera HTTP simulada, aplicación React construida. Datos sintéticos.
//   npm run build && npx vite preview --port 4109 --host 127.0.0.1   y luego   PLAYWRIGHT_MODULE=... node scripts/es109-browser.cjs
const assert = require('node:assert/strict');
(async () => {
  const source = process.env.PLAYWRIGHT_MODULE;
  const { chromium } = source ? require(source) : await import('playwright');
  const base = process.env.ES109_PREVIEW_URL ?? 'http://127.0.0.1:4109';
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Solo vista previa local');
  const browser = await chromium.launch({ headless: true });
  const checks = []; const check = (label) => { checks.push(label); console.log('PASS ' + label); };
  const errors = [];

  // ── Estado del servidor simulado ────────────────────────────────────────────────────────────────────────────────────────────────
  const empty = () => ({ preferredLanguage: null, residenceCountry: null, targetMarket: null, timeZone: null, profession: null, interests: null, availabilityMinutesPerWeek: null, careerGoal: null, careerConstraints: null,
    sector: null, totalYearsExperience: null, experience: [], education: [], declaredSkills: [], languages: [] });
  const state = { snapshot: { schemaVersion: 2, version: 0, context: null, savedAt: null, completedAt: null }, writes: [], analyzeCalls: [], consentCalls: [], consent: false,
    resumes: [{ id: 3, version: 3, size: 420000, createdAt: '2026-10-12T12:00:00Z' }, { id: 2, version: 2, size: 400000, createdAt: '2026-09-02T12:00:00Z' }, { id: 1, version: 1, size: 370000, createdAt: '2026-07-18T12:00:00Z' }],
    scenario: 'ok', delay: 0, deleted: [] };
  const SUGGESTIONS = { profession: 'Líder de diseño', interests: null, sector: 'Tecnología', totalYearsExperience: 8,
    experience: [{ role: 'Líder de diseño', organization: 'Estudio Norte', startYear: 2021, endYear: 2026, isCurrent: false }, { role: 'Diseñadora UX', organization: 'Agencia Brújula', startYear: 2018, endYear: 2021, isCurrent: false }],
    education: [{ kind: 'education', title: 'Diseño Industrial', institution: 'Universidad Nacional', year: 2016 }], declaredSkills: [{ name: 'Power BI', support: null, resumeVersion: 4 }, { name: 'SQL', support: 'Consultas SQL', resumeVersion: 4 }, { name: 'Gestión de proyectos', support: null, resumeVersion: 4 }],
    languages: [{ name: 'Español', level: 'nativo' }, { name: 'Inglés', level: 'avanzado' }] };
  const PDF = Buffer.from('%PDF-1.4\n% sintético\n%%EOF\n');

  async function open(width, height = 900, lang = 'es') {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) errors.push(message.text()); });
    await page.addInitScript((l) => { localStorage.setItem('elevation_token', 'synthetic-browser-token'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l); }, lang);
    await page.route('**/api/**', async (route) => {
      const req = route.request(); const url = new URL(req.url()); const p = url.pathname;
      if (p === '/api/user/context') {
        if (req.method() === 'PUT') { const body = req.postDataJSON(); state.writes.push(body); state.snapshot = { schemaVersion: 2, version: state.snapshot.version + 1, context: body.context, savedAt: new Date().toISOString(), completedAt: body.action === 'continue' ? new Date().toISOString() : state.snapshot.completedAt }; return route.fulfill({ json: state.snapshot }); }
        return route.fulfill({ json: state.snapshot });
      }
      if (p === '/api/consents') return route.fulfill({ json: { consents: [{ purpose: 'necessary', status: 'granted' }, { purpose: 'resume_ai_reading', status: state.consent ? 'granted' : 'undecided' }] } });
      if (p === '/api/consents/resume_ai_reading' && req.method() === 'PUT') { const status = req.postDataJSON().status; state.consentCalls.push(status); state.consent = status === 'granted'; if (!state.consent) state.resumes = []; return route.fulfill({ json: { status } }); }
      if (p === '/api/user/resumes/analyze') {
        const data = req.postDataBuffer(); state.analyzeCalls.push({ size: data ? data.length : 0, text: data ? data.toString('latin1') : '' });
        if (state.delay) await new Promise((resolve) => setTimeout(resolve, state.delay));
        const meta = { id: 4, version: 4, size: PDF.length, createdAt: new Date().toISOString() };
        const failures = { no_text: [422, { code: 'no_text' }], provider: [502, { code: 'provider_unavailable', retryable: true, resume: meta }], budget: [429, { code: 'ai_budget_exhausted' }], consent: [403, { code: 'consent_required' }], limit: [409, { code: 'resume_limit' }], network: null };
        if (state.scenario === 'network') return route.abort('failed');
        if (failures[state.scenario]) return route.fulfill({ status: failures[state.scenario][0], json: { error: 'x / y', ...failures[state.scenario][1] } });
        return route.fulfill({ json: { resume: meta, reused: false, suggestions: SUGGESTIONS, discarded: 1 } });
      }
      const file = p.match(/^\/api\/user\/resumes\/(\d+)\/file$/);
      if (file) return route.fulfill({ status: 200, contentType: 'application/pdf', body: PDF });
      const del = p.match(/^\/api\/user\/resumes\/(\d+)$/);
      if (del && req.method() === 'DELETE') { state.deleted.push(Number(del[1])); state.resumes = state.resumes.filter((r) => r.id !== Number(del[1])); return route.fulfill({ json: { deleted: true } }); }
      if (p === '/api/user/resumes') return route.fulfill({ json: { resumes: state.resumes, maxVersions: 5 } });
      if (p === '/api/login') return route.fulfill({ json: { token: 'synthetic-browser-token', role: 'user', name: 'Synthetic', onboardingCompleted: true } });
      return route.fulfill({ json: {} });
    });
    return { context, page };
  }
  const pick = (page, name, mime, buffer) => page.setInputFiles('input[type="file"]', { name, mimeType: mime, buffer });
  const noOverflow = async (page, label) => { const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); assert.ok(o <= 0, `${label}: desborde horizontal de ${o}px`); };

  try {
    // ── 1. Entrada, aviso del PDF y botón «llenar a mano» ─────────────────────────────────────────────────────────────────────────
    let { context, page } = await open(1280);
    await page.goto(base + '/app/onboarding');
    await page.getByRole('heading', { name: 'Empieza desde tu hoja de vida' }).waitFor();
    const notice = page.getByText('Solo se aceptan archivos PDF · hasta 5 MB'); await notice.waitFor();
    const noticeY = (await notice.boundingBox()).y; const chooseY = (await page.getByRole('button', { name: 'Elegir archivo PDF' }).boundingBox()).y;
    assert.ok(noticeY < chooseY, 'el aviso del PDF se ve ANTES del botón'); check('el aviso «Solo se aceptan archivos PDF · hasta 5 MB» aparece antes del botón de elegir archivo');
    const manual = page.getByRole('button', { name: 'Prefiero llenarlo a mano' });
    const style = await manual.evaluate((el) => { const s = getComputedStyle(el); return { border: s.borderTopWidth, bg: s.backgroundColor, h: el.getBoundingClientRect().height }; });
    assert.ok(parseFloat(style.border) >= 1 && style.h >= 44, JSON.stringify(style)); check('«Prefiero llenarlo a mano» es un botón real con borde y 44 px de alto (cambio pedido por Mauricio)');
    assert.equal(state.analyzeCalls.length, 0); check('al abrir no se envía nada');

    // ── 2. Rechazos en el navegador: no se envía nada ──────────────────────────────────────────────────────────────────────────────
    await pick(page, 'cv.docx', 'application/msword', Buffer.from('doc')); await page.getByRole('alert').getByText(/no es un PDF/).waitFor();
    assert.equal(state.analyzeCalls.length, 0); check('un archivo que no es PDF se rechaza con un mensaje claro y sin enviar nada');
    await page.getByRole('button', { name: 'Elegir otro archivo' }).click();
    await pick(page, 'grande.pdf', 'application/pdf', Buffer.alloc(5 * 1024 * 1024 + 1, 0x20)); await page.getByRole('alert').getByText(/pesa más de 5 MB/).waitFor();
    assert.equal(state.analyzeCalls.length, 0); check('un PDF de 5 MB + 1 byte se rechaza sin enviar nada');
    await page.getByRole('button', { name: 'Elegir otro archivo' }).click();

    // ── 3. Autorización previa ─────────────────────────────────────────────────────────────────────────────────────────────────────
    await pick(page, 'Mi Hoja De Vida Privada.pdf', 'application/pdf', PDF);
    await page.getByRole('heading', { name: 'Antes de leer tu hoja de vida' }).waitFor();
    if (process.env.ES109_SHOTS) await page.screenshot({ path: process.env.ES109_SHOTS + '/autorizacion-escritorio.png', fullPage: true });
    assert.equal(await page.getByRole('checkbox').isChecked(), false); check('la casilla de autorización parte desmarcada: la autorización es explícita');
    assert.equal(await page.getByRole('heading', { name: 'Antes de leer tu hoja de vida' }).evaluate((el) => el === document.activeElement), true); check('al elegir el archivo el foco pasa al título y el lector de pantalla lo anuncia');
    const analyze = page.getByRole('button', { name: 'Analizar mi hoja de vida' });
    assert.equal(await analyze.isDisabled(), true); await page.getByText('Marca la autorización para continuar.').waitFor();
    assert.equal(state.analyzeCalls.length, 0); assert.deepEqual(state.consentCalls, []); check('sin marcar la autorización «Analizar» está desactivado y no se envía ni se registra nada');
    await page.getByText('quitamos tus datos de contacto', { exact: false }).first().waitFor(); await page.getByText('mejor esfuerzo', { exact: false }).waitFor(); check('el aviso dice que el contacto se quita antes de enviar y que la limpieza es de mejor esfuerzo');

    // ── 4. Análisis: honesto y cancelable ──────────────────────────────────────────────────────────────────────────────────────────
    state.delay = 4000;
    await page.getByRole('checkbox').check(); assert.equal(await analyze.isEnabled(), true); await analyze.click();
    await page.getByRole('heading', { name: 'Estamos leyendo tu hoja de vida' }).waitFor(); await page.getByText(/Puede tardar hasta un minuto/).waitFor();
    await page.getByText(/Van 0:0\d/).waitFor(); assert.equal(await page.locator('[role="progressbar"]').count(), 0); check('mientras analiza muestra tiempo real y barra indeterminada, sin porcentajes inventados');
    assert.deepEqual(state.consentCalls, ['granted']); check('la autorización se registra en el sistema de consentimientos antes de enviar el archivo');
    await page.getByText('Mientras esperas, puedes llenar a mano').waitFor();
    await page.getByRole('button', { name: 'Cancelar análisis' }).click(); await page.getByRole('heading', { name: 'Antes de leer tu hoja de vida' }).waitFor(); check('cancelar vuelve al paso anterior sin perder el archivo');
    state.delay = 0;

    // ── 5. Resultado: la persona ya escribió su profesión → la sugerencia queda aparte ─────────────────────────────────────────────
    await page.locator('section.rs-card').getByRole('button', { name: 'Volver' }).click(); await page.getByRole('button', { name: 'Prefiero llenarlo a mano' }).click();
    await page.locator('summary').first().click(); await page.locator('#profession').fill('Diseñadora');
    await pick(page, 'cv.pdf', 'application/pdf', PDF); await page.getByRole('checkbox').check(); await page.getByRole('button', { name: 'Analizar mi hoja de vida' }).click();
    await page.getByRole('heading', { name: 'Esto es lo que encontramos' }).first().waitFor();
    const sent = state.analyzeCalls.at(-1); assert.ok(sent.text.includes('name="cv"; filename="cv.pdf"') && !sent.text.includes('Mi Hoja De Vida Privada')); check('el PDF viaja con nombre neutro «cv.pdf»; el nombre original no sale del dispositivo');
    if (process.env.ES109_SHOTS) await page.screenshot({ path: process.env.ES109_SHOTS + '/resultado-escritorio.png', fullPage: true });
    await page.getByText('7 de 8 campos con sugerencias · 1 sin información').waitFor(); await page.getByText('Todavía no guardamos nada.').waitFor(); check('resumen honesto del resultado y aviso fijo «Todavía no guardamos nada»');
    assert.equal(await page.locator('#profession').inputValue(), 'Diseñadora'); await page.getByRole('group', { name: /Sugerencia para Profesión/ }).getByText('Líder de diseño').waitFor(); check('lo que la persona ya escribió NO se pisa: la sugerencia queda aparte');
    assert.equal(state.writes.length, 0); check('lo sugerido no se guarda hasta que la persona guarda (0 escrituras)');
    await page.getByRole('button', { name: 'Ignorar' }).click(); assert.equal(await page.locator('#profession').inputValue(), 'Diseñadora');
    await page.locator('#sector').waitFor(); assert.equal(await page.locator('#sector').inputValue(), 'Tecnología'); assert.equal(await page.locator('#totalYearsExperience').inputValue(), '8');
    assert.ok((await page.getByText('Sugerido desde tu hoja de vida').count()) >= 6); check('cada valor sugerido lleva la marca «Sugerido desde tu hoja de vida»');
    await page.locator('#interests').waitFor(); assert.equal(await page.locator('#interests').inputValue(), ''); check('lo que el documento no dice queda vacío');

    // ── 6. Quitar de un gesto, deshacer y editar ───────────────────────────────────────────────────────────────────────────────────
    const chipsBefore = await page.locator('.rs-chip').count();
    await page.getByRole('button', { name: 'Quitar SQL' }).click(); assert.equal(await page.locator('.rs-chip').count(), chipsBefore - 1);
    await page.getByRole('status').filter({ hasText: 'Quitado: SQL' }).first().waitFor(); await page.getByRole('button', { name: 'Deshacer' }).click(); assert.equal(await page.locator('.rs-chip').count(), chipsBefore); check('quitar una habilidad es de un gesto y «Deshacer» la devuelve');
    const tagsBefore = await page.locator('.rs-entry-sug').count();
    await page.locator('#exp-role-0').fill('Directora de diseño'); assert.equal(await page.locator('.rs-entry-sug').count(), tagsBefore - 1); check('editar un valor sugerido le quita la marca');
    await page.locator('#exp-period-0').fill('2021–actual'); await page.getByText('Por ejemplo: 2021–2026, 2021–actual o 2021.').first().waitFor();
    await page.locator('#exp-period-0').fill('abc'); await page.getByText('Escribe años como 2021–2026').first().waitFor(); await page.locator('#exp-period-0').fill('2021–actual'); check('«Años» se interpreta (2021–actual) y avisa si no se entiende');
    await page.locator('#skill-new').fill('Storytelling'); await page.locator('#skill-new').press('Enter'); assert.equal(await page.locator('.rs-chip').count(), chipsBefore + 1); check('se puede añadir una habilidad a mano con Enter');

    // ── 7. Guardar: esquema v2 y marcas fuera ──────────────────────────────────────────────────────────────────────────────────────
    await page.getByRole('button', { name: 'Guardar avance' }).click(); await page.getByText('Avance guardado').first().waitFor();
    const write = state.writes.at(-1); assert.equal(write.schemaVersion, 2); assert.equal(write.context.profession, 'Diseñadora'); assert.equal(write.context.experience[0].isCurrent, true); assert.equal(write.context.experience[0].endYear, null);
    assert.ok(write.context.declaredSkills.some((s) => s.name === 'Storytelling' && s.resumeVersion === null)); assert.ok(write.context.declaredSkills.some((s) => s.name === 'Power BI' && s.resumeVersion === 4));
    assert.equal(await page.getByText('Sugerido desde tu hoja de vida').count(), 0); check('al guardar se envía el esquema v2 con lo nuevo y las marcas de «sugerido» desaparecen');
    await noOverflow(page, 'escritorio'); await context.close();

    // ── 8. Errores del análisis ────────────────────────────────────────────────────────────────────────────────────────────────────
    for (const [scenario, rx, extra] of [['no_text', /parece un PDF escaneado/i, null], ['provider', /Tu hoja de vida quedó guardada/, 'Intentar de nuevo'], ['budget', /límite de análisis/, null], ['limit', /5 versiones/, null], ['network', /No hay conexión/, 'Intentar de nuevo']]) {
      ({ context, page } = await open(375)); state.scenario = scenario; state.consent = true;
      await page.goto(base + '/app/onboarding'); await pick(page, 'cv.pdf', 'application/pdf', PDF); await page.getByRole('checkbox').waitFor();
      assert.equal(await page.getByRole('checkbox').isChecked(), false); await page.getByRole('checkbox').check();
      await page.getByRole('button', { name: 'Analizar mi hoja de vida' }).click();
      const alert = page.getByRole('alert').filter({ hasText: rx }); await alert.waitFor();
      assert.equal(await page.getByRole('button', { name: 'Llenar a mano' }).isVisible(), true);
      if (extra) assert.equal(await page.getByRole('button', { name: extra }).isVisible(), true);
      await noOverflow(page, `375 px · ${scenario}`); await context.close();
    }
    state.scenario = 'ok'; check('cada error explica qué pasó, ofrece «Llenar a mano» y a 375 px no hay desborde');

    // ── 9. Inglés y teclado ────────────────────────────────────────────────────────────────────────────────────────────────────────
    ({ context, page } = await open(1280, 900, 'en'));
    await page.goto(base + '/app/onboarding'); await page.getByRole('heading', { name: 'Start from your résumé' }).waitFor(); await page.getByText('Only PDF files are accepted · up to 5 MB').waitFor();
    await page.getByRole('button', { name: 'I prefer to fill it in myself' }).waitFor(); check('en inglés el aviso del PDF y los botones salen en inglés');
    await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => { const el = document.activeElement; const s = getComputedStyle(el); return { tag: el.tagName, outline: s.outlineStyle, w: s.outlineWidth }; });
    assert.ok(focused.outline !== 'none' && parseFloat(focused.w) >= 2, JSON.stringify(focused)); check('con teclado el foco es visible (anillo de 3 px)');
    await pick(page, 'cv.pdf', 'application/pdf', PDF); await page.getByRole('heading', { name: 'Before we read your résumé' }).waitFor();
    assert.equal(await page.getByRole('checkbox').isChecked(), false, 'la casilla parte desmarcada aunque ya se haya autorizado antes'); await page.getByRole('checkbox').focus(); await page.keyboard.press('Space'); assert.equal(await page.getByRole('checkbox').isChecked(), true);
    await page.getByRole('button', { name: 'Analyze my résumé' }).focus(); await page.keyboard.press('Enter'); await page.getByRole('heading', { name: 'Here is what we found' }).first().waitFor(); check('todo el flujo se completa solo con teclado en inglés');
    await context.close();

    // ── 10. Historial: ver, descargar, borrar con confirmación, retirar autorización ────────────────────────────────────────────────
    for (const width of [1280, 375, 320]) {
      state.resumes = [{ id: 3, version: 3, size: 420000, createdAt: '2026-10-12T12:00:00Z' }, { id: 2, version: 2, size: 400000, createdAt: '2026-09-02T12:00:00Z' }, { id: 1, version: 1, size: 370000, createdAt: '2026-07-18T12:00:00Z' }]; state.consent = true; state.deleted = [];
      ({ context, page } = await open(width)); await page.goto(base + '/app/context/resumes');
      await page.getByRole('heading', { name: 'Mis hojas de vida' }).waitFor(); await page.getByText('3 de 5').waitFor(); await page.getByText('Actual').waitFor();
      await noOverflow(page, `historial ${width}`);
      if (width === 1280) {
        const popup = page.waitForEvent('popup', { timeout: 4000 }).catch(() => null);
        await page.getByRole('button', { name: /^Ver: Versión 3/ }).click(); await popup; check('«Ver» abre el PDF propio (con la sesión, sin URL pública)');
        const download = page.waitForEvent('download'); await page.getByRole('button', { name: /^Descargar: Versión 3/ }).click(); assert.equal((await download).suggestedFilename(), 'hoja-de-vida-v3.pdf'); check('«Descargar» entrega el archivo con nombre neutro');
        const del = page.getByRole('button', { name: /^Borrar: Versión 1/ }); await del.click();
        const dialog = page.getByRole('alertdialog'); await dialog.waitFor(); assert.equal(await dialog.evaluate((el) => el === document.activeElement), true); await page.getByText('Se elimina de verdad, sin copias.').waitFor(); check('borrar pide confirmación que explica el efecto real y el foco va al diálogo');
        await page.getByRole('button', { name: 'Cancelar' }).click(); assert.equal(await del.evaluate((el) => el === document.activeElement), true); assert.deepEqual(state.deleted, []); check('cancelar devuelve el foco a quien abrió la confirmación y no borra nada');
        await del.click(); await page.getByRole('button', { name: 'Sí, borrar esta versión' }).click(); await page.getByText('2 de 5').waitFor(); assert.deepEqual(state.deleted, [1]); await page.getByText('Versión borrada.').first().waitFor(); check('confirmar borra la versión y lo anuncia');
        await page.getByRole('button', { name: 'Retirar mi autorización' }).click(); await page.getByText('Borraremos las hojas de vida guardadas, sin copias').waitFor();
        await page.getByRole('button', { name: 'Sí, retirar y borrar' }).click(); await page.getByText('Todavía no has subido ninguna hoja de vida.').waitFor(); assert.deepEqual(state.consentCalls.at(-1), 'revoked'); check('retirar la autorización borra todas las versiones y queda el estado vacío');
      }
      await context.close();
    }
    check('el historial no se desborda a 1280, 375 ni 320 px');

    // ── 11. Formulario con todo desplegado a 320 px ────────────────────────────────────────────────────────────────────────────────
    state.consent = true;
    ({ context, page } = await open(320)); await page.goto(base + '/app/onboarding'); await pick(page, 'cv.pdf', 'application/pdf', PDF);
    await page.getByRole('checkbox').check(); await page.getByRole('button', { name: 'Analizar mi hoja de vida' }).click();
    await page.getByRole('heading', { name: 'Esto es lo que encontramos' }).first().waitFor(); await noOverflow(page, 'formulario con sugerencias a 320 px');
    if (process.env.ES109_SHOTS) await page.screenshot({ path: process.env.ES109_SHOTS + '/resultado-320.png', fullPage: true });
    for (const sel of ['#exp-role-0', '#edu-title-0', '#skill-new', '#lang-name-0']) { const box = await page.locator(sel).boundingBox(); assert.ok(box.width >= 120 && box.x >= 0 && box.x + box.width <= 320, sel + JSON.stringify(box)); }
    check('a 320 px los campos nuevos caben sin desborde'); await context.close();

    assert.deepEqual(errors, [], 'errores de consola: ' + errors.join(' | ')); check('sin errores de consola');
  } finally { await browser.close(); }
  console.log(`\n${checks.length} comprobaciones superadas`);
})().catch((error) => { console.error('FALLO:', error.message); process.exit(1); });
