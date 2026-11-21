// ES-110 (PR 2): «Actualizar mi hoja de vida» en navegador real (Chromium), API SIMULADA y datos sintéticos. No corre en CI; evidencia del PR.
// Flujos (ES 1360 claro): botón primario en «Hojas de vida»; subir PDF + autorización + analizar; las tres tarjetas (nada marcado, «Mantener» por defecto); elegir y guardar (el PUT lleva
// expectedVersion y solo lo elegido); guardar sin elegir; «sin cambios»; tope de 5 (lista con «Borrar» + diálogo); 409 (relee solo el contexto y conserva las elecciones, sin otro análisis);
// respuesta perdida (se relee y se compara); sesión vencida; sin contexto guardado (va al formulario); evidencia con origen borrado.
// Matriz: axe wcag2a/2aa/21a/21aa/22aa = 0 en cada escena × ES/EN × 1360/390/320 × claro/oscuro, sin desborde, objetivos >= 24 px, un h1/main/«Saltar», sin estilos en línea propios.
// Uso: npx vite build --outDir <dist> --emptyOutDir && npx vite preview --outDir <dist> --host 127.0.0.1 --port 4110 --strictPort
//   PLAYWRIGHT_MODULE=<playwright> AXE_PATH=<axe.min.js> BASE=http://127.0.0.1:4110 node scripts/es110-actualizar-check.cjs    (ONLY=flows|matrix, CLS=1 para el CLS a 390 px con CPU×4)
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8'); const BASE = process.env.BASE || 'http://127.0.0.1:4110'
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(BASE).hostname), 'Solo vista previa local')
const PDF = Buffer.from('%PDF-1.4\n% sintético\n%%EOF\n')
const EMOJI = /[\u{1F300}-\u{1FAFF}★☆♡]/u
const sk = (name, resumeVersion, support = null) => ({ name, support, resumeVersion })
const baseContext = (skills) => ({ preferredLanguage: 'es', residenceCountry: 'CO', targetMarket: 'DK', timeZone: 'America/Bogota', profession: 'Docencia sintética', interests: null, availabilityMinutesPerWeek: 90, careerGoal: null,
  careerConstraints: null, sector: null, totalYearsExperience: null, experience: [], education: [], declaredSkills: skills, languages: [] })
const CURRENT = [sk('Excel', 1, 'cita Excel'), sk('SQL', 1, 'cita SQL'), sk('Power BI', 4), sk('Dibujo', null)]
const SUGGESTED = [sk('Python', 4, 'cita Python'), sk('sql', 4, 'cita SQL nueva'), sk('Power BI', 4), sk('Dibujo', 4)]
const results = []; let failures = 0, total = 0
const check = (label, ok, detail = '') => { total++; if (!ok) failures++; results.push(`${ok ? 'PASS' : 'FALLA'} ${label}${ok ? '' : ' :: ' + detail}`); console.log(results.at(-1)) }

