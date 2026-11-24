// [QA-Claude-3] PR #386 (ES-349 seguimientos P361-2..5 del catálogo de habilidades). Backend REAL de main + PostgreSQL desechable; superadmin y admin sintéticos; sin IA.
// Uso: via qa/run.sh <build> <db> ONLY=D,F,T,S,A,R (LABEL=pr|main: en main las comprobaciones P361-x son el control y solo se informan)
const L = require('./lib3.cjs'); const { ck, info, mk, open, call, sleep, axeRun } = L
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null; const want = k => !ONLY || ONLY.includes(k)
const PR = L.LABEL === 'pr'; const lvl = n => ({ es: 'Nivel ' + n + ' sintético', en: 'Level ' + n + ' synthetic' })
const FULL = { type: 'transversal', labels: { es: 'Comunicación sintética', en: 'Synthetic communication' }, rubric: { levels: { 1: lvl(1), 2: lvl(2), 3: lvl(3), 4: lvl(4) }, source: 'Fuente sintética', verifiedBy: 'Revisor sintético', verifiedAt: '2026-01-15' }, territories: [] }
const PART = { type: 'domain', labels: { es: 'Análisis sintético' }, rubric: { levels: { 1: lvl(1), 2: { es: 'Solo ES' } } }, territories: [] }
const struct = p => p.evaluate(() => ({ h1: document.querySelectorAll('h1').length, skips: [...document.querySelectorAll('a')].filter(a => /^(Saltar|Skip)/i.test(a.innerText.trim())).length, ov: document.documentElement.scrollWidth - document.documentElement.clientWidth, small: [...document.querySelectorAll('main a, main button, main input, main select, main textarea')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.width < 24 || r.height < 24) }).length }))
const tables = p => p.evaluate(() => [...document.querySelectorAll('main table')].map(t => ({ caption: t.querySelector('caption')?.textContent.trim() || null, heads: [...t.querySelectorAll('thead th')].map(th => ({ t: th.textContent.trim(), sr: !!th.querySelector('.cg-sr'), vis: (() => { const s = th.querySelector('.cg-sr'); if (!s) return !!(th.offsetWidth); const r = s.getBoundingClientRect(); return r.width > 2 && r.height > 2 && r.left >= 0 })() })) })))
;(async () => {
  await L.DB.connect(); await L.launch(); const srv = await L.serve(); info('build', process.env.DIST, 'label', L.LABEL)
  const SA = await mk('superadmin', 'SA-386'), AD = await mk('admin', 'AD-386'), PE = await mk('user', 'PE-386'), TH = await mk('therapist', 'TH-386')
  const lst = await call('GET', '/api/admin/skill-catalog', SA.token); let draft = (lst.j?.catalogs || []).find(c => c.status === 'draft'); if (!draft) draft = (await call('POST', '/api/admin/skill-catalog', SA.token, {})).j; const id = draft.id
  await call('PUT', `/api/admin/skill-catalog/${id}/skills/comunicacion`, SA.token, FULL); await call('PUT', `/api/admin/skill-catalog/${id}/skills/analisis_solo_es`, SA.token, PART)
  const V = '/admin/skill-catalog', D = `/admin/skill-catalog/${id}`, S = `/admin/skill-catalog/${id}/skills/analisis_solo_es`
  if (want('D')) { // P361-3 y P361-4
    for (const lang of ['es', 'en']) {
      const p = await open(SA, { lang, url: V, wait: 2000 }); const tv = await tables(p); await p.goto(L.WEB + D, { waitUntil: 'domcontentloaded' }); await sleep(2000); const td = await tables(p)
      const lastV = tv[0]?.heads.at(-1), lastD = td[0]?.heads.at(-1)
      if (PR) {
        ck(`D386-1 [${lang}] P361-3: la columna de acciones tiene encabezado SOLO para lectores de pantalla en la lista de versiones y en la de habilidades (texto presente, clase cg-sr, no visible)`, !!lastV?.t && lastV.sr && !lastV.vis && !!lastD?.t && lastD.sr && !lastD.vis, JSON.stringify([lastV, lastD]))
        ck(`D386-2 [${lang}] P361-4: caption de versiones = nombre del catálogo y el de habilidades = «Versión ${draft.version}» (distintos)`, /^(Cat[aá]logo de habilidades|Skills catalog)$/i.test(tv[0]?.caption || '') && new RegExp('^(Versi[oó]n|Version) ' + draft.version + '$', 'i').test(td[0]?.caption || '') && tv[0]?.caption !== td[0]?.caption, `${tv[0]?.caption} | ${td[0]?.caption}`)
      } else info(`CONTROL main [${lang}]: encabezado de acciones`, JSON.stringify([lastV, lastD]), 'captions:', tv[0]?.caption, '|', td[0]?.caption)
      await p.c.close()
    }
  }
  if (want('F')) { // P361-5 y P361-2 en el formulario de una habilidad incompleta
    const p = await open(SA, { lang: 'es', url: S, wait: 2500 }); const fld = await p.evaluate(() => ({ invalid: [...document.querySelectorAll('main [aria-invalid="true"]')].map(e => e.id), req: (document.querySelector('main')?.innerText.match(/obligatorio para publicar/gi) || []).length }))
    info('formulario incompleto:', JSON.stringify(fld))
    if (PR) ck('F386-1 P361-5: los campos solo INCOMPLETOS no llevan aria-invalid y muestran «Obligatorio para publicar» como indicación (≥ 3 indicaciones)', fld.invalid.length === 0 && fld.req >= 3, JSON.stringify(fld)); else info('CONTROL main: aria-invalid en incompletos =', fld.invalid.length, 'indicaciones =', fld.req)
    const lab = p.locator('#skcat-label-es'); await lab.fill('x'.repeat(100)); await p.locator('main button', { hasText: /^Guardar|^Save/ }).first().click().catch(() => {}); await sleep(900); const err = await p.evaluate(() => ({ inv: !!document.querySelector('#skcat-label-es[aria-invalid="true"]'), msg: document.querySelector('main .cg-error')?.textContent.trim() || null }))
    ck('F386-2 un ERROR REAL (etiqueta de 100 caracteres) SIGUE con aria-invalid y su mensaje', err.inv && !!err.msg, JSON.stringify(err))
    let dialogs = 0; p.on('dialog', async d => { dialogs++; await d.dismiss() })
    await p.evaluate(() => { let slot = 0; const mk = (id, attrs) => { const a = document.createElement('a'); a.id = id; a.textContent = id; for (const [k, v] of Object.entries(attrs)) a.setAttribute(k, v); a.style.cssText = 'position:fixed;top:0;left:' + (slot++ * 170) + 'px;z-index:99999;background:#fff;color:#000;padding:6px'; document.body.appendChild(a); a.addEventListener('click', e => e.preventDefault()) }; mk('qa-blank', { href: '/admin/users', target: '_blank' }); mk('qa-download', { href: '/x.txt', download: '' }); mk('qa-self', { href: '/admin/users', target: '_self' }); mk('qa-plain', { href: '/admin/users' }) })
    const dirty = await p.evaluate(() => !!document.querySelector('#skcat-label-es')?.value)
    const clicks = {}; for (const aid of ['qa-blank', 'qa-download', 'qa-self', 'qa-plain']) { const before = dialogs; await p.locator('#' + aid).click({ timeout: 4000 }).catch(() => {}); await sleep(300); clicks[aid] = dialogs - before }
    const ctrl = dialogs; await p.locator('#qa-plain').click({ modifiers: ['Control'] }).catch(() => {}); await sleep(300); clicks['qa-plain+Ctrl'] = dialogs - ctrl; info('avisos «cambios sin guardar» por enlace (con cambios):', JSON.stringify(clicks), 'dirty=', dirty)
    if (PR) ck('F386-3 P361-2: con cambios sin guardar, los enlaces target=_blank, download y Ctrl+clic NO preguntan; el enlace interno normal (y target=_self) SÍ pregunta', dirty && clicks['qa-blank'] === 0 && clicks['qa-download'] === 0 && clicks['qa-plain+Ctrl'] === 0 && clicks['qa-plain'] >= 1 && clicks['qa-self'] >= 1, JSON.stringify(clicks)); else info('CONTROL main (en main target=_blank y download SÍ preguntan):', JSON.stringify(clicks))
    await p.c.close()
    const q = await open(SA, { lang: 'es', url: S, wait: 2000 }); let d2 = 0; q.on('dialog', async d => { d2++; await d.dismiss() }); await q.evaluate(() => { const a = document.createElement('a'); a.id = 'qa-plain'; a.href = '/admin/users'; a.textContent = 'x'; a.style.cssText = 'position:fixed;top:0;left:0;z-index:99999;background:#fff;padding:6px'; document.body.appendChild(a); a.addEventListener('click', e => e.preventDefault()) }); await q.locator('#qa-plain').click().catch(() => {}); await sleep(300); ck('F386-4 sin cambios sin guardar ningún enlace pregunta', d2 === 0, String(d2)); await q.c.close()
  }
  if (want('T')) { // regresión de DataTable en otras pantallas de administración
    const out = {}
    for (const r of ['/admin/users', '/admin/content', '/admin/route-catalog', '/admin/metrics', '/admin/prompts']) { const p = await open(SA, { lang: 'es', url: r, wait: 2500 }); if (r === '/admin/content') await p.locator('main [role=tab], main button', { hasText: /^Validaciones/i }).first().click().catch(() => {}); await sleep(600); out[r] = (await tables(p)).map(t => ({ c: t.caption, h: t.heads.map(h => h.t + (h.sr ? '(sr)' : '')) })); await p.c.close() }
    L.fs.writeFileSync('C:/Users/Usuario/tools/qa3/out/t386-' + L.LABEL + '.json', JSON.stringify(out)); info('tablas de otras pantallas guardadas (cabeceras con cg-sr:', JSON.stringify(out).split('(sr)').length - 1, ')')
  }
  if (want('S')) { // roles
    for (const [nm, U, ok] of [['persona', PE, [403]], ['profesional', TH, [403]], ['sin sesión', null, [401, 403]]]) { const r = await call('GET', '/api/admin/skill-catalog', U?.token); ck(`S386 ${nm}: GET /api/admin/skill-catalog → ${ok.join('/')}`, ok.includes(r.s), String(r.s)) }
    const pa = await open(AD, { lang: 'es', url: V, wait: 2000 }); ck('S386 admin ve la lista de versiones (tabla)', (await tables(pa)).length >= 1, ''); await pa.c.close()
  }
  if (want('A')) {
    const ax = []; for (const lang of ['es', 'en']) for (const [w, scheme] of [[1360, 'light'], [390, 'dark'], [320, 'light'], [1360, 'dark']]) for (const [k, path] of [['versiones', V], ['borrador', D], ['habilidad incompleta', S], ['habilidad completa', `${D}/skills/comunicacion`], ['nueva', `${D}/skills/new`]]) { const p = await open(SA, { lang, w, scheme, theme: scheme, url: path, wait: 1800 }); ax.push({ k, lang, w, scheme, ax: await axeRun(p), s: await struct(p) }); await p.c.close() }
    const bad = ax.filter(a => a.ax.length || a.s.ov > 0 || a.s.small > 0 || a.s.h1 !== 1); ck(`A386-1 [${L.LABEL}] axe wcag2a/2aa/21a/21aa/22aa = 0, 1 h1, sin desborde y objetivos ≥ 24 px en ${ax.length} estados`, bad.length === 0, bad.slice(0, 4).map(a => `${a.k} ${a.lang} ${a.w} ${a.scheme}: ${a.ax.join(';')} ${JSON.stringify(a.s)}`).join(' | '))
  }
  if (want('R')) { const n = +(process.env.RUNS || 2); let seq = 0; for (const [nm, path] of [['versiones', V], ['borrador', D], ['habilidad', S]]) { const r = await L.clsRuns(async () => mk('superadmin', 'R-386-' + (seq++)), path, n); console.log(`R386 ${L.LABEL} ${nm} cls=${JSON.stringify(r.cls)} util=${JSON.stringify(r.util)}`) } }
  await L.done(); srv?.close?.(); process.exit(0)
})().catch(e => { console.error('FALLO', e); process.exit(1) })
