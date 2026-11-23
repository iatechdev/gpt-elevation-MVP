// [QA-Claude-5] PR #388 (E380-1, ES-279): PUT /api/landing-content solo guarda claves PUBLICABLES. Backend REAL (server.js) + PostgreSQL desechable; Chromium para la pantalla «Textos públicos»; IA 0.
// Uso: qa/qa5-run.sh qa5-388.cjs <pr388|main> <base> [ONLY=B1,B2,...]   (en main, B1 es CONTROL: se informa)
const L = require('./qa5-lib.cjs'); const { ck, info, mk, open, call, sleep, axeRun, dbq } = L
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null; const want = k => !ONLY || ONLY.includes(k)
const PR = L.LABEL === 'pr'
const catalog = require(L.path.join(process.env.BACKEND, '..', 'shared', 'landing-content.json'))
const KEYS = catalog.map(e => e.key); const CLASSIC = ['hero_title', 'hero_subtitle', 'cta_primary', 'cta_final_title', 'cta_final_subtitle']
const rows = async () => Number((await dbq('SELECT count(*)::int AS n FROM "LandingContents"'))[0].n)
const put = (tk, b) => call('PUT', '/api/landing-content', tk, b)
const iso = d => new Date(d).toISOString()
;(async () => {
  await L.DB.connect(); await L.launch(); const srv = await L.serve(); info('build', process.env.DIST, 'label', L.LABEL, 'catálogo', KEYS.length)
  const S = await mk('superadmin', 'Super Sintético'); const ADM = await mk('admin', 'Admin Sintético'); const USR = await mk('user', 'Persona'); const PRO = await mk('therapist', 'Prof')
  let n500 = 0; const track = r => { if (r.s >= 500) n500++; return r }
  const P = async (tk, b) => track(await put(tk, b))

  if (want('B1')) {
    const long = n => 'a'.repeat(n)
    const bad = ['no_existe', 'landing.no.existe', 'landing.', '__proto__', 'constructor', 'toString', 'hasOwnProperty', 'HERO_TITLE', 'Hero_Title', ' hero_title', 'hero_title ', 'hero_title\n', 'hero_title\t', 'landing.nav.skip ', 'landing.nav.skip\u0000', 'landing.nav.skip​', 'LANDING.NAV.SKIP', 'landing.nav.skíp', "x'; DROP TABLE \"LandingContents\";--", "' OR '1'='1", '../../etc/passwd', '%00', '<script>alert(1)</script>', 'ñandú', '🙂', 'a b', long(255), long(256), long(300), long(10000), 'landing.' + long(300), '0', '1', 'null', 'undefined']
    const before = await rows(); let notBad = []; let leak = false
    for (const lang of ['es', 'en']) for (const key of bad) for (const exp of [undefined, null, iso(Date.now() - 1000), 'garbage']) {
      const body = { key, lang, value: 'valor sintético' }; if (exp !== undefined) body.expectedUpdatedAt = exp
      const r = await P(S.token, body)
      const okKey = key.trim() !== ''
      if (PR) { if (!(r.s === 400 && r.j && r.j.code === 'unknown_key' && r.j.error === (lang === 'en' ? 'Unknown landing key.' : 'Clave landing desconocida.'))) notBad.push([lang, JSON.stringify(key).slice(0, 30), exp === undefined ? '-' : String(exp).slice(0, 8), r.s, r.j && r.j.code]) }
      if (r.tx.includes(key.slice(0, 20)) && key.length > 3 && !/Clave|Unknown/.test(key)) leak = true
    }
    const after = await rows(); const stray = await dbq(`SELECT key FROM "LandingContents" WHERE key = ANY($1)`, [bad.filter(k => !k.includes('\u0000'))])
    if (PR) { ck(`B1 ${bad.length} claves no publicables × es/en × 4 variantes de expectedUpdatedAt: 400 unknown_key (mensaje ES/EN estable) y SIN escribir`, notBad.length === 0 && after === before && stray.length === 0, JSON.stringify({ notBad: notBad.slice(0, 5), n: notBad.length, before, after, stray: stray.length })); ck('B9 el mensaje de error no refleja la clave recibida', !leak) }
    else { info(`CONTROL main: filas antes ${before} después ${after}; claves malas que SÍ se escribieron: ${stray.length}`) }
    // claves y cuerpos de tipos erróneos
    const weird = [{ key: 5, lang: 'es', value: 'x' }, { key: ['hero_title'], lang: 'es', value: 'x' }, { key: { a: 1 }, lang: 'es', value: 'x' }, { key: null, lang: 'es', value: 'x' }, { key: true, lang: 'es', value: 'x' }, { key: '', lang: 'es', value: 'x' }, { key: '   ', lang: 'es', value: 'x' }, { key: 'hero_title', lang: 'fr', value: 'x' }, { key: 'hero_title', lang: ['es'], value: 'x' }, { key: 'hero_title', lang: 'es', value: 5 }, { key: 'hero_title', lang: 'es', value: '' }, { key: 'hero_title', lang: 'es', value: '   ' }, { key: 'hero_title', lang: 'es', value: ['x'] }, { key: 'hero_title', lang: 'es', value: 'x'.repeat(5001) }, {}, null, 'texto', [1], { key: 'hero_title', lang: 'es', value: 'x', expectedUpdatedAt: 5 }, { key: 'hero_title', lang: 'es', value: 'x', expectedUpdatedAt: [] }]
    const b2 = await rows(); const out = []
    for (const w of weird) { const r = await P(S.token, w); out.push(r.s) }
    ck('B4 tipos y cuerpos erróneos (llaves/lang/value/expectedUpdatedAt, vacíos, 5001 caracteres, cuerpo no objeto) → 4xx, 0 × 500 y sin escribir', out.every(s => s >= 400 && s < 500) && (await rows()) === b2, out.join(','))
  }
  if (want('B2')) {
    const universe = [...KEYS, ...CLASSIC]; const t0 = Date.now(); let fails = []
    for (const lang of ['es', 'en']) for (const key of universe) { const r = await P(S.token, { key, lang, value: `qa5 ${lang} ${key}` }); if (r.s !== 200) fails.push([lang, key, r.s]) }
    ck(`B2 las ${KEYS.length} claves del catálogo + ${CLASSIC.length} clásicas siguen guardándose (200) en es y en (${universe.length * 2} PUT, ${Date.now() - t0} ms)`, fails.length === 0, JSON.stringify(fails.slice(0, 5)))
    const es = (await call('GET', '/api/landing-content?lang=es')).j, en = (await call('GET', '/api/landing-content?lang=en')).j
    const sample = [KEYS[0], KEYS[168], KEYS[336], ...CLASSIC]; ck('B2 la lectura pública devuelve lo guardado (primera, mitad, última y 5 clásicas, es/en)', sample.every(k => es[k] === `qa5 es ${k}` && en[k] === `qa5 en ${k}`), JSON.stringify(sample.filter(k => es[k] !== `qa5 es ${k}`)))
    const adm = await call('GET', '/api/landing-content/admin?lang=es', S.token); ck('B2 GET /admin (superadmin) refleja lo guardado', adm.s === 200 && adm.j[KEYS[0]] === `qa5 es ${KEYS[0]}`)
    const ver = await call('GET', '/api/landing-content/versions?lang=es', S.token); ck('B2 GET /versions lista las filas guardadas con su versión', ver.s === 200 && ver.j.length >= universe.length, String(ver.j && ver.j.length))
    const extra = (await dbq(`SELECT count(*)::int AS n FROM "LandingContents" WHERE key <> ALL($1)`, [universe]))[0].n; ck('B2 no hay filas fuera del conjunto publicable', Number(extra) === 0, String(extra))
  }
  if (want('B4')) {
    const key = KEYS[5]; const v = (await call('GET', '/api/landing-content/versions?lang=es', S.token)).j.find(x => x.key === key)
    const base = v ? v.updatedAt : null
    const a = await P(S.token, { key: 'no_existe', lang: 'es', value: 'x', expectedUpdatedAt: 'garbage' }); ck('B4 clave desconocida + expectedUpdatedAt mal formado → 400 de CLAVE (no invalid_input ni 409)', !PR || (a.s === 400 && a.j.code === 'unknown_key'), JSON.stringify(a.j))
    const b = await P(S.token, { key: 'no_existe', lang: 'es', value: 'x', expectedUpdatedAt: iso(Date.now() - 86400000) }); ck('B4 clave desconocida + versión vieja → 400 de clave (no 409)', !PR || (b.s === 400 && b.j.code === 'unknown_key'))
    const c = await P(S.token, { key, lang: 'es', value: 'x', expectedUpdatedAt: iso(Date.now() - 86400000) }); ck('B4 clave válida + versión vieja → 409 version_conflict (como en main)', c.s === 409 && c.j.code === 'version_conflict', JSON.stringify(c.j).slice(0, 120))
    const d = await P(S.token, { key, lang: 'es', value: 'x', expectedUpdatedAt: 'garbage' }); ck('B4 clave válida + versión mal formada → 400 invalid_input (como en main)', d.s === 400 && d.j.code === 'invalid_input')
    const e = await P(S.token, { key, lang: 'es', value: 'qa5 conservar', expectedUpdatedAt: base }); ck('B4 clave válida + versión vigente → 200 con updatedAt nuevo', e.s === 200 && !!e.j.updatedAt, JSON.stringify(e.j).slice(0, 120))
    const f = await P(S.token, { key, lang: 'es', value: 'otra', expectedUpdatedAt: null }); ck('B4 clave válida + «null» sobre texto ya existente → 409', f.s === 409)
  }
  if (want('B5')) {
    const body = { key: KEYS[7], lang: 'es', value: 'no debe guardarse' }; const bad = { key: 'no_existe', lang: 'es', value: 'x' }
    const rows0 = await rows()
    const r0 = await P(null, body), r1 = await P(USR.token, body), r2 = await P(PRO.token, body), r3 = await P(ADM.token, body), r4 = await P(ADM.token, bad), r5 = await P(null, bad), r6 = await P(USR.token, bad)
    ck('B5 sin token 401; persona, profesional y admin 403 en PUT (válida e inválida: la invalidez no se filtra a quien no es superadmin)', r0.s === 401 && r1.s === 403 && r2.s === 403 && r3.s === 403 && r4.s === 403 && r5.s === 401 && r6.s === 403 && (await rows()) === rows0, [r0.s, r1.s, r2.s, r3.s, r4.s, r5.s, r6.s].join(','))
    const g = await call('GET', '/api/landing-content?lang=es'); ck('B5 lectura pública sin token = 200 con claves publicables y sin claves ajenas', g.s === 200 && typeof g.j === 'object' && g.j[KEYS[0]] !== undefined && !('no_existe' in g.j))
    ck('B5 GET /versions: persona 403, admin 403, sin token 401; GET /admin: admin 200', (await call('GET', '/api/landing-content/versions', USR.token)).s === 403 && (await call('GET', '/api/landing-content/versions', ADM.token)).s === 403 && (await call('GET', '/api/landing-content/versions')).s === 401 && (await call('GET', '/api/landing-content/admin', ADM.token)).s === 200)
  }
  if (want('B6')) {
    const key = KEYS[9]; const res = await Promise.all(Array.from({ length: 10 }, (_, i) => P(S.token, { key, lang: 'es', value: `qa5 carrera ${i}` })))
    const finalV = (await call('GET', '/api/landing-content?lang=es')).j[key]; ck('B6 10 PUT simultáneos de clave válida (sin versión): 10×200 y un valor final coherente', res.every(r => r.s === 200) && /^qa5 carrera \d$/.test(finalV), res.map(r => r.s).join(',') + ' ' + finalV)
    const cur = (await call('GET', '/api/landing-content/versions?lang=es', S.token)).j.find(x => x.key === key).updatedAt
    const res2 = await Promise.all(Array.from({ length: 10 }, (_, i) => P(S.token, { key, lang: 'es', value: `qa5 versión ${i}`, expectedUpdatedAt: cur })))
    ck('B6 10 PUT simultáneos con la MISMA versión esperada: exactamente 1×200 y 9×409, 0 × 500', res2.filter(r => r.s === 200).length === 1 && res2.filter(r => r.s === 409).length === 9, res2.map(r => r.s).join(','))
    const b0 = await rows(); const res3 = await Promise.all(Array.from({ length: 10 }, () => P(S.token, { key: 'no_existe_carrera', lang: 'es', value: 'x' })))
    ck('B6 10 PUT simultáneos de clave inválida: 10×400 (PR) y ninguna fila nueva', (!PR || res3.every(r => r.s === 400)) && (!PR || (await rows()) === b0), res3.map(r => r.s).join(','))
  }
  if (want('B10')) { // latencia PUT válido/inválido
    const t = async (fn, k = 25) => { const a = []; for (let i = 0; i < k; i++) { const s = process.hrtime.bigint(); await fn(i); a.push(Number(process.hrtime.bigint() - s) / 1e6) } a.sort((x, y) => x - y); return `p50=${a[Math.floor(k / 2)].toFixed(1)} ms p95=${a[Math.floor(k * 0.95)].toFixed(1)} ms` }
    console.log(`LAT ${L.LABEL} PUT válido: ${await t(i => put(S.token, { key: KEYS[11], lang: 'es', value: 'lat ' + i }))} | PUT inválido: ${await t(i => put(S.token, { key: 'no_existe_lat', lang: 'es', value: 'x' }))}`)
  }
  if (want('U')) { // la pantalla «Textos públicos»
    const tabClick = async p => { await p.getByRole('tab', { name: /Textos públicos|Public texts/ }).click(); await sleep(1200) }
    const key = KEYS.find(k => !k.startsWith('landing.nav') && k) ; const fid = k => `#landing-${k.replace(/[^\w-]/g, '\\$&')}`
    for (const lang of ['es', 'en']) {
      const p = await open(S, { lang, url: '/admin/content', wait: 1800 }); await tabClick(p)
      const input = p.locator(`input[id="landing-${KEYS[20]}"]`); await input.waitFor({ timeout: 8000 }); await input.fill(`qa5 UI ${lang}`)
      const row = input.locator('xpath=ancestor::li[1]'); const resp = p.waitForResponse(r => r.url().endsWith('/api/landing-content') && r.request().method() === 'PUT', { timeout: 8000 })
      await row.getByRole('button', { name: /Guardar|Save/ }).click(); const r = await resp; await sleep(800)
      const saved = (await call("GET", "/api/landing-content?lang=es")).j[KEYS[20]]; const msg = await row.locator('p[role=status]').innerText().catch(() => '')
      ck(`U1 [${lang}] guardar una fila real de «Textos públicos» → 200, mensaje de éxito y texto publicado`, r.status() === 200 && saved === `qa5 UI ${lang}` && /Guardado|Saved/i.test(msg), JSON.stringify({ st: r.status(), saved, msg })); await p.c.close()
    }
    { // conflicto de edición (#380): otra persona guarda entre la lectura y mi guardado
      const p = await open(S, { lang: 'es', url: '/admin/content', wait: 1800 }); await tabClick(p); const k = KEYS[21]
      await put(S.token, { key: k, lang: 'es', value: 'qa5 ajeno' }); await sleep(300)
      const input = p.locator(`input[id="landing-${k}"]`); await input.fill('qa5 mío'); const row = input.locator('xpath=ancestor::li[1]'); await row.getByRole('button', { name: /Guardar/ }).click(); await sleep(1200)
      const t = await row.innerText(); const still = await input.inputValue()
      ck('U2 conflicto de edición #380 intacto: aviso en la fila, lo escrito se conserva y no se guardó lo mío', /Otra persona|cambió|Usar la suya|Conservar la mía/i.test(t) && still === 'qa5 mío' && (await call('GET', '/api/landing-content?lang=es')).j[k] === 'qa5 ajeno', t.replace(/\s+/g, ' ').slice(0, 160)); await p.c.close()
    }
    { // admin (no super): ve, no guarda
      const p = await open(ADM, { lang: 'es', url: '/admin/content', wait: 1800 }); await tabClick(p); const k = KEYS[22]
      const input = p.locator(`input[id="landing-${k}"]`); await input.waitFor({ timeout: 8000 }); await input.fill('qa5 admin'); const row = input.locator('xpath=ancestor::li[1]'); await row.getByRole('button', { name: /Guardar/ }).click(); await sleep(1200)
      const t = await row.innerText(); ck('U3 admin sin superadministración: «Solo superadmin puede guardar textos.» y NO se guarda (403)', /Solo superadmin/i.test(t) && (await call('GET', '/api/landing-content?lang=es')).j[k] !== 'qa5 admin', t.replace(/\s+/g, ' ').slice(0, 120)); await p.c.close()
    }
    { // 400 unknown_key (forzado: la pantalla nunca lo produce) → aviso por fila y texto conservado; las demás filas no cambian
      const p = await open(S, { lang: 'es', url: '/admin/content', wait: 1800 }); await tabClick(p); const k = KEYS[23], other = KEYS[24]
      await p.route(u => new URL(u).pathname === '/api/landing-content', rt => rt.request().method() === 'PUT' ? rt.continue({ postData: JSON.stringify({ ...JSON.parse(rt.request().postData()), key: 'no_existe_ui' }) }) : rt.continue())
      const input = p.locator(`input[id="landing-${k}"]`); await input.waitFor({ timeout: 8000 }); await input.fill('qa5 no se pierde'); const otherVal = await p.locator(`input[id="landing-${other}"]`).inputValue(); const row = input.locator('xpath=ancestor::li[1]')
      const b0 = await rows(); await row.getByRole('button', { name: /Guardar/ }).click(); await sleep(1500)
      const t = await row.locator('p[role=status]').innerText().catch(() => ''); const globalErr = await p.locator('[role=alert]').count()
      ck('U4 400 unknown_key forzado: aviso «Error guardando.» en ESA fila, el texto escrito se conserva, las otras filas no cambian, sin fila nueva', (!PR || /Error guardando/.test(t)) && (await input.inputValue()) === 'qa5 no se pierde' && (await p.locator(`input[id="landing-${other}"]`).inputValue()) === otherVal && (await rows()) === b0, JSON.stringify({ t, globalErr })); await p.c.close()
    }
    const ax = []; for (const [w, scheme] of [[1360, 'light'], [390, 'dark']]) { const p = await open(S, { lang: 'es', w, scheme, theme: scheme, url: '/admin/content', wait: 1500 }); await tabClick(p); ax.push(await axeRun(p)); await p.c.close() }
    ck('U5 axe wcag2a/2aa/21a/21aa/22aa = 0 en «Textos públicos» (1360 claro, 390 oscuro)', ax.every(a => a.length === 0), JSON.stringify(ax))
  }
  ck('0 × 5xx en todo el guion', n500 === 0, String(n500))
  await L.done(); srv?.close?.(); process.exit(0)
})().catch(e => { console.error('FALLO', e); process.exit(1) })
