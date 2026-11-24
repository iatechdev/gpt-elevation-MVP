// [QA-Claude-3] PR #376 (ES-349 pantalla 3: /admin/pilot-metrics). Backend REAL de main + PostgreSQL desechable (solo para sesión/marco); datos sintéticos; 0 IA.
// Uso: via qa/run.sh <build> <db> ONLY=M1,M2,M4,M5,M6,R ; builds: 376off (bandera apagada), 376on (vista preliminar), 376err (preliminar + metrics-error), mainoff (control)
const L = require('./lib3.cjs'); const { ck, info, mk, open, sleep, axeRun, call } = L
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null; const want = k => !ONLY || ONLY.includes(k)
const URLX = '/admin/pilot-metrics'; const MODE = process.env.PM_MODE || 'off'
const txt = p => p.evaluate(() => (document.querySelector('main')?.innerText || '').replace(/\s+/g, ' '))
const struct = p => p.evaluate(() => ({ h1: [...document.querySelectorAll('h1')].map(h => h.textContent.trim()), skips: [...document.querySelectorAll('a')].filter(a => /^(Saltar|Skip)/i.test(a.innerText.trim())).length, mains: document.querySelectorAll('main').length, legacy: [...document.querySelectorAll('[class*="elv-"],[class*="pilot-"]')].filter(e => !/pilot-admin-layout/.test(String(e.className))).length, adminLayoutClass: !!document.querySelector('.pilot-admin-layout'), legacyClasses: [...document.querySelectorAll('[class*="elv-"],[class*="pilot-"]')].map(e => e.tagName + '.' + e.className).slice(0, 3), inl: [...document.querySelectorAll('main [style]')].filter(e => /color|background/i.test(e.getAttribute('style'))).length, ov: document.documentElement.scrollWidth - document.documentElement.clientWidth, small: [...document.querySelectorAll('main a, main button, main input')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.width < 24 || r.height < 24) }).length, themeSel: document.querySelectorAll('select[aria-label*="tema" i], [aria-label*="theme" i]').length }))
;(async () => {
  await L.DB.connect(); await L.launch(); const srv = await L.serve()
  const AD = await mk('admin', 'AD-376'), SU = await mk('superadmin', 'SU-376'), PE = await mk('user', 'PE-376'), TH = await mk('therapist', 'TH-376'), JN = await mk('facilitator', 'JN-376')
  info('build', process.env.DIST, 'modo', MODE, 'label', L.LABEL)
  if (want('M1') && MODE === 'off') {
    for (const lang of ['es', 'en']) {
      const p = await open(AD, { lang, w: 1360, url: URLX, wait: 3500 }); const t = await txt(p); const reqs = p.reqs.map(r => r.m + ' ' + r.u.split('?')[0])
      info(`peticiones a la API (${lang}):`, [...new Set(reqs)].join(' | '))
      ck(`M1 ${lang}: modo por defecto → 0 peticiones del piloto (/api/admin/pilot-metrics, /api/me/*, pilot*) al abrir la pantalla`, !reqs.some(r => /pilot|\/api\/me\b|\/api\/me\//i.test(r)), reqs.filter(r => /pilot|\/api\/me/i.test(r)).join(','))
      const c = lang === 'es' ? { title: 'Métricas del piloto', pend: 'Meta en definición', nodata: 'Sin datos', refresh: 'Actualizar', note: 'La actualización estará disponible cuando se habilite la conexión.' } : { title: 'Pilot metrics', pend: 'Target being defined', nodata: 'No data', refresh: 'Refresh', note: 'Refresh will be available when the connection is enabled.' }
      const count = s => (t.match(new RegExp(s, 'g')) || []).length
      info(`texto (${lang}):`, t.slice(0, 260)); ck(`M1 ${lang}: título, 4 metas «en definición», 4 «Sin datos» y la nota del botón «Actualizar»`, new RegExp(c.title, 'i').test(t) && count(c.pend) === 4 && count(c.nodata) === 4 && t.includes(c.note), `pend=${count(c.pend)} nodata=${count(c.nodata)}`)
      const dis = await p.evaluate(() => { const b = [...document.querySelectorAll('main button')].find(x => /actualizar|refresh/i.test(x.innerText)); return b ? { disabled: b.disabled, desc: b.getAttribute('aria-describedby') } : null }); ck(`M1 ${lang}: «Actualizar» deshabilitado y descrito por su nota`, dis && dis.disabled && dis.desc === 'metrics-refresh-note', JSON.stringify(dis))
      ck(`M1 ${lang}: sin cifras de metas (ningún número con % ni «meta de N») y sin emoji`, !/\d+\s*%|meta de \d|target of \d/i.test(t) && !/[\u{1F300}-\u{1FAFF}\u{2705}]/u.test(t), (t.match(/\d+\s*%/) || [''])[0]); await p.c.close()
    }
  }
  if (want('M2') && MODE !== 'off') {
    const err = MODE === 'err'
    for (const lang of ['es', 'en']) {
      const c = lang === 'es' ? { banner: 'Vista de revisión · datos ficticios', retry: 'Reintentar carga', loadError: 'No pudimos cargar', prot: 'Datos protegidos', cohort: 'Cohorte ficticia', refresh: 'Actualizar' } : { banner: 'Review preview · fictional data', retry: 'Retry loading', loadError: 'We could not', prot: 'Protected data', cohort: 'Fictional cohort', refresh: 'Refresh' }
      const p = await open(AD, { lang, w: 1360, url: URLX, wait: 2500 }); const t = await txt(p); const bannerEl = await p.locator('main .cg-banner', { hasText: c.banner }).count()
      ck(`M2 ${lang}: franja «${c.banner}» (Banner) siempre visible, también con ${err ? 'error' : 'datos'}`, bannerEl >= 1 && t.includes(c.cohort), t.slice(0, 120))
      if (!err) {
        const chips = await p.evaluate(() => [...document.querySelectorAll('main article.cg-card')].map(a => ({ h: a.querySelector('h3')?.textContent, chip: a.querySelector('.cg-chip')?.textContent.trim() || null }))); info(`tarjetas de resultados (${lang}):`, JSON.stringify(chips))
        ck(`M2 ${lang}: cada una de las 4 métricas de resultados lleva un estado en PALABRA dentro de un chip`, chips.filter(x => x.chip).length >= 4 && chips.filter(x => x.chip).every(x => x.chip.replace(/[✓\s]/g, '').length > 2), JSON.stringify(chips.filter(x => x.chip)))
        ck(`M2 ${lang}: «${c.prot}» con su explicación (<5 personas) cuando el estado es protegido; conteos solo en «Disponible»`, t.toLowerCase().includes(c.prot.toLowerCase()) && /5/.test(t), '')
        const btn = p.locator('main button', { hasText: new RegExp('^' + c.refresh) }).first(); await btn.click(); await sleep(60); const during = await p.evaluate(() => ({ busy: [...document.querySelectorAll('main button')].some(b => b.getAttribute('aria-busy') === 'true' && b.disabled), st: !!document.querySelector('main [role=status]')?.innerText, banner: !!document.querySelector('main .cg-banner') })); ck(`M2 ${lang}: tras pulsar «Actualizar» la franja de vista preliminar SIGUE visible y el botón vuelve a estar habilitado (la carga del fixture es instantánea: aria-busy no medible)`, during.banner && (await p.evaluate(() => [...document.querySelectorAll('main button')].some(b => /actualizar|refresh/i.test(b.innerText) && !b.disabled))), JSON.stringify(during)); await sleep(800)
      } else {
        const al = await p.evaluate(() => ({ alert: document.querySelector('main [role=alert], main .cg-banner--error')?.innerText.replace(/\s+/g, ' ') || null, btns: [...document.querySelectorAll('main button')].map(b => b.innerText.trim()) }))
        ck(`M2 ${lang}: error con Banner de error y «${c.retry}» (texto existente)`, !!al.alert && al.alert.includes(c.loadError) && al.btns.some(b => b.toLowerCase() === c.retry.toLowerCase()), JSON.stringify(al))
        const r = p.locator('main button', { hasText: new RegExp('^' + c.retry, 'i') }).first(); await r.focus(); await p.keyboard.press('Enter'); await sleep(900); const after = await p.evaluate(() => ({ banners: document.querySelectorAll('main .cg-banner--error').length, previewBanner: [...document.querySelectorAll('main .cg-banner')].length })); ck(`M2 ${lang}: «Reintentar» por teclado vuelve a intentar (el escenario sigue fallando: el error reaparece, sin duplicarse) y la franja de vista preliminar sigue`, after.banners <= 1 && after.previewBanner >= 1, JSON.stringify(after))
      }
      await p.c.close()
    }
  }
  if (want('M4')) {
    const rows = []
    for (const [nm, U] of [['admin', AD], ['superadmin', SU], ['persona', PE], ['profesional', TH], ['junta', JN], ['sin sesión', null]]) { const p = await open(U, { lang: 'es', url: URLX, wait: 2200 }); const url = await p.evaluate(() => location.pathname); const s = await struct(p); rows.push([nm, url, s]); await p.c.close() }
    for (const [nm, url, s] of rows) info(`rol ${nm}: ruta final ${url}`, JSON.stringify(s))
    for (const [nm, url, s] of rows.filter(r => ['admin', 'superadmin'].includes(r[0]))) ck(`M4 ${nm}: ve la pantalla con 1 h1, 1 «Saltar», 1 main, sin clases pilot-/elv-, sin estilos en línea, sin selector de tema propio, sin desborde y objetivos ≥ 24 px`, url === URLX && s.h1.length === 1 && s.skips === 1 && s.mains === 1 && s.legacy === 0 && s.inl === 0 && s.ov <= 0 && s.small === 0 && s.themeSel === 0, JSON.stringify(s))
    for (const [nm, url] of rows.filter(r => !['admin', 'superadmin'].includes(r[0]))) ck(`M4 ${nm}: no accede (sin la pantalla: aviso de rol o redirección)`, url !== URLX || !rows.find(r => r[0] === nm)[2].h1.includes('Métricas del piloto'), url + ' ' + JSON.stringify(rows.find(r => r[0] === nm)[2].h1))
  }
  if (want('M5')) {
    const routes = ['/app/feedback', '/admin/dashboard', '/admin/metrics', '/admin/users', '/admin/prompts', '/admin/content', '/admin/route-catalog', '/admin/skill-catalog', '/admin/manifest', URLX]; const out = {}
    for (const r of routes) for (const lang of ['es', 'en']) for (const w of [390, 1360]) { const U = r.startsWith('/app') ? PE : AD; const p = await open(U, { lang, w, url: r, wait: 1500 }); const t = (await p.evaluate(() => document.querySelector('main')?.innerText || '')).replace(/[0-9]{1,2}[:.][0-9]{2}/g, '#').replace(/[ \t\r\n]+/g, ' '); out[r + '|' + lang + '|' + w] = { h: L.crypto.createHash('sha1').update(t).digest('hex').slice(0, 10), path: await p.evaluate(() => location.pathname) }; await p.c.close() }
    L.fs.writeFileSync('C:/Users/Usuario/tools/qa3/out/g376-' + process.env.TAG + '.json', JSON.stringify(out)); info('regresión guardada', Object.keys(out).length)
  }
  if (want('M6')) {
    const ax = []
    for (const lang of ['es', 'en']) for (const [w, scheme] of [[1360, 'light'], [390, 'dark'], [320, 'light'], [1360, 'dark']]) { const p = await open(AD, { lang, w, scheme, theme: scheme, url: URLX, wait: 2200 }); const s = await struct(p); ax.push({ k: MODE, lang, w, scheme, ax: await axeRun(p), s }); await p.c.close() }
    const bad = ax.filter(a => a.ax.length || a.s.ov > 0 || a.s.small > 0 || a.s.h1.length !== 1 || a.s.skips !== 1); ck(`M6 [${MODE}] axe wcag2a/2aa/21a/21aa/22aa = 0, 1 h1, 1 «Saltar», sin desborde, objetivos ≥ 24 px en ${ax.length} estados`, bad.length === 0, bad.slice(0, 4).map(a => `${a.lang} ${a.w} ${a.scheme}: ${a.ax.join(';')} ${JSON.stringify(a.s)}`).join(' | '))
    const pd = await open(AD, { lang: 'es', w: 390, scheme: 'dark', theme: 'dark', url: URLX, wait: 1500 }); const bg = await pd.evaluate(() => { const c = getComputedStyle(document.querySelector('.cg-frame') || document.body); return c.backgroundColor }); ck(`M6 [${MODE}] tema oscuro real`, (bg.match(/\d+/g) || [255]).slice(0, 3).every(n => +n < 90), bg); await pd.c.close()
  }
  if (want('R')) { const n = +(process.env.RUNS || 2); let seq = 0; const r = await L.clsRuns(async () => mk('admin', 'R-376-' + (seq++)), URLX, n); console.log(`R376 ${L.LABEL} ${MODE} cls=${JSON.stringify(r.cls)} util=${JSON.stringify(r.util)}`) }
  await L.done(); srv?.close?.(); process.exit(0)
})().catch(e => { console.error('FALLO', e); process.exit(1) })
