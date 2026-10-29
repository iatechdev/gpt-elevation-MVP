// ES-110: navegador real (Chromium aislado), frontera HTTP simulada, aplicación React construida. Datos sintéticos.
//   npm run build && npx vite preview --port 4110 --host 127.0.0.1   y luego   PLAYWRIGHT_MODULE=... node scripts/es110-browser.cjs
const assert = require('node:assert/strict');
(async () => {
  const source = process.env.PLAYWRIGHT_MODULE;
  const { chromium } = source ? require(source) : await import('playwright');
  const base = process.env.ES110_PREVIEW_URL ?? 'http://127.0.0.1:4110';
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Solo vista previa local');
  const browser = await chromium.launch({ headless: true });
  const checks = []; const check = (label) => { checks.push(label); console.log('PASS ' + label); };
  const errors = [];

  const stamp = '2026-10-12T12:00:00.000Z';
  const state = { evidence: [], skills: [], promoteCalls: [], putCalls: [], deleted: [], failPromoteOnce: false, nextId: 100 };
  const reset = () => {
    state.promoteCalls = []; state.putCalls = []; state.deleted = []; state.failPromoteOnce = false; state.nextId = 100;
    state.evidence = [
      { id: 1, version: 1, status: 'confirmed', authoring: 'person', createdAt: '2026-10-01T12:00:00.000Z', payload: { title: 'Rediseño del onboarding', goal: 'Reducir abandono', delivered: { text: 'Flujo nuevo', source: 'self_report' }, observedEffect: { known: false } } },
      { id: 2, version: 1, status: 'confirmed', authoring: 'person', createdAt: '2026-10-02T12:00:00.000Z', fromChat: true, payload: { title: 'Evidencia desde el chat', goal: 'Meta' } },
    ];
    const cls = (key, es, en) => ({ skillKey: key, labels: { es, en } });
    state.skills = [
      { name: 'Power BI', support: 'Construí tableros en Power BI para el equipo comercial', classified: cls('power_bi', 'Power BI', 'Power BI'), resume: { id: 31, version: 3, createdAt: stamp }, added: false },
      { name: 'SQL', support: 'Consultas SQL para reportes semanales', classified: cls('sql', 'SQL', 'SQL'), resume: { id: 31, version: 3, createdAt: stamp }, added: false },
      { name: 'Gestión de proyectos', support: 'Coordiné lanzamientos con 4 equipos', classified: cls('gestion_proyectos', 'Gestión de proyectos', 'Project management'), resume: { id: 31, version: 3, createdAt: stamp }, added: false },
      { name: 'Storytelling con datos', support: 'Presentaciones ejecutivas con datos', classified: null, resume: { id: 31, version: 3, createdAt: stamp }, added: false },
      { name: 'Excel', support: null, classified: cls('excel', 'Excel', 'Excel'), resume: { id: 31, version: 3, createdAt: stamp }, added: false },
      { name: 'Python', support: 'Scripts de Python', classified: cls('python', 'Python', 'Python'), resume: { id: 31, version: 3, createdAt: stamp }, added: true },
    ];
  };

  async function open(width, height = 900, lang = 'es') {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', acceptDownloads: true });
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) errors.push(message.text()); });
    await page.addInitScript((l) => { localStorage.setItem('elevation_token', 'synthetic-browser-token'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l); }, lang);
    await page.route('**/api/**', async (route) => {
      const req = route.request(); const url = new URL(req.url()); const p = url.pathname; const m = req.method();
      if (p === '/api/user/resume-skills') return route.fulfill({ json: { skills: state.skills } });
      if (p === '/api/user/resume-skills/promote' && m === 'POST') {
        const body = req.postDataJSON(); state.promoteCalls.push(body);
        if (state.failPromoteOnce) { state.failPromoteOnce = false; return route.fulfill({ status: 500, json: { code: 'internal_error' } }); }
        const created = [];
        for (const name of body.names) {
          const skill = state.skills.find((s) => s.name === name); if (!skill || skill.added) continue; skill.added = true;
          const id = state.nextId++; created.push({ id, name, skillKey: skill.classified.skillKey, replayed: false });
          state.evidence.push({ id, version: 1, status: 'draft', authoring: 'person', createdAt: new Date().toISOString(), payload: { title: name, artifactRefs: [{ kind: 'text', excerpt: skill.support }] }, origin: { kind: 'resume', version: skill.resume.version, date: skill.resume.createdAt, needsReview: false } });
        }
        return route.fulfill({ json: { created, skipped: [] } });
      }
      const one = p.match(/^\/api\/evidence\/(\d+)$/);
      if (one) {
        const id = Number(one[1]); const row = state.evidence.find((e) => e.id === id);
        if (m === 'DELETE') { state.deleted.push(id); state.evidence = state.evidence.filter((e) => e.id !== id); return route.fulfill({ json: { deleted: true } }); }
        if (m === 'PUT') { const body = req.postDataJSON(); state.putCalls.push(body); const next = { ...row, version: row.version + 1, payload: body.payload, status: body.status, createdAt: new Date().toISOString() }; state.evidence = state.evidence.map((e) => (e.id === id ? next : e)); return route.fulfill({ status: 201, json: { id, version: next.version, status: next.status, created: true } }); }
        if (!row) return route.fulfill({ status: 404, json: { code: 'evidence_not_found' } });
        return route.fulfill({ json: { id, currentVersion: row.version, versions: [row] } });
      }
      if (p === '/api/evidence') return route.fulfill({ json: { evidence: state.evidence } });
      return route.fulfill({ json: {} });
    });
    return { context, page };
  }
  const noOverflow = async (page, label) => { const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); assert.ok(o <= 0, `${label}: desborde horizontal de ${o}px`); };

  try {
    // ── 1. Mis evidencias: aviso de habilidades por revisar ─────────────────────────────────────────────────────────────────────────
    reset(); let { context, page } = await open(1280);
    await page.goto(base + '/app/evidence');
    await page.getByRole('heading', { name: 'Tienes habilidades de tu hoja de vida por revisar' }).waitFor();
    await page.getByText('Ninguna se añade sin tu confirmación.').waitFor(); check('«Mis evidencias» avisa de las habilidades de la hoja de vida por revisar y que ninguna se añade sin confirmación');
    await page.getByRole('heading', { name: 'Rediseño del onboarding' }).waitFor(); assert.equal(await page.getByRole('link', { name: /^Editar: Evidencia desde el chat/ }).count(), 0); check('lo que viene del chat no ofrece «Editar» (la edición perdería su origen)');

    // ── 2. Bandeja: nada marcado, sin nivel, declarada ≠ respaldada por forma ───────────────────────────────────────────────────────
    await page.getByRole('link', { name: 'Revisar habilidades' }).click();
    await page.getByRole('heading', { name: 'Habilidades de tu hoja de vida' }).waitFor(); await page.getByText('Todavía no es evidencia', { exact: false }).waitFor();
    const boxes = page.locator('input[type="checkbox"]'); assert.equal(await boxes.count(), 6);
    for (let i = 0; i < 6; i++) assert.equal(await boxes.nth(i).isChecked(), false); await page.getByText('Ninguna está marcada. Marca solo las que quieras.').waitFor(); check('ninguna habilidad viene marcada por defecto');
    await page.getByText('Seleccionadas: 0').waitFor(); assert.equal(await page.getByRole('button', { name: 'Añadir a Mis evidencias' }).isDisabled(), true); check('con 0 seleccionadas el botón está desactivado');
    const legend = await page.evaluate(() => { const b = [...document.querySelectorAll('.evidence-legend .evidence-badge')]; const s = b.map((e) => getComputedStyle(e)); return { dashed: s[0].borderTopStyle, solidBg: s[1].backgroundColor, fill: b[1].querySelector('svg') !== null, dot: b[0].querySelector('svg') !== null }; });
    assert.equal(legend.dashed, 'dashed'); assert.notEqual(legend.solidBg, 'rgba(0, 0, 0, 0)'); assert.ok(legend.fill && legend.dot); check('«declarada» (borde punteado) y «respaldada» (relleno y marca) se distinguen por FORMA, no solo por color');
    await page.getByText('Se clasificaría como:').first().waitFor(); await page.getByText('Consultas SQL para reportes semanales').first().waitFor(); await page.getByText('Hoja de vida v3 · 12 oct 2026').first().waitFor(); check('cada fila muestra con qué se clasifica, el texto exacto que la respalda y su origen');
    assert.equal(await page.getByLabel(/Storytelling con datos/).isDisabled(), true); await page.getByText('Sin clasificar: no coincide con el catálogo.').waitFor(); check('lo que no está en el catálogo se muestra «sin clasificar» y no se puede añadir');
    assert.equal(await page.getByLabel(/^Excel/).isDisabled(), true); await page.getByText('No encontramos la frase de tu hoja de vida que la respalda').waitFor();
    assert.equal(await page.getByLabel(/^Python/).isDisabled(), true); await page.getByText('Ya está en «Mis evidencias».').waitFor(); check('sin texto de respaldo o ya añadida: desactivada con su motivo');
    assert.equal(await page.getByText(/nivel [1-4]|level [1-4]/i).count(), 0); check('ninguna fila muestra nivel');

    // ── 3. Elegir y confirmar (con teclado), diálogo accesible ──────────────────────────────────────────────────────────────────────
    await page.getByLabel(/^Power BI/).focus(); await page.keyboard.press('Space'); await page.getByLabel(/^SQL/).focus(); await page.keyboard.press('Space');
    await page.getByText('Seleccionadas: 2').waitFor(); const reviewBtn = page.getByRole('button', { name: 'Revisar y añadir 2' }); assert.equal(await reviewBtn.isEnabled(), true); check('marcar con el teclado actualiza el contador y el botón');
    await reviewBtn.focus(); await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog'); await dialog.waitFor(); assert.equal(await dialog.evaluate((el) => el === document.activeElement), true);
    await dialog.getByText('Nivel: sin definir.').waitFor(); await dialog.getByText('Tu hoja de vida no demuestra dominio; el nivel se define con evidencia.').waitFor(); await dialog.getByText('Cada una guarda de dónde viene (tu hoja de vida v3) y el texto exacto que la respalda.').waitFor();
    check('el diálogo resume qué se añade, su origen y «Nivel: sin definir»; el foco entra en el diálogo');
    for (let n = 0; n < 8; n++) { await page.keyboard.press('Tab'); assert.equal(await dialog.evaluate((el) => el.contains(document.activeElement)), true, 'Tab salió del diálogo'); }
    for (let n = 0; n < 8; n++) { await page.keyboard.press('Shift+Tab'); assert.equal(await dialog.evaluate((el) => el.contains(document.activeElement)), true, 'Shift+Tab salió del diálogo'); } check('el diálogo atrapa Tab y Shift+Tab (QA-110: el foco no sale)');
    await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' }); assert.equal(await reviewBtn.evaluate((el) => el === document.activeElement), true); check('Escape cierra el diálogo y devuelve el foco al botón que lo abrió');
    if (process.env.ES110_SHOTS) await page.screenshot({ path: process.env.ES110_SHOTS + '/bandeja.png', fullPage: true });
    await noOverflow(page, 'bandeja escritorio');

    // ── 4. Fallo y reintento con el MISMO requestId; luego éxito ──────────────────────────────────────────────────────────────────
    state.failPromoteOnce = true; await reviewBtn.click(); await page.getByRole('button', { name: 'Añadir 2 evidencias' }).click();
    await page.getByRole('alert').getByText('No se duplicó nada').waitFor(); await page.getByRole('button', { name: 'Añadir 2 evidencias' }).click();
    await page.waitForURL('**/app/evidence'); assert.equal(state.promoteCalls.length, 2); assert.equal(state.promoteCalls[0].requestId, state.promoteCalls[1].requestId); assert.deepEqual(state.promoteCalls[1].names, ['Power BI', 'SQL']);
    assert.deepEqual(Object.keys(state.promoteCalls[1]).sort(), ['names', 'requestId']); check('si falla, el reintento usa el mismo requestId y solo envía nombres (nada de niveles)');
    await page.getByText('Añadimos 2 evidencias desde tu hoja de vida.').waitFor(); await page.getByText('Si algo no te convence, edítalas o bórralas cuando quieras.').waitFor(); check('al terminar se avisa de lo añadido');

    // ── 5. Mis evidencias: origen, nivel sin definir, declarada ─────────────────────────────────────────────────────────────────
    const card = page.locator('article', { has: page.getByRole('heading', { name: 'Power BI' }) });
    await card.getByText('Desde tu hoja de vida · v3 · 12 oct 2026').waitFor(); await card.getByText('Nivel sin definir').waitFor(); await card.getByText('Declarada', { exact: true }).waitFor();
    await card.getByText('Para respaldarla, cuenta una situación real en «Editar».').waitFor(); await card.getByText('Construí tableros en Power BI para el equipo comercial').waitFor(); check('cada evidencia creada muestra su origen, «Nivel sin definir», «Declarada» y el texto que la respalda');
    assert.equal(await page.getByRole('heading', { name: 'Tienes habilidades de tu hoja de vida por revisar' }).count(), 1); // queda Gestión de proyectos
    if (process.env.ES110_SHOTS) await page.screenshot({ path: process.env.ES110_SHOTS + '/lista.png', fullPage: true });
    await noOverflow(page, 'lista escritorio');

    // ── 6. Editar (versión nueva) y borrar con confirmación ────────────────────────────────────────────────────────────────────
    await page.getByRole('link', { name: /^Editar: Power BI/ }).click();
    await page.getByRole('heading', { name: 'Editar evidencia' }).waitFor(); await page.getByText('Al guardar se crea una versión nueva').waitFor(); assert.equal(await page.locator('#title').inputValue(), 'Power BI');
    assert.equal(await page.locator('#artifactRefs textarea').first().inputValue(), 'Construí tableros en Power BI para el equipo comercial'); check('«Editar» abre el formulario con lo guardado, incluido el texto de respaldo');
    await page.locator('#situation').fill('Tableros mensuales para ventas'); await page.getByRole('button', { name: 'Guardar borrador' }).click(); await page.getByRole('heading', { name: 'Borrador guardado' }).waitFor();
    const put = state.putCalls.at(-1); assert.equal(put.baseVersion, 1); assert.equal(put.payload.situation, 'Tableros mensuales para ventas'); assert.deepEqual(Object.keys(put).sort(), ['baseVersion', 'payload', 'requestId', 'status']); check('guardar una edición envía baseVersion y nunca origen ni autor (el servidor conserva el origen)');
    await page.goto(base + '/app/evidence'); const sql = page.locator('article', { has: page.getByRole('heading', { name: 'SQL' }) });
    const del = sql.getByRole('button', { name: /^Borrar: SQL/ }); await del.click(); const alertDialog = sql.getByRole('alertdialog'); await alertDialog.waitFor(); assert.equal(await alertDialog.evaluate((el) => el === document.activeElement), true);
    await sql.getByText('Se elimina de verdad').waitFor(); await sql.getByRole('button', { name: 'Cancelar' }).click(); assert.equal(await del.evaluate((el) => el === document.activeElement), true); assert.deepEqual(state.deleted, []); check('borrar pide confirmación, cancelar devuelve el foco y no borra nada');
    await del.click(); await sql.getByRole('button', { name: 'Sí, borrar' }).click(); await page.getByText('Evidencia borrada.').first().waitFor(); assert.deepEqual(state.deleted, [state.evidence.length ? state.deleted[0] : 0]); await sql.waitFor({ state: 'detached' }); check('confirmar borra la evidencia y lo anuncia');

    // ── 7. «Para revisión»: la hoja de vida de origen ya no existe ─────────────────────────────────────────────────────────────────
    state.evidence.find((e) => e.payload.title === 'Power BI').origin.needsReview = true; await page.reload();
    const review = page.locator('article', { has: page.getByRole('heading', { name: 'Power BI' }) });
    await review.getByText('Para revisión', { exact: true }).waitFor(); await review.getByText('Borraste la hoja de vida de donde salió esta evidencia (v3).', { exact: false }).waitFor(); await review.getByText('Nada se borra solo: tú decides qué hacer con cada una.').waitFor();
    const reviewColor = await review.locator('.evidence-review').evaluate((el) => getComputedStyle(el).backgroundColor); assert.notEqual(reviewColor, 'rgba(0, 0, 0, 0)'); check('si se borró la hoja de vida de origen, la evidencia sigue y queda «Para revisión» sin borrarse sola');
    await context.close();

    // ── 8. Estados: cargando, vacío y error de la bandeja ──────────────────────────────────────────────────────────────────────────
    reset(); state.skills = []; ({ context, page } = await open(375));
    await page.goto(base + '/app/evidence/resume-skills'); await page.getByRole('heading', { name: 'No hay habilidades para revisar.' }).waitFor(); await page.getByText('Tu hoja de vida no las mencionaba o ya las revisaste.').waitFor(); await noOverflow(page, 'vacío 375'); check('estado vacío con la razón y un camino');
    await context.close();
    reset(); ({ context, page } = await open(375)); await page.route('**/api/user/resume-skills', (route) => route.fulfill({ status: 503, json: { code: 'x' } }));
    await page.goto(base + '/app/evidence/resume-skills'); await page.getByRole('alert').getByText('No pudimos cargar tus habilidades.').waitFor(); await page.getByText('Tus evidencias siguen intactas.').waitFor(); await page.getByRole('button', { name: 'Reintentar' }).waitFor(); check('estado de error: dice que las evidencias siguen intactas y permite reintentar');
    await context.close();

    // ── 9. Móvil 320/375 y inglés ──────────────────────────────────────────────────────────────────────────────────────────────────
    for (const width of [320, 375]) {
      reset(); ({ context, page } = await open(width)); await page.goto(base + '/app/evidence/resume-skills'); await page.getByRole('heading', { name: 'Habilidades de tu hoja de vida' }).waitFor(); await noOverflow(page, `bandeja ${width}`);
      await page.getByLabel(/^Power BI/).check(); await page.getByRole('button', { name: 'Revisar y añadir 1' }).click(); const dlg = page.getByRole('dialog'); await dlg.waitFor();
      const box = await dlg.boundingBox(); assert.ok(box.x >= 0 && box.x + box.width <= width, `diálogo ${width}: ${JSON.stringify(box)}`); const btn = await dlg.getByRole('button', { name: 'Añadir 1 evidencias' }).boundingBox(); assert.ok(btn.height >= 44 && btn.width >= 44);
      await noOverflow(page, `diálogo ${width}`); await context.close();
    }
    check('bandeja y diálogo caben a 320 y 375 px, con botones de 44 px');
    reset(); ({ context, page } = await open(1280, 900, 'en')); await page.goto(base + '/app/evidence/resume-skills');
    await page.getByRole('heading', { name: 'Skills from your résumé' }).waitFor(); await page.getByText('None is ticked. Tick only the ones you want.').waitFor(); await page.getByText('Would be classified as:').first().waitFor();
    await page.getByLabel(/^Gestión de proyectos/).check(); await page.getByRole('button', { name: 'Review and add 1' }).click(); await page.getByText('Level: not defined.').waitFor(); await page.getByText('Your résumé does not prove mastery; level is defined through evidence.').waitFor();
    await page.getByText('Project management').first().waitFor(); check('en inglés los textos, el nivel «sin definir» y la clasificación salen en inglés'); await context.close();

    assert.deepEqual(errors, [], 'errores de consola: ' + errors.join(' | ')); check('sin errores de consola');
  } finally { await browser.close(); }
  console.log(`\n${checks.length} comprobaciones superadas`);
})().catch((error) => { console.error('FALLO:', error.message); process.exit(1); });