function newState(over = {}) {
  return { snapshot: { schemaVersion: 2, version: 3, context: baseContext(CURRENT), savedAt: '2026-11-20T10:00:00.000Z', completedAt: '2026-11-01T10:00:00.000Z' }, writes: [], analyzeCalls: 0, getContext: 0, deleted: [],
    resumes: [{ id: 3, version: 3, size: 420000, createdAt: '2026-10-12T12:00:00Z' }, { id: 2, version: 2, size: 400000, createdAt: '2026-09-02T12:00:00Z' }, { id: 1, version: 1, size: 370000, createdAt: '2026-07-18T12:00:00Z' }],
    suggested: SUGGESTED, putMode: 'ok', ...over }
}
async function open(browser, state, { width = 1360, lang = 'es', scheme = 'light', cpu = 1 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' }); const page = await ctx.newPage(); const errors = []
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()) })
  await page.addInitScript(([l]) => { localStorage.setItem('elevation_token', 'synthetic-browser-token'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l); window.__cls = 0; new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__cls += e.value }).observe({ type: 'layout-shift', buffered: true }) }, [lang])
  await page.route('**/api/**', async route => {
    const req = route.request(); const p = new URL(req.url()).pathname
    if (p === '/api/session') return route.fulfill({ json: { role: 'user', onboardingCompleted: true } })
    if (p === '/api/user/context') {
      if (req.method() === 'PUT') {
        const body = req.postDataJSON(); state.writes.push(body)
        if (state.putMode === 'conflict') return route.fulfill({ status: 409, json: { error: 'context_conflict' } })
        if (state.putMode === 'expired') return route.fulfill({ status: 401, json: { error: 'x' } })
        state.snapshot = { schemaVersion: 2, version: state.snapshot.version + 1, context: body.context, savedAt: new Date().toISOString(), completedAt: state.snapshot.completedAt }
        if (state.putMode === 'lost') return route.abort('failed') // el servidor lo aplicó, la respuesta se perdió
        return route.fulfill({ json: state.snapshot })
      }
      state.getContext++; return route.fulfill({ json: state.snapshot })
    }
    if (p === '/api/consents') return route.fulfill({ json: { consents: [{ purpose: 'resume_ai_reading', status: 'granted' }] } })
    if (p === '/api/consents/resume_ai_reading') return route.fulfill({ json: { status: 'granted' } })
    if (p === '/api/user/resumes/analyze') { state.analyzeCalls++; return route.fulfill({ json: { resume: { id: 9, version: 4, size: PDF.length, createdAt: '2026-11-20T12:00:00Z' }, reused: false, suggestions: { profession: null, interests: null, sector: null, totalYearsExperience: null, experience: [], education: [], declaredSkills: state.suggested, languages: [] }, discarded: 0 } }) }
    const del = p.match(/^\/api\/user\/resumes\/(\d+)$/)
    if (del && req.method() === 'DELETE') { state.deleted.push(Number(del[1])); state.resumes = state.resumes.filter(r => r.id !== Number(del[1])); return route.fulfill({ json: { deleted: true } }) }
    if (p === '/api/user/resumes') return route.fulfill({ json: { resumes: state.resumes, maxVersions: 5 } })
    if (p === '/api/user/resume-skills') return route.fulfill({ json: { skills: state.skillsList ?? [], orphaned: state.orphaned ?? [] } })
    if (p === '/api/evidence') return route.fulfill({ json: { evidence: [{ id: 7, version: 1, status: 'draft', authoring: 'person', createdAt: '2026-11-10T10:00:00Z', payload: { title: 'Excel avanzado (ejemplo)' }, origin: { kind: 'resume', version: 1, date: '2026-07-18T12:00:00Z', needsReview: true } }] } })
    return route.fulfill({ json: {} })
  })
  if (cpu > 1) { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu }) }
  return { ctx, page, errors }
}
const T = (lang) => lang === 'es'
  ? { update: 'Actualizar mi hoja de vida', help: 'Se guarda como una versión nueva; la anterior se conserva.', changes: 'Cambios frente a tu contexto actual', n1: 'Habilidades nuevas', n2: 'Siguen en tu hoja de vida', n3: 'Ya no aparecen en esta versión', keep: 'Mantener en mi contexto', quit: 'Quitar de mi contexto', conf: 'Tu evidencia confirmada no cambia.', none: 'Tu hoja no cambió las habilidades.', link: 'Vincular a la versión 4', save: 'Guardar', analyze: 'Analizar mi hoja de vida', saved: 'Contexto guardado', old: 'Subir una nueva versión' }
  : { update: 'Update my résumé', help: 'It is saved as a new version; the previous one is kept.', changes: 'Changes compared with your current context', n1: 'New skills', n2: 'Still in your résumé', n3: 'No longer in this version', keep: 'Keep in my context', quit: 'Remove from my context', conf: 'Your confirmed evidence does not change.', none: 'Your résumé did not change your skills.', link: 'Link to version 4', save: 'Save', analyze: 'Analyze my résumé', saved: 'Context saved', old: 'Upload a new version' }
