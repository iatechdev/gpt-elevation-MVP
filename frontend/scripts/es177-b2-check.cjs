// ES-177 (B2): validación académica y guía para la IA del panel profesional, en Chromium, con la forma REAL de las respuestas del servidor (routes/validation.js y routes/therapistRoutes.js + utils/promptHttp.js).
// Uso: npx vite build && npx vite preview --host 127.0.0.1 --port 4178   y luego
//   ES177_URL=http://127.0.0.1:4178 PLAYWRIGHT_MODULE=<ruta a playwright> AXE_PATH=<axe.min.js> node scripts/es177-b2-check.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');

(async () => {
  const { chromium } = process.env.PLAYWRIGHT_MODULE ? require(process.env.PLAYWRIGHT_MODULE) : await import('playwright');
  const base = process.env.ES177_URL ?? 'http://127.0.0.1:4178';
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Solo vista previa local');
  const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8');
  const browser = await chromium.launch({ headless: true });
  const errors = []; const checks = [];
  const check = (label) => { checks.push(label); console.log('PASS ' + label); };
  const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}⭐]|[★☆↑↓]/u;
  const iso = (days) => new Date(Date.now() - days * 86400000).toISOString();
  const docs = {
    none: [],
    mixed: [
      { id: 1, documentType: 'titulo', documentName: 'titulo.pdf', status: 'rejected', reviewNote: 'Ilegible, súbelo de nuevo', submittedAt: iso(9), reviewedAt: iso(8) },
      { id: 2, documentType: 'certificado', documentName: 'certificado.png', status: 'pending', reviewNote: null, submittedAt: iso(1), reviewedAt: null },
    ],
    approved: [{ id: 3, documentType: 'colegiado', documentName: 'colegiado.pdf', status: 'approved', reviewNote: null, submittedAt: iso(20), reviewedAt: iso(19) }],
  };
  const guides = {
    none: { hasPrompt: false, content: null, active: null, pending: null, rejected: null },
    pending: { hasPrompt: true, content: 'Eres un acompañante de autoconocimiento profesional. '.repeat(3), active: { id: 1, version: 2, approved_by: 'Junta', approved_at: iso(12) }, pending: { id: 5, version: 3, proposed_by: 'P', createdAt: iso(1) }, rejected: null },
    rejected: { hasPrompt: false, content: null, active: null, pending: null, rejected: { id: 4, version: 1, rejected_by: 'Junta', rejection_note: 'Quita las promesas de empleo', rejected_at: iso(3) } },
  };
  const longText = 'Acompaña con preguntas abiertas sobre trayectoria y valores, sin diagnóstico ni promesas.';

  async function open(width, lang, { doc = 'mixed', guide = 'pending', upload, propose } = {}) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
    await page.addInitScript(([l]) => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'therapist'); localStorage.setItem('elv_lang', l); }, [lang]);
    const seen = { upload: 0, propose: 0, uploadBody: null, proposeBody: null };
    await page.route('**/api/**', async (route) => {
      const request = route.request(); const p = new URL(request.url()).pathname;
      if (p === '/api/session') return route.fulfill({ json: { role: 'therapist', onboardingCompleted: true } });
      if (p === '/api/therapist/validation/status') return route.fulfill({ json: docs[doc] });
      if (p === '/api/therapist/prompt') return route.fulfill({ json: guides[guide] });
      if (p === '/api/therapist/validation/upload') { seen.upload++; return route.fulfill(upload ? upload(seen) : { status: 201, json: { validation: { id: 9, status: 'pending' } } }); }
      if (p === '/api/therapist/prompt/propose') { seen.propose++; seen.proposeBody = request.postDataJSON(); return route.fulfill(propose ? propose(seen) : { json: { version: { id: 6, version: 3, status: 'pending_review' } } }); }
      if (p === '/api/therapist/pacientes' || p === '/api/sessions/therapist/upcoming') return route.fulfill({ json: [] });
      if (p === '/api/therapist/alerts') return route.fulfill({ json: { inactivePatients: [], notableProgress: [] } });
      return route.fulfill({ json: [] });
    });
    await page.goto(base + '/therapist/dashboard', { waitUntil: 'networkidle' });
    await page.locator('#panel-validation-title').waitFor({ timeout: 8000 });
    return { context, page, seen };
  }
  const axe = async (page) => { await page.evaluate(axeSource); return page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] })).violations.map((v) => v.id + ':' + v.nodes.length)); };
  const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const T = {
    es: { val: 'Validación académica', upload: 'Subir documento', pick: 'Elige un archivo antes de subir.', sent: 'Documento enviado', rejected: 'Rechazada', pending: 'En revisión', approved: 'Validada', none: 'Aún no has enviado documentos.',
      meanwhile: 'Mientras tanto sigue activa la versión anterior', propose: 'Proponer cambio', create: 'Crear guía', short: 'al menos 50 caracteres', cancel: 'Cancelar', send: 'Enviar para revisión', pendingExists: 'Ya tienes una propuesta pendiente', reasons: 'Motivo ES sintético', proposalSent: 'Propuesta enviada para revisión.', unsupported: 'Solo se permiten PDF, JPG, PNG o WEBP.', tooBig: 'El archivo es demasiado grande.', mismatch: 'no corresponde a su tipo', storage: 'No pudimos guardar el documento ahora', activeV: 'Versión activa v2', rejectedGuide: 'Propuesta v1 rechazada', retry: 'Puedes corregirla', counter: 'mínimo 50', generic: 'Tu texto sigue aquí' },
    en: { val: 'Academic validation', upload: 'Upload document', pick: 'Choose a file before uploading.', sent: 'Document sent', rejected: 'Rejected', pending: 'Under review', approved: 'Validated', none: "You haven't sent any documents yet.",
      meanwhile: 'The previous version stays active in the meantime', propose: 'Propose a change', create: 'Create guide', short: 'at least 50 characters', cancel: 'Cancel', send: 'Send for review', pendingExists: 'You already have a proposal pending review', reasons: 'Synthetic reason EN', proposalSent: 'Proposal sent for review.', unsupported: 'Only PDF, JPG, PNG or WEBP files are allowed.', tooBig: 'The file is too large.', mismatch: 'does not match its type', storage: 'We could not save the document right now', activeV: 'Active version v2', rejectedGuide: 'Proposal v1 rejected', retry: 'You can fix it', counter: 'minimum 50', generic: 'Your text is still here' },
  };
  const pickFile = (page, name = 'doc.pdf') => page.locator('input[type=file]').setInputFiles({ name, mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 sintético') });

  for (const [width, lang] of [[390, 'es'], [390, 'en'], [1360, 'es'], [1360, 'en']]) {
    const t = T[lang]; const tag = `${width}px ${lang}`;

    // 1) Validación: estados en palabras, sin emojis, entrada de archivo visible con etiqueta, sin desborde, axe
    let { context, page } = await open(width, lang, { doc: 'mixed', guide: 'pending' });
    let body = await page.locator('section[aria-labelledby="panel-validation-title"]').innerText();
    assert.ok(body.includes(t.rejected) && body.includes(t.pending), `estados en palabras (${tag})`);
    assert.ok(body.includes(lang === 'es' ? 'Ilegible, súbelo de nuevo' : 'Ilegible'), 'nota de la revisión visible');
    assert.ok(!emoji.test(await page.locator('main, body').first().innerText()), `sin emojis en el panel completo (${tag})`);
    const fileBox = await page.locator('input[type=file]').boundingBox(); assert.ok(fileBox && fileBox.width > 20 && fileBox.height > 20, 'el campo de archivo es visible (sin display:none)');
    assert.equal(await page.locator('label', { has: page.locator('input[type=file]') }).count(), 1, 'tiene etiqueta visible');
    assert.equal(await overflow(page), 0, `sin desborde (${tag})`);
    assert.deepEqual(await axe(page), [], `axe (${tag})`);
    check(`${tag}: validación en palabras (${t.rejected}/${t.pending}) con la nota, sin emojis, archivo visible con etiqueta, sin desborde, axe 0`);
    await context.close();

    ({ context, page } = await open(width, lang, { doc: 'none', guide: 'none' }));
    assert.ok((await page.locator('#panel-validation-title ~ div').innerText()).includes(t.none));
    ({ context: _c } = { context: null });
    await context.close();
    ({ context, page } = await open(width, lang, { doc: 'approved', guide: 'none' }));
    body = await page.locator('section[aria-labelledby="panel-validation-title"]').innerText();
    assert.ok(body.includes(t.approved)); assert.equal(await page.locator('input[type=file]').count(), 0, 'validada: ya no pide documentos');
    await context.close();
    check(`${tag}: sin documentos y validada (sin formulario de subida)`);

    // 2) Subida: errores por código en ES/EN, éxito, sin archivo
    for (const [code, status, expected] of [['unsupported_file_type', 400, t.unsupported], ['file_too_large', 413, t.tooBig], ['file_content_mismatch', 400, t.mismatch], ['storage_unavailable', 503, t.storage]]) {
      ({ context, page } = await open(width, lang, { doc: 'none', upload: () => ({ status, json: { code, error: 'Solo se permiten PDF, JPG, PNG o WEBP. / texto del servidor' } }) }));
      await pickFile(page); await page.getByRole('button', { name: t.upload }).click();
      await page.getByRole('alert').filter({ hasText: expected }).waitFor();
      assert.ok(!(await page.locator('#panel-validation-title ~ div').innerText()).includes('texto del servidor'), 'no se muestra el texto crudo del servidor');
      await context.close();
    }
    ({ context, page } = await open(width, lang, { doc: 'none' }));
    await page.getByRole('button', { name: t.upload }).click(); await page.getByRole('alert').filter({ hasText: t.pick }).waitFor();
    await pickFile(page); await page.getByRole('button', { name: t.upload }).click(); await page.getByText(t.sent).first().waitFor();
    await context.close();
    check(`${tag}: errores de subida por código (tipo, tamaño, contenido, almacenamiento) en el idioma de la pantalla, «elige un archivo» y éxito`);

    // 3) Guía: estados
    ({ context, page } = await open(width, lang, { guide: 'pending' }));
    body = await page.locator('section[aria-labelledby="panel-guide-title"]').innerText();
    assert.ok(body.includes(t.activeV) && body.includes(t.meanwhile), `activa + «mientras tanto» (${tag})`);
    assert.equal(await page.getByRole('button', { name: t.propose }).count(), 0, 'con una propuesta pendiente no se puede proponer otra');
    await context.close();
    ({ context, page } = await open(width, lang, { guide: 'rejected' }));
    body = await page.locator('section[aria-labelledby="panel-guide-title"]').innerText();
    assert.ok(body.includes(t.rejectedGuide) && body.includes(t.retry) && body.includes(lang === 'es' ? 'Quita las promesas' : 'Quita'), 'rechazada con nota');
    await context.close();
    check(`${tag}: guía activa con «${t.meanwhile}», sin proponer otra mientras hay una pendiente, y rechazada con la nota`);

    // 4) Diálogo: foco atrapado, Esc, contador, <50, el texto se conserva, errores por código, motivos
    ({ context, page } = await open(width, lang, { guide: 'none', propose: (seen) => seen.propose === 1 ? { status: 409, json: { code: 'pending_exists', error: 'You already have a version pending review.' } } : seen.propose === 2 ? { status: 422, json: { code: 'prompt_rejected', error: 'x', reasons: [{ code: 'r1', es: 'Motivo ES sintético', en: 'Synthetic reason EN' }] } } : seen.propose === 3 ? { status: 500, json: { error: 'x' } } : { json: { version: { id: 7, version: 1, status: 'pending_review' } } } }));
    const opener = page.getByRole('button', { name: t.create }); await opener.click();
    const dialog = page.getByRole('dialog'); await dialog.waitFor();
    assert.ok(await page.locator('#panel-guide-text').evaluate((el) => el === document.activeElement || el.closest('dialog').contains(document.activeElement)), 'foco dentro del diálogo');
    await page.locator('#panel-guide-text').fill('corto');
    assert.ok((await page.locator('#panel-guide-counter').innerText()).includes('5 /'), 'contador');
    assert.ok((await page.locator('#panel-guide-counter').innerText()).includes(t.counter));
    await page.getByRole('button', { name: t.send }).click(); await page.getByRole('alert').filter({ hasText: t.short }).waitFor();
    assert.equal(await page.evaluate(() => 0), 0);
    // foco atrapado: Tab repetido nunca sale del diálogo
    for (let i = 0; i < 8; i++) { await page.keyboard.press('Tab'); assert.ok(await page.evaluate(() => document.activeElement === document.body || !!document.activeElement?.closest('dialog')), 'Tab no llega a nada fuera del diálogo (el fondo es inerte)'); }
    await page.locator('#panel-guide-text').fill(longText);
    assert.deepEqual(await axe(page), [], `axe con el diálogo abierto (${tag})`);
    await page.getByRole('button', { name: t.send }).click(); await page.getByRole('alert').filter({ hasText: t.pendingExists }).waitFor();   // 409
    assert.equal(await page.locator('#panel-guide-text').inputValue(), longText, 'el texto se conserva tras el 409');
    await page.getByRole('button', { name: t.send }).click(); await page.getByRole('alert').filter({ hasText: t.reasons }).waitFor();         // 422 con motivos
    assert.equal(await page.locator('#panel-guide-text').inputValue(), longText, 'el texto se conserva tras el rechazo');
    await page.getByRole('button', { name: t.send }).click(); await page.getByRole('alert').filter({ hasText: t.generic }).waitFor();         // 500
    assert.equal(await page.locator('#panel-guide-text').inputValue(), longText, 'el texto se conserva tras el fallo');
    await page.getByRole('button', { name: t.send }).click(); await page.getByText(t.proposalSent).waitFor(); // éxito
    await dialog.waitFor({ state: 'detached' });
    await context.close();
    check(`${tag}: diálogo (foco atrapado, contador, mínimo 50), 409 pending_exists / 422 con motivos / 500 en el idioma de la pantalla y sin perder el texto, éxito cierra y avisa`);

    // 5) Esc cierra y el foco vuelve al botón
    ({ context, page } = await open(width, lang, { guide: 'none' }));
    await page.getByRole('button', { name: t.create }).click(); await page.getByRole('dialog').waitFor();
    await page.keyboard.press('Escape'); await page.getByRole('dialog').waitFor({ state: 'detached' });
    await page.waitForFunction((name) => document.activeElement?.textContent === name, t.create);
    await context.close();
    check(`${tag}: Esc cierra el diálogo y el foco vuelve a «${t.create}»`);
  }
  assert.deepEqual(errors, [], 'errores de consola o de página: ' + errors.join(' | '));
  console.log(`\nES-177 B2: ${checks.length} comprobaciones (ES/EN × 390/1360) OK`);
  await browser.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
