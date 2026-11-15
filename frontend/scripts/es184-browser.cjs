// ES-184: Contenido (Validaciones y Solicitudes) en Cartografía. Red simulada, datos sintéticos (correos .invalid), sin documentos ni personas reales.
// Uso:  PLAYWRIGHT_MODULE=<ruta a playwright> AXE_PATH=<ruta a axe.min.js> node scripts/es184-browser.cjs        (sirve frontend/dist: correr antes `npm run build`)
const assert = require('node:assert/strict')
const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')
const { once } = require('node:events')

;(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
  const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8')
  const dist = path.resolve(__dirname, '../dist')
  const server = http.createServer((req, res) => {
    const target = path.join(dist, decodeURIComponent(new URL(req.url, 'http://x').pathname))
    const file = fs.existsSync(target) && fs.statSync(target).isFile() ? target : path.join(dist, 'index.html')
    const type = ({ '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.json': 'application/json' })[path.extname(file)] || 'text/html'
    res.setHeader('Content-Type', type); res.end(fs.readFileSync(file))
  })
  server.listen(0, '127.0.0.1'); await once(server, 'listening')
  const base = `http://127.0.0.1:${server.address().port}`
  const browser = await chromium.launch({ headless: true })
  const check = label => console.log('PASS ' + label)
  const ES = { val: 'Validaciones', req: 'Solicitudes', plans: 'Planes', texts: 'Textos públicos' }
  const EN = { val: 'Validations', req: 'Applications', plans: 'Plans', texts: 'Public texts' }

  const docs = () => [1, 2].map(i => ({ id: i, therapist: { id: 10 + i, name: `Profesional ${i} (ejemplo)`, email: `persona${i}@ejemplo.invalid` }, documentType: 'Título profesional', documentName: `titulo${i}.pdf`, documentPath: 'x', status: 'pending', submittedAt: '2026-11-10T12:00:00Z' }))
  const apps = () => [
    { id: 1, name: 'Persona 1 (ejemplo)', email: 'persona1@ejemplo.invalid', country: 'Colombia', profession: 'Psicología', licenseNumber: '000', profileUrl: 'https://ejemplo.invalid', message: '<img src=x onerror=alert(1)> mensaje', locale: 'es', status: 'pending', reviewedBy: null, reviewNote: null, reviewedAt: null, userId: null, createdAt: '2026-11-11T12:00:00Z', cv: { size: 2048 }, minimized: false },
    { id: 2, name: 'Persona 2 (ejemplo)', email: 'persona2@ejemplo.invalid', country: 'Chile', profession: 'Coaching', licenseNumber: null, profileUrl: null, message: null, locale: 'en', status: 'approved', reviewedBy: 'Marta', reviewNote: 'ok', reviewedAt: '2026-11-12T12:00:00Z', userId: null, createdAt: '2026-11-10T12:00:00Z', cv: null, minimized: false },
    { id: 3, name: 'Solicitud eliminada / Deleted application', email: 'app-3@deleted.invalid', country: '-', profession: '-', licenseNumber: null, profileUrl: null, message: null, locale: 'es', status: 'rejected', reviewedBy: null, reviewNote: null, reviewedAt: '2026-11-09T12:00:00Z', userId: 5, createdAt: '2026-11-08T12:00:00Z', cv: null, minimized: true },
  ]

  async function open(role, lang, viewport, options = {}) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce' })
    await context.addInitScript(([r, l]) => { localStorage.setItem('elevation_token', 'es184-synthetic'); localStorage.setItem('elevation_role', r); localStorage.setItem('elv_lang', l) }, [role, lang])
    const page = await context.newPage(); const calls = []; const errors = []; const dialogs = []
    page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => { dialogs.push(d.message()); void d.dismiss() })
    const state = { docs: docs(), apps: apps(), capacityFull: options.capacityFull ?? false, junta: options.junta ?? 200, reviewStatus: options.reviewStatus ?? 200 }
    await page.route('**/api/**', route => {
      const req = route.request(); const url = new URL(req.url()); const p = url.pathname; const m = req.method()
      if (m !== 'GET') calls.push(`${m} ${p}${req.postData() ? ' ' + req.postData() : ''}`)
      if (p === '/api/session') return route.fulfill({ json: { role, onboardingCompleted: true } })
      if (p === '/api/junta/pending') return state.junta === 200 ? route.fulfill({ json: state.docs }) : route.fulfill({ status: state.junta, json: { error: 'No autorizado' } })
      if (/^\/api\/junta\/\d+\/(approve|reject)$/.test(p)) { if (state.junta !== 200) return route.fulfill({ status: 403, json: { error: 'No autorizado' } }); state.docs = state.docs.filter(d => !p.includes(`/${d.id}/`)); return route.fulfill({ json: { ok: true } }) }
      if (p === '/api/admin/professional-applications/capacity') return route.fulfill({ json: { full: state.capacityFull, pending: 10, maxPending: 10, bytes: 5 * 1048576, maxBytes: 50 * 1048576 } })
      if (p === '/api/admin/professional-applications') { const s = url.searchParams.get('status'); return route.fulfill({ json: state.apps.filter(a => !s || a.status === s) }) }
      if (/^\/api\/admin\/professional-applications\/\d+\/(approve|reject)$/.test(p)) return route.fulfill({ status: state.reviewStatus, json: state.reviewStatus === 409 ? { error: 'ya' } : {} })
      if (m === 'DELETE' && /^\/api\/admin\/professional-applications\/\d+$/.test(p)) { const id = Number(p.split('/').pop()); state.apps = state.apps.filter(a => a.id !== id); return route.fulfill({ json: {} }) }
      if (p === '/api/pricing' || p.startsWith('/api/admin/pricing') || p.startsWith('/api/landing-content')) return route.fulfill({ json: [] })
      return route.fulfill({ json: [] })
    })
    await page.goto(`${base}/admin/content`)
    await page.getByRole('heading', { level: 1 }).waitFor()
    return { page, context, calls, errors, dialogs, state }
  }
  const axe = async page => {
    await page.evaluate(axeSource)
    const result = await page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] })).violations.map(v => `${v.id}: ${v.nodes.length}`))
    return result
  }
  const overflow = page => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)

  try {
    for (const [lang, T] of [['es', ES], ['en', EN]]) {
      // Pestañas: las 4 reales, con contador solo en Validaciones y Solicitudes
      const { page, context, errors } = await open('superadmin', lang, { width: 1360, height: 900 })
      await page.getByRole('tab', { name: `${T.val} (2)` }).waitFor(); await page.getByRole('tab', { name: `${T.req} (1)` }).waitFor()
      await page.getByRole('tab', { name: T.plans, exact: true }).waitFor(); await page.getByRole('tab', { name: T.texts, exact: true }).waitFor()
      assert.equal(await page.getByRole('tab').count(), 4); assert.equal(await page.getByRole('tab', { selected: true }).count(), 1)
      assert.match(await page.getByRole('tab', { selected: true }).textContent(), new RegExp(T.val))
      await page.getByRole('tab', { selected: true }).focus(); await page.keyboard.press('ArrowRight')
      assert.match(await page.getByRole('tab', { selected: true }).textContent(), new RegExp(T.req)); await page.keyboard.press('End')
      assert.equal((await page.getByRole('tab', { selected: true }).textContent()).trim(), T.texts); await page.keyboard.press('Home')
      assert.match(await page.getByRole('tab', { selected: true }).textContent(), new RegExp(T.val))
      assert.deepEqual(errors, []); await context.close(); check(`${lang}: 4 pestañas, contador solo en Validaciones y Solicitudes, flechas/Inicio/Fin`)
    }

    // Validaciones: aprobar, rechazar con motivo obligatorio (se conserva), 0 diálogos nativos, 0 emojis en botones
    {
      const { page, context, calls, errors, dialogs } = await open('superadmin', 'es', { width: 1360, height: 900 })
      await page.getByText('2 documento(s) pendiente(s) de revisión').waitFor()
      const buttons = await page.getByRole('button').allTextContents(); assert.ok(!buttons.some(t => /[👁✓✗↻📄🎓📨✅]/u.test(t)), 'sin emojis en botones: ' + buttons.join('|'))
      await page.getByRole('button', { name: 'Rechazar' }).first().click()
      const dialog = page.getByRole('dialog', { name: 'Rechazar' }); await dialog.waitFor()
      await dialog.getByRole('button', { name: 'Confirmar rechazo' }).click()
      const area = dialog.getByLabel('Motivo de rechazo *'); assert.equal(await area.getAttribute('aria-invalid'), 'true'); await dialog.getByText('Escribe el motivo del rechazo.').waitFor(); assert.deepEqual(calls, [])
      await area.fill('Título sin apostillar'); await dialog.getByRole('button', { name: 'Confirmar rechazo' }).click(); await dialog.waitFor({ state: 'hidden' })
      assert.equal(calls.length, 1); assert.match(calls[0], /^POST \/api\/junta\/1\/reject .*Título sin apostillar/); await page.getByText('Documento rechazado.').waitFor()
      await page.getByRole('button', { name: 'Aprobar' }).first().click(); const ok = page.getByRole('dialog', { name: 'Aprobar' }); await ok.waitFor()
      await ok.getByText('Queda activa en la plataforma y puede recibir personas.').waitFor(); await ok.getByRole('button', { name: 'Cancelar' }).click(); await ok.waitFor({ state: 'hidden' }); assert.equal(calls.length, 1)
      await page.getByRole('button', { name: 'Aprobar' }).first().click(); await page.keyboard.press('Escape'); await ok.waitFor({ state: 'hidden' }); assert.equal(calls.length, 1)
      assert.deepEqual(dialogs, []); assert.deepEqual(errors, []); await context.close(); check('validaciones: rechazo exige motivo y lo conserva, cancelar y Esc no envían, sin emojis ni diálogos nativos')
    }
    // Validaciones: admin (403 del servidor) → error propio y sin contador inventado
    {
      const { page, context } = await open('admin', 'es', { width: 1360, height: 900 }, { junta: 403 })
      await page.getByText('Solo superadministración puede revisar los documentos de validación.').waitFor()
      assert.equal(await page.getByRole('tab', { name: 'Validaciones', exact: true }).count(), 1, 'sin contador cuando el servidor no respondió')
      await context.close(); check('validaciones: 403 muestra el motivo y no inventa el contador')
    }
    // Solicitudes: filtros, aviso de tope, depurada, eliminar con diálogo, 409, XSS como texto
    {
      const { page, context, calls, errors, dialogs, state } = await open('superadmin', 'es', { width: 1360, height: 900 }, { capacityFull: true })
      await page.getByRole('tab', { name: /Solicitudes/ }).click()
      await page.getByTestId('capacity-notice').waitFor(); assert.equal(await page.getByTestId('capacity-notice').getAttribute('role'), 'status')
      assert.match(await page.getByTestId('capacity-notice').textContent(), /10 de 10 pendientes/)
      assert.equal(await page.getByRole('button', { name: 'Pendientes' }).getAttribute('aria-pressed'), 'true')
      await page.getByText('Persona 1 (ejemplo)').waitFor(); assert.equal(await page.locator('img[src="x"]').count(), 0, 'el mensaje se muestra como texto'); await page.getByText('<img src=x onerror=alert(1)> mensaje').waitFor()
      await page.getByRole('button', { name: 'Todas' }).click(); await page.getByText('Datos depurados').waitFor()
      const card = page.locator('li.cg-item', { hasText: 'Datos depurados' }); const text = await card.textContent()
      assert.ok(!/@|Descargar|Aprobar|Rechazar|Eliminar|Colombia/.test(text), 'la depurada solo muestra estado y fecha: ' + text); await card.getByText('Rechazada').waitFor()
      await page.getByRole('link', { name: 'Crear cuenta de profesional' }).waitFor(); assert.ok(!page.url().includes('persona2'), 'sin datos en la URL')
      await page.locator('li.cg-item', { hasText: 'Persona 1 (ejemplo)' }).getByRole('button', { name: 'Eliminar' }).click()
      const del = page.getByRole('dialog', { name: 'Eliminar solicitud' }); await del.waitFor(); await del.getByText('Se eliminan la solicitud y su hoja de vida; no se puede deshacer. Libera cupo.').waitFor()
      await page.keyboard.press('Escape'); await del.waitFor({ state: 'hidden' }); assert.deepEqual(calls, [])
      await page.locator('li.cg-item', { hasText: 'Persona 1 (ejemplo)' }).getByRole('button', { name: 'Eliminar' }).click(); await del.getByRole('button', { name: 'Eliminar' }).click(); await del.waitFor({ state: 'hidden' })
      assert.deepEqual(calls, ['DELETE /api/admin/professional-applications/1']); await page.getByText('Solicitud eliminada.').waitFor(); assert.ok(!state.apps.some(a => a.id === 1))
      assert.deepEqual(dialogs, [], 'sin window.confirm'); assert.deepEqual(errors, []); await context.close(); check('solicitudes: filtros, aviso de tope (status), depurada solo estado y fecha, eliminar con diálogo, XSS como texto')
    }
    {
      const { page, context, calls } = await open('admin', 'en', { width: 1360, height: 900 }, { reviewStatus: 409 })
      await page.getByRole('tab', { name: /Applications/ }).click(); await page.getByText('Persona 1 (ejemplo)').waitFor()
      await page.getByRole('button', { name: 'Reject', exact: true }).first().click(); const d = page.getByRole('dialog', { name: 'Reject' }); await d.waitFor(); await d.getByLabel('Reason for rejection (required)').fill('x'); await d.getByRole('button', { name: 'Confirm rejection' }).click()
      await page.getByText('Someone else has already reviewed this application.').waitFor(); assert.equal(calls.length, 1); await context.close(); check('solicitudes: 409 «otra persona ya revisó» (EN)')
    }
    // Accesibilidad y desborde: ES/EN × 1360/390/320 × Validaciones, Solicitudes, diálogo abierto
    for (const lang of ['es', 'en']) for (const width of [1360, 390, 320]) {
      const T = lang === 'es' ? ES : EN
      const { page, context } = await open('superadmin', lang, { width, height: 900 })
      for (const tab of [T.val, T.req]) {
        await page.getByRole('tab', { name: new RegExp(`^${tab}`) }).click(); await page.waitForTimeout(200)
        assert.deepEqual(await axe(page), [], `axe ${lang} ${width} ${tab}`); assert.ok(await overflow(page) <= 0, `desborde ${lang} ${width} ${tab}`)
        const small = await page.evaluate(() => [...document.querySelectorAll('.ac-panel button, .ac-panel a.cg-btn')].filter(e => e.getBoundingClientRect().height && e.getBoundingClientRect().height < 44).map(e => e.textContent.trim().slice(0, 20)))
        assert.deepEqual(small, [], `objetivos < 44 px ${lang} ${width} ${tab}`)
      }
      await page.getByRole('button', { name: lang === 'es' ? 'Rechazar' : 'Reject', exact: true }).first().click(); await page.getByRole('dialog').waitFor()
      assert.deepEqual(await axe(page), [], `axe diálogo ${lang} ${width}`); assert.ok(await overflow(page) <= 0, `desborde diálogo ${lang} ${width}`)
      await context.close()
    }
    check('axe WCAG 2 A/AA/2.1/2.2 AA = 0, sin desborde y objetivos ≥ 44 px en ES/EN × 1360/390/320 (pestañas y diálogo)')
    console.log('es184-browser: OK')
  } catch (error) { console.error(error); process.exitCode = 1 } finally { await browser.close(); server.close() }
})()