const goto = async (page, path, lang) => { await page.goto(BASE + path, { waitUntil: 'networkidle' }); await page.locator('h1').first().waitFor({ timeout: 8000 }) }
async function toChanges(page, lang) {
  await goto(page, '/app/context/resumes/update', lang)
  await page.setInputFiles('input[type="file"]', { name: 'cv.pdf', mimeType: 'application/pdf', buffer: PDF })
  await page.getByRole('checkbox').check(); await page.getByRole('button', { name: T(lang).analyze }).click()
  await page.getByRole('heading', { level: 1, name: T(lang).changes }).waitFor({ timeout: 8000 })
}
const SCENES = {
  lista: async (page, lang) => goto(page, '/app/context/resumes', lang),
  subir: async (page, lang) => goto(page, '/app/context/resumes/update', lang),
  autorizacion: async (page, lang) => { await goto(page, '/app/context/resumes/update', lang); await page.setInputFiles('input[type="file"]', { name: 'cv.pdf', mimeType: 'application/pdf', buffer: PDF }); await page.locator('h2#rs-heading').waitFor() },
  cambios: toChanges,
  guardado: async (page, lang) => { await toChanges(page, lang); await page.getByRole('button', { name: T(lang).save }).click(); await page.getByText(T(lang).saved).waitFor() },
  evidencia: async (page, lang) => goto(page, '/app/evidence', lang),
  huerfanas: async (page, lang) => goto(page, '/app/evidence/resume-skills', lang),
  sincambios: toChanges,
  conflicto: async (page, lang) => { await toChanges(page, lang); await page.getByRole('checkbox', { name: /Python/ }).check(); await page.getByRole('button', { name: T(lang).save }).click(); await page.getByRole('button', { name: /Recargar contexto|Reload context/ }).waitFor() },
}
const ORPHANS = [{ name: 'Excel avanzado (ejemplo)', origin: 'deleted', classified: { skillKey: 'excel', labels: { es: 'Excel', en: 'Excel' } }, added: false }, { name: 'Gestión de proyectos (ejemplo)', origin: 'deleted', classified: null, added: true }]
const SCENE_STATE = { huerfanas: () => newState({ orphaned: ORPHANS }), sincambios: () => newState({ suggested: [sk('Excel', 4), sk('SQL', 4)], snapshot: { schemaVersion: 2, version: 3, context: baseContext([sk('Excel', 4), sk('SQL', 4)]), savedAt: '2026-11-20T10:00:00.000Z', completedAt: null } }), conflicto: () => newState({ putMode: 'conflict' }) }
const mustPass = (ok, label) => { if (!ok) throw new Error(label) }

