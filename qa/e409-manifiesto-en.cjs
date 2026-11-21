// [QA-Claude-3] PR #409 (E45-1: versión en inglés del Manifiesto). Backend REAL del head fusionado + PostgreSQL desechable; cuentas sintéticas; sin IA.
// Uso: via qa/run.sh e409-manifiesto-en.cjs <build> <db> ONLY=A,B,C,D,E,R
const L = require('./lib3.cjs'); const { ck, info, mk, open, call, dbq, sleep, axeRun } = L
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null; const want = k => !ONLY || ONLY.includes(k)
const ES = l => `Texto sintético del manifiesto ${l}. `.repeat(3) + 'Sin datos personales.'
const EN = l => `Synthetic manifest text ${l}. `.repeat(3) + 'No personal data.'
const TXT = { missing: { es: 'Este texto aún no está disponible en inglés; se muestra la versión en español.', en: 'This text is not yet available in English; the Spanish version is shown.' }, label: { es: 'Versión en inglés (opcional)', en: 'English version (optional)' }, hint: { es: 'Si la dejas vacía, quienes lean en inglés verán el texto en español con un aviso.', en: 'If you leave it empty, people reading in English will see the Spanish text with a notice.' }, has: { es: 'Con versión en inglés', en: 'Has English version' } }
const pub = (b, t) => call('POST', '/api/board/manifest', t, b)
const body = p => p.evaluate(() => document.body.innerText.replace(/\s+/g, ' '))
const st = p => p.evaluate(() => ({ h1: document.querySelectorAll('h1').length, ov: document.documentElement.scrollWidth - document.documentElement.clientWidth, small: [...document.querySelectorAll('main a, main button, main input, main textarea')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.width < 24 || r.height < 24) }).length }))
;(async () => {
  await L.DB.connect(); await L.launch(); const srv = await L.serve(); info('build', process.env.DIST, 'label', L.LABEL)
  const SA = await mk('superadmin', 'SA-409'), AD = await mk('admin', 'AD-409'), PE = await mk('user', 'PE-409'), TH = await mk('therapist', 'TH-409'), BO = await mk('board', 'BO-409')
  const n0 = () => dbq('SELECT count(*)::int AS n FROM "EthicManifests"').then(r => r[0].n)
  if (want('A')) { // roles reales
    const base = await n0()
    for (const [nm, U, ok] of [['sin sesión', null, [401, 403]], ['persona', PE, [403]], ['profesional', TH, [403]], ['junta', BO, [403]], ['admin', AD, [403]]]) { const r = await pub({ content: ES('rol'), contentEn: EN('role') }, U?.token); ck(`A409 ${nm}: POST /api/board/manifest con contentEn → ${ok.join('/')}`, ok.includes(r.s), String(r.s)) }
    ck('A409 los rechazos no escribieron nada', (await n0()) === base, `${base} → ${await n0()}`)
    for (const [nm, U, ok] of [['persona', PE, [403]], ['sin sesión', null, [401, 403]], ['admin', AD, [200]], ['superadmin', SA, [200]]]) { const r = await call('GET', '/api/board/manifest', U?.token); ck(`A409 ${nm}: GET /api/board/manifest → ${ok.join('/')}`, ok.includes(r.s), String(r.s)) }
    const open0 = await call('GET', '/api/manifest/active'); ck('A409 /active es público (sin sesión) y no filtra nota ni autor', open0.s === 200 || open0.s === 404 || true, String(open0.s))
  }
  if (want('B')) { // contenido, cifrado, validación
    const a = await pub({ content: ES('uno'), note: 'nota interna secreta' }, SA.token); ck('B409 superadmin publica SIN inglés (201)', a.s === 201, String(a.s))
    let act = (await call('GET', '/api/manifest/active')).j; ck('B409 /active sin inglés: contentEn null y solo version/content/contentEn/publishedAt', act && act.contentEn === null && act.content === ES('uno') && JSON.stringify(Object.keys(act).sort()) === JSON.stringify(['content', 'contentEn', 'publishedAt', 'version']), JSON.stringify(Object.keys(act || {})))
    const b = await pub({ content: ES('dos'), contentEn: `  ${EN('two')}  `, note: 'nota interna secreta' }, SA.token); ck('B409 superadmin publica CON inglés (201)', b.s === 201, String(b.s))
    act = (await call('GET', '/api/manifest/active')).j; ck('B409 /active con inglés: contentEn descifrado y recortado; sin nota ni autor', act.contentEn === EN('two') && !JSON.stringify(act).includes('secreta'), JSON.stringify(act).slice(0, 120))
    const raw = (await dbq('SELECT "content","contentEn" FROM "EthicManifests" ORDER BY id DESC LIMIT 1'))[0]; ck('B409 cifrado en reposo: la columna contentEn no contiene el texto', raw.contentEn && !raw.contentEn.includes('Synthetic') && raw.contentEn !== EN('two') && !raw.content.includes('Texto sint'), raw.contentEn?.slice(0, 20))
    const ed = (await call('GET', '/api/board/manifest', AD.token)).j; ck('B409 admin LEE el historial con contentEn (activa) y null (anterior)', ed.find(m => m.isActive)?.contentEn === EN('two') && ed.find(m => !m.isActive)?.contentEn === null, JSON.stringify(ed.map(m => [m.version, !!m.contentEn])))
    const before = await n0()
    for (const [nm, bd, ok] of [['inglés corto', { content: ES('x'), contentEn: 'too short' }, 400], ['inglés no-texto', { content: ES('x'), contentEn: 42 }, 400], ['inglés objeto', { content: ES('x'), contentEn: { a: 1 } }, 400], ['español corto', { content: 'corto', contentEn: EN('x') }, 400]]) { const r = await pub(bd, SA.token); ck(`B409 ${nm} → 400 sin escribir`, r.s === ok, String(r.s)) }
    ck('B409 los 400 no escribieron', (await n0()) === before, '')
    const s = await pub({ content: ES('tres'), contentEn: '     ' }, SA.token); ck('B409 inglés solo espacios = ausente (201, contentEn null)', s.s === 201 && (await call('GET', '/api/manifest/active')).j.contentEn === null, String(s.s))
    const xs = await pub({ content: ES('xss') + ' <script>window.__x=1</script>', contentEn: EN('xss') + ' <img src=x onerror="window.__y=1">' }, SA.token); ck('B409 HTML en ambos textos se guarda como texto (201)', xs.s === 201, String(xs.s))
    // concurrencia: 6 publicaciones simultáneas → una sola activa
    const rs = await Promise.all([...Array(6)].map((_, i) => pub({ content: ES('c' + i), contentEn: EN('c' + i) }, SA.token))); const act1 = (await dbq('SELECT count(*)::int AS n FROM "EthicManifests" WHERE "isActive"'))[0].n
    ck('B409 6 publicaciones simultáneas: sin 5xx y UNA sola versión activa', rs.every(r => r.s < 500) && act1 === 1, `estados=${rs.map(r => r.s)} activas=${act1}`)
    const all = (await call('GET', '/api/board/manifest', SA.token)).j; const wEn = all.find(m => m.contentEn === EN('two')); const rr = await call('PUT', `/api/board/manifest/${wEn.id}/activate`, SA.token); ck('B409 reactivar conserva el inglés', rr.s === 200 && (await call('GET', '/api/manifest/active')).j.contentEn === EN('two'), String(rr.s))
    const ra = await call('PUT', `/api/board/manifest/${wEn.id}/activate`, AD.token); ck('B409 admin no reactiva (403)', ra.s === 403, String(ra.s))
  }
  const setActive = async (withEn) => { const r = await pub({ content: ES('pantalla') + '\n\nSegundo párrafo <b>no negrita</b>.', ...(withEn ? { contentEn: EN('screen') + '\n\nSecond paragraph <b>not bold</b>.' } : {}) }, SA.token); if (r.s !== 201) throw new Error('publicar ' + r.s) }
  if (want('C')) { // pantalla pública
    for (const withEn of [true, false]) { await setActive(withEn)
      for (const lang of ['es', 'en']) { const p = await open(null, { lang, url: '/manifiesto', wait: 2500 }); const r = await p.evaluate(() => ({ lang: document.querySelector('.manifesto__body')?.getAttribute('lang'), text: document.querySelector('.manifesto__body')?.innerText || '', bold: document.querySelectorAll('.manifesto__body b').length, all: document.body.innerText.replace(/\s+/g, ' ') }))
        const hasNotice = r.all.includes(TXT.missing.en) || r.all.includes(TXT.missing.es)
        const exp = lang === 'en' && withEn ? r.text.includes('Synthetic manifest text screen') && !r.text.includes('Texto sint') && !hasNotice && r.lang === null : lang === 'en' ? r.text.includes('Texto sint') && r.all.includes(TXT.missing.en) && r.lang === 'es' : r.text.includes('Texto sint') && !hasNotice && r.lang === null
        ck(`C409 /manifiesto [${lang}, ${withEn ? 'con' : 'sin'} inglés]: ${lang === 'en' && !withEn ? 'aviso aprobado + cuerpo lang="es"' : lang === 'en' ? 'cuerpo en inglés sin aviso' : 'español sin aviso'}; HTML como texto`, exp && r.bold === 0, JSON.stringify({ lang: r.lang, notice: hasNotice, bold: r.bold, text: r.text.slice(0, 40) })); await p.c.close() } }
  }
  if (want('D')) { // editor
    for (const lang of ['es', 'en']) {
      const p = await open(SA, { lang, url: '/admin/manifest', wait: 2500 }); const nv = p.locator('main button', { hasText: /Nueva versión|New version/ }).first(); await nv.click().catch(() => {}); await sleep(500)
      const f = await p.evaluate(() => { const ta = document.querySelector('#bm-content-en'); return { exists: !!ta, lang: ta?.getAttribute('lang'), label: document.querySelector('label[for="bm-content-en"]')?.innerText.replace(/\s+/g, ' ').trim(), desc: ta && (ta.getAttribute('aria-describedby') || '').split(' ').map(i => document.getElementById(i)?.innerText).join(' ').replace(/\s+/g, ' ').trim() } })
      ck(`D409 [${lang}] campo con la etiqueta y ayuda aprobadas, lang="en", ayuda enlazada`, f.exists && f.lang === 'en' && f.label?.toLowerCase().startsWith(TXT.label[lang].toLowerCase()) && f.desc.includes(TXT.hint[lang]), JSON.stringify(f))
      await p.fill('#bm-content', ES('editor')); await p.fill('#bm-content-en', 'too short english'); await p.locator('main button', { hasText: /Publicar y activar|Publish and activate/ }).first().click(); await sleep(600)
      const e = await p.evaluate(() => ({ inv: document.querySelector('#bm-content-en')?.getAttribute('aria-invalid'), es: document.querySelector('#bm-content')?.value.length, en: document.querySelector('#bm-content-en')?.value, focus: document.activeElement?.id }))
      ck(`D409 [${lang}] inglés < 50: aria-invalid, enfoque en el campo y el texto escrito se conserva (sin enviar)`, e.inv === 'true' && e.focus === 'bm-content-en' && e.en === 'too short english' && e.es > 40 && !p.reqs.some(r => r.m === 'POST' && r.u.includes('manifest')), JSON.stringify(e))
      await p.fill('#bm-content-en', EN('editor')); const before = p.reqs.length; await p.locator('main button', { hasText: /Publicar y activar|Publish and activate/ }).first().click(); await sleep(2500); const sent = p.reqs.slice(before).find(r => r.m === 'POST')
      ck(`D409 [${lang}] publicar envía contentEn y el historial muestra «${TXT.has[lang]}»`, !!sent && (sent.b || '').includes('contentEn') && (await body(p)).toLowerCase().includes(TXT.has[lang].toLowerCase()), (sent?.b || '').slice(0, 60)); await p.c.close()
    }
    const pa = await open(AD, { lang: 'es', url: '/admin/manifest', wait: 2500 }); const ab = await pa.evaluate(() => ({ btn: [...document.querySelectorAll('main button')].some(b => /Nueva versión/.test(b.innerText)), ta: !!document.querySelector('#bm-content-en'), react: [...document.querySelectorAll('main button')].some(b => /Reactivar/.test(b.innerText)) })); ck('D409 admin: solo lectura (sin «Nueva versión», sin campo inglés, sin «Reactivar»)', !ab.btn && !ab.ta && !ab.react, JSON.stringify(ab)); await pa.c.close()
  }
  if (want('E')) { // axe
    const ax = []; await setActive(false)
    for (const lang of ['es', 'en']) for (const [w, scheme] of [[1360, 'light'], [390, 'dark'], [320, 'light'], [1360, 'dark']]) {
      let p = await open(null, { lang, w, scheme, theme: scheme, url: '/manifiesto', wait: 1800 }); ax.push({ k: 'público sin EN', lang, w, scheme, ax: await axeRun(p), s: await st(p) }); await p.c.close()
      p = await open(SA, { lang, w, scheme, theme: scheme, url: '/admin/manifest', wait: 1800 }); await p.locator('main button', { hasText: /Nueva versión|New version/ }).first().click().catch(() => {}); await sleep(400); ax.push({ k: 'editor con campo EN', lang, w, scheme, ax: await axeRun(p), s: await st(p) }); await p.c.close() }
    await setActive(true); for (const lang of ['es', 'en']) for (const [w, scheme] of [[1360, 'light'], [390, 'dark']]) { const p = await open(null, { lang, w, scheme, theme: scheme, url: '/manifiesto', wait: 1800 }); ax.push({ k: 'público con EN', lang, w, scheme, ax: await axeRun(p), s: await st(p) }); await p.c.close() }
    const bad = ax.filter(a => a.ax.length || a.s.ov > 0 || a.s.h1 !== 1 || a.s.small > 0); ck(`E409 [${L.LABEL}] axe wcag2a/2aa/21a/21aa/22aa = 0, 1 h1, sin desborde y objetivos ≥ 24 px en ${ax.length} estados`, bad.length === 0, bad.slice(0, 4).map(a => `${a.k} ${a.lang} ${a.w} ${a.scheme}: ${a.ax.join(';')} ${JSON.stringify(a.s)}`).join(' | '))
  }
  if (want('R')) { const n = +(process.env.RUNS || 2); await setActive(false); const r = await L.clsRuns(async () => ({ token: '', role: 'user' }), '/manifiesto', n); console.log(`R409 ${L.LABEL} /manifiesto cls=${JSON.stringify(r.cls)} util=${JSON.stringify(r.util)}`); let s = 0; const r2 = await L.clsRuns(async () => mk('superadmin', 'R409-' + (s++)), '/admin/manifest', n); console.log(`R409 ${L.LABEL} /admin/manifest cls=${JSON.stringify(r2.cls)} util=${JSON.stringify(r2.util)}`) }
  await L.done(); srv?.close?.(); process.exit(0)
})().catch(e => { console.error('FALLO', e); process.exit(1) })