async function flows(browser) {
  const es = T('es')
  { // 1. Entrada
    const state = newState(); const { ctx, page, errors } = await open(browser, state); await goto(page, '/app/context/resumes', 'es')
    const link = page.getByRole('link', { name: es.update }); check('«Hojas de vida»: botón primario «Actualizar mi hoja de vida» con su frase', await link.count() === 1 && await page.getByText(es.help).count() === 1)
    check('«Subir una nueva versión» ya no está en la lista', await page.getByText(es.old).count() === 0)
    await link.click(); await page.getByRole('heading', { level: 1, name: es.update }).waitFor(); check('el botón lleva a /app/context/resumes/update', new URL(page.url()).pathname === '/app/context/resumes/update')
    check('el foco queda en el h1 al cambiar de pantalla', await page.evaluate(() => document.activeElement === document.querySelector('h1')))
    check('modo «update»: sin «Opcional · ahorra tiempo», sin intro de empezar de cero y sin «Prefiero llenarlo a mano»', await page.getByText('Opcional').count() === 0 && await page.getByText('Prefiero llenarlo a mano').count() === 0 && await page.getByText('Adjúntala y te proponemos').count() === 0)
    check('sin errores de JS', errors.length === 0, errors.join('|')); await ctx.close()
  }
  { // 2. Tres tarjetas, defaults, elegir y guardar
    const state = newState(); const { ctx, page } = await open(browser, state); await toChanges(page, 'es')
    check('un análisis, ningún guardado todavía', state.analyzeCalls === 1 && state.writes.length === 0)
    for (const [key, n] of [['n1', 1], ['n2', 1], ['n3', 1]]) check(`tarjeta «${es[key]}» con su número ${n}`, await page.getByRole('heading', { level: 2, name: `${es[key]} · ${n}` }).count() === 1)
    check('NINGUNA casilla marcada por defecto', await page.locator('main input[type=checkbox]:checked').count() === 0)
    check('«Mantener en mi contexto» marcado por defecto', await page.getByRole('radio', { name: es.keep }).first().isChecked() && !(await page.getByRole('radio', { name: es.quit }).first().isChecked()))
    check('«Vincular a la versión 4» solo para lo que sigue y no está vinculado (SQL); Power BI (ya v4) y Dibujo (a mano) no se ofrecen', await page.getByText(es.link).count() === 1 && await page.getByText('Power BI').count() === 0 && await page.locator('.cv-group').getByText('Dibujo').count() === 0)
    check('el radiogroup se llama como la habilidad', await page.getByRole('radiogroup', { name: 'Excel' }).count() === 1)
    check('pie fijo con «Tu evidencia confirmada no cambia.»', await page.locator('.pg-sticky').getByText(es.conf).count() === 1)
    check('el foco está en el h1 «Cambios frente a tu contexto actual»', await page.evaluate(() => document.activeElement === document.querySelector('h1')))
    await page.getByRole('checkbox', { name: /Python/ }).check(); await page.getByRole('checkbox', { name: es.link }).check(); await page.getByRole('radio', { name: es.quit }).check()
    await page.getByRole('button', { name: es.save }).click(); await page.getByText(es.saved).waitFor()
    const put = state.writes[0]; check('un solo PUT, con expectedVersion 3 y action save_draft', state.writes.length === 1 && put.expectedVersion === 3 && put.action === 'save_draft' && put.schemaVersion === 2, JSON.stringify(put).slice(0, 200))
    check('el PUT lleva solo lo elegido: Excel quitado, SQL vinculada a la v4 con la cita nueva, Python añadida con la v4, lo demás idéntico', JSON.stringify(put.context.declaredSkills) === JSON.stringify([sk('SQL', 4, 'cita SQL nueva'), sk('Power BI', 4), sk('Dibujo', null), sk('Python', 4, 'cita Python')]), JSON.stringify(put.context.declaredSkills))
    check('el resto del contexto viaja idéntico', JSON.stringify({ ...put.context, declaredSkills: 0 }) === JSON.stringify({ ...baseContext([]), declaredSkills: 0 }))
    check('guardado: aviso con enlace a «Habilidades de tu hoja de vida» y a «Ver mis hojas de vida»; las tarjetas ya no se muestran', await page.getByRole('link', { name: 'Habilidades de tu hoja de vida' }).getAttribute('href') === '/app/evidence/resume-skills' && await page.getByRole('link', { name: 'Ver mis hojas de vida' }).count() === 1 && await page.locator('.cv-group').count() === 0)
    await ctx.close()
  }
  { // 3. Guardar sin elegir = contexto idéntico
    const state = newState(); const { ctx, page } = await open(browser, state); await toChanges(page, 'es'); await page.getByRole('button', { name: es.save }).click(); await page.getByText(es.saved).waitFor()
    check('guardar sin elegir nada no cambia ninguna habilidad', JSON.stringify(state.writes[0].context.declaredSkills) === JSON.stringify(CURRENT))
    await ctx.close()
  }
  { // 4. Sin cambios
    const state = newState({ suggested: [sk('Excel', 4), sk('SQL', 4)], snapshot: { schemaVersion: 2, version: 3, context: baseContext([sk('Excel', 4), sk('SQL', 4)]), savedAt: '2026-11-20T10:00:00.000Z', completedAt: null } })
    const { ctx, page } = await open(browser, state); await toChanges(page, 'es')
    check('«Tu hoja no cambió las habilidades.» + «Tu evidencia confirmada no cambia.» + «Ver mis hojas de vida», sin tarjetas ni Guardar', await page.getByRole('heading', { level: 2, name: es.none }).count() === 1 && await page.getByText(es.conf).count() === 1 && await page.getByRole('link', { name: 'Ver mis hojas de vida' }).count() === 1 && await page.locator('.cv-group').count() === 0 && await page.getByRole('button', { name: es.save }).count() === 0)
    await ctx.close()
  }
  { // 5. Tope de 5 versiones
    const full = [5, 4, 3, 2, 1].map(n => ({ id: n, version: n, size: 400000, createdAt: `2026-0${n + 3}-02T12:00:00Z` }))
    const state = newState({ resumes: full }); const { ctx, page } = await open(browser, state); await goto(page, '/app/context/resumes/update', 'es')
    check('con 5/5: aviso del tope + lista con «Borrar» por versión y sin tarjeta de subir', await page.getByText('Ya tienes 5 versiones guardadas').count() === 1 && await page.getByRole('button', { name: /^Borrar:/ }).count() === 5 && await page.locator('input[type=file]').count() === 0)
    await page.getByRole('button', { name: 'Borrar: Versión 1' }).click(); const dialog = page.getByRole('dialog'); await dialog.waitFor()
    check('el diálogo es el de ES-109 (sin copias, no se puede deshacer, «para revisión»)', await dialog.getByText(/sin copias/).count() === 1 && await dialog.getByText(/para revisión/).count() === 1 && state.deleted.length === 0)
    await dialog.getByRole('button', { name: 'Cancelar' }).click(); check('Cancelar no borra nada y devuelve el foco al botón «Borrar»', state.deleted.length === 0 && await page.evaluate(() => /Borrar/.test(document.activeElement?.getAttribute('aria-label') ?? '')))
    await page.getByRole('button', { name: 'Borrar: Versión 1' }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Sí, borrar esta versión' }).click()
    await page.locator('input[type=file]').waitFor({ state: 'attached' }); check('tras borrar UNA versión se relee la lista y aparece la tarjeta de subir (4/5); nada más se borró', JSON.stringify(state.deleted) === '[1]')
    await ctx.close()
  }
  { // 6. 409: relee solo el contexto y conserva el análisis y las elecciones
    const state = newState({ putMode: 'conflict' }); const { ctx, page } = await open(browser, state); await toChanges(page, 'es')
    await page.getByRole('checkbox', { name: /Python/ }).check(); await page.getByRole('button', { name: es.save }).click()
    await page.getByRole('alert').getByText('Hay una versión más reciente').waitFor(); const reloadBtn = page.getByRole('button', { name: 'Recargar contexto' })
    check('409: aviso + «Recargar contexto»; Guardar deshabilitado; nada guardado', await reloadBtn.count() === 1 && await page.getByRole('button', { name: es.save }).isDisabled() && state.snapshot.version === 3)
    state.putMode = 'ok'; state.snapshot = { ...state.snapshot, version: 4 }; const analyzed = state.analyzeCalls; await reloadBtn.click()
    await page.getByRole('button', { name: es.save }).waitFor(); await page.waitForFunction(() => !document.querySelector('button[disabled].cg-btn:not(.cg-btn--ghost)'))
    check('recargar relee SOLO el contexto: no hay otro análisis y las elecciones siguen (Python marcada)', state.analyzeCalls === analyzed && await page.getByRole('checkbox', { name: /Python/ }).isChecked())
    await page.getByRole('button', { name: es.save }).click(); await page.getByText(es.saved).waitFor(); check('guardar de nuevo usa la versión nueva (expectedVersion 4)', state.writes.at(-1).expectedVersion === 4)
    await ctx.close()
  }
  { // 7. Respuesta perdida
    const state = newState({ putMode: 'lost' }); const { ctx, page } = await open(browser, state); await toChanges(page, 'es')
    await page.getByRole('checkbox', { name: /Python/ }).check(); await page.getByRole('button', { name: es.save }).click(); await page.getByText(es.saved).waitFor()
    check('la respuesta de guardar se pierde pero el servidor lo aplicó: se relee, se compara y se dice «guardado» sin repetir el PUT', state.writes.length === 1 && state.snapshot.version === 4)
    await ctx.close()
  }
  { // 8. Sesión vencida y sin contexto
    const state = newState({ putMode: 'expired' }); const { ctx, page } = await open(browser, state); await toChanges(page, 'es'); await page.getByRole('button', { name: es.save }).click()
    await page.getByRole('alert').getByText(/sesión|expir/i).first().waitFor(); check('401 al guardar: aviso de sesión vencida con enlace para entrar', await page.getByRole('link', { name: /Iniciar|Entrar|sesión/i }).count() >= 1); await ctx.close()
    const none = newState({ snapshot: { schemaVersion: 2, version: 0, context: null, savedAt: null, completedAt: null } }); const second = await open(browser, none)
    await second.page.goto(BASE + '/app/context/resumes/update'); await second.page.waitForURL(/\/app\/onboarding/, { timeout: 8000 }); check('sin contexto guardado se va al formulario (no hay con qué comparar)', true); await second.ctx.close()
  }
  { // 9. Evidencia con origen borrado
    const state = newState(); const { ctx, page } = await open(browser, state); await goto(page, '/app/evidence', 'es')
    const hasText = await page.getByText('Origen: versión borrada').count(); check('evidencia «para revisión»: «Origen: versión borrada» y «Esta evidencia salió de una versión que borraste; revísala.»', hasText >= 1 && await page.getByText('Esta evidencia salió de una versión que borraste; revísala.').count() >= 1)
    await ctx.close()
  }
  { // 9b. Habilidades de una versión borrada (orphaned de #390)
    const state = newState({ orphaned: ORPHANS }); const { ctx, page } = await open(browser, state); await goto(page, '/app/evidence/resume-skills', 'es')
    check('huérfanas: se listan con «Origen: versión borrada» y «Declarada», sin casilla, y NO sale «No hay habilidades para revisar»', await page.getByText('Origen: versión borrada').count() >= 2 && await page.getByText('Excel avanzado (ejemplo)').count() === 1 && await page.locator('main input[type=checkbox]').count() === 0 && await page.getByText(/No hay habilidades para revisar/).count() === 0)
    const empty = newState({ orphaned: [] }); const second = await open(browser, empty); await goto(second.page, '/app/evidence/resume-skills', 'es')
    check('sin huérfanas ni candidatas se conserva el estado vacío de siempre', await second.page.getByText(/No hay habilidades para revisar/).count() === 1); await second.ctx.close(); await ctx.close()
    const draft = newState(); const third = await open(browser, draft); await goto(third.page, '/app/evidence', 'es')
    check('E398-3: el borrador sí pide «revísala»', await third.page.getByText('Esta evidencia salió de una versión que borraste; revísala.').count() >= 1); await third.ctx.close()
    const confirmed = newState(); const fourth = await open(browser, confirmed, {}); await fourth.page.route('**/api/evidence', r => r.fulfill({ json: { evidence: [{ id: 8, version: 2, status: 'confirmed', authoring: 'person', createdAt: '2026-11-10T10:00:00Z', payload: { title: 'Confirmada (ejemplo)' }, origin: { kind: 'resume', version: 1, date: '2026-07-18T12:00:00Z', needsReview: true } }] } })); await goto(fourth.page, '/app/evidence', 'es')
    check('E398-3: la confirmada dice «Origen: versión borrada» SIN pedir «revísala» ni «Para revisión»', await fourth.page.getByText('Origen: versión borrada').count() >= 1 && await fourth.page.getByText('Esta evidencia salió de una versión que borraste; revísala.').count() === 0); await fourth.ctx.close()
  }
  { // 10. Teclado: todo el flujo sin ratón
    const state = newState(); const { ctx, page } = await open(browser, state); await toChanges(page, 'es')
    await page.getByRole('checkbox', { name: /Python/ }).focus(); await page.keyboard.press('Space'); await page.getByRole('radio', { name: es.keep }).focus(); await page.keyboard.press('ArrowRight')
    check('teclado: Espacio marca la casilla y la flecha cambia «Mantener» ↔ «Quitar»', await page.getByRole('checkbox', { name: /Python/ }).isChecked() && await page.getByRole('radio', { name: es.quit }).isChecked())
    const outline = await page.getByRole('checkbox', { name: /Python/ }).evaluate(el => { el.focus(); return getComputedStyle(el).outlineStyle !== 'none' || getComputedStyle(el.parentElement).outlineStyle !== 'none' }); check('foco visible en las casillas', outline)
    await ctx.close()
  }
}

async function matrix(browser) {
  for (const name of Object.keys(SCENES)) for (const lang of ['es', 'en']) for (const width of [1360, 390, 320]) for (const scheme of ['light', 'dark']) {
    let ctx, page, errors
    try { ({ ctx, page, errors } = await open(browser, (SCENE_STATE[name] || newState)(), { width, lang, scheme })); await SCENES[name](page, lang); await page.waitForTimeout(250) } catch (e) { check(`${name} ${lang} ${width}px ${scheme}: escena alcanzada`, false, String(e.message).split('\n')[0]); continue }
    await page.addScriptTag({ content: axeSource })
    const axe = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }).then(r => r.violations.map(v => v.id + ':' + v.nodes.length)))
    const m = await page.evaluate(() => ({ h1: document.querySelectorAll('h1').length, mains: document.querySelectorAll('main').length, skips: [...document.querySelectorAll('a')].filter(a => /^#/.test(a.getAttribute('href') || '') && /Saltar|Skip/.test(a.textContent)).length,
      inline: document.querySelectorAll('.cv-update [style], .cv-prim [style]').length, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, text: document.body.innerText,
      small: [...document.querySelectorAll('main button, main a[href], main input, main select, main textarea')].filter(e => { if (e.type === 'radio' || e.type === 'file') return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.height < 24 || r.width < 24) }).length }))
    const ok = axe.length === 0 && m.h1 === 1 && m.mains === 1 && m.skips === 1 && m.inline === 0 && m.overflow <= 0 && m.small === 0 && !EMOJI.test(m.text) && errors.length === 0
    total++; if (!ok) failures++
    if (!ok || (lang === 'es' && width === 390 && scheme === 'light')) console.log((ok ? 'OK    ' : 'FALLA ') + `${name} ${lang} ${width}px ${scheme}: axe=[${axe}] h1=${m.h1} main=${m.mains} saltar=${m.skips} inline=${m.inline} desborde=${m.overflow} <24=${m.small} errores=${errors.length}`)
    await ctx.close()
  }
  { // diálogo de borrar con 5/5
    for (const lang of ['es', 'en']) for (const width of [1360, 390, 320]) for (const scheme of ['light', 'dark']) {
      const state = newState({ resumes: [5, 4, 3, 2, 1].map(n => ({ id: n, version: n, size: 400000, createdAt: `2026-0${n + 3}-02T12:00:00Z` })) })
      const { ctx, page, errors } = await open(browser, state, { width, lang, scheme }); await goto(page, '/app/context/resumes/update', lang); await page.getByRole('button', { name: /^(Borrar|Delete):/ }).first().click(); await page.getByRole('dialog').waitFor(); await page.waitForTimeout(200)
      await page.addScriptTag({ content: axeSource }); const axe = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }).then(r => r.violations.map(v => v.id + ':' + v.nodes.length)))
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); const ok = axe.length === 0 && overflow <= 0 && errors.length === 0
      total++; if (!ok) failures++; if (!ok) console.log(`FALLA limite+dialogo ${lang} ${width}px ${scheme}: axe=[${axe}] desborde=${overflow} errores=${errors.length}`); await ctx.close()
    }
  }
  console.log(`${total - failures}/${total} combinaciones OK (flujos y matriz)`)
}

;(async () => {
  const browser = await chromium.launch(); const only = process.env.ONLY
  try {
    if (!only || only === 'flows') await flows(browser)
    if (!only || only === 'matrix') await matrix(browser)
    if (process.env.CLS === '1') for (const name of ['lista', 'subir', 'cambios']) {
      const values = [], sizes = []
      for (let i = 0; i < 6; i++) { const { ctx, page } = await open(browser, newState(), { width: 390, lang: 'es', scheme: 'light', cpu: 4 }); await SCENES[name](page, 'es'); await page.waitForTimeout(1500); values.push(await page.evaluate(() => window.__cls)); sizes.push(await page.evaluate(() => document.querySelector('main').innerText.length)); await ctx.close() }
      values.sort((a, b) => a - b); sizes.sort((a, b) => a - b); console.log(`CLS 390px CPU×4 ${name}: mediana=${values[3].toFixed(4)} máx=${values[5].toFixed(4)} | texto útil de <main> mediana=${sizes[3]}`); if (values[5] > 0.1) failures++
    }
  } catch (e) { failures++; console.log('ABORTA', e.message) }
  await browser.close(); console.log(failures ? `FALLAS: ${failures}` : 'TODO OK'); process.exit(failures ? 1 : 0)
})()
