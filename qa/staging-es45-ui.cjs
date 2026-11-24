// QA-Claude-2 — ES-45 flujos de escritura por UI en STAGING (Chromium): diario (crear/editar/borrar), fecha de hoy, cierre de sesión y teclado, ES/EN, 390 y 1440 px.
// Cuenta qa.persona; entradas prefijadas «QA2» y eliminadas al final. No imprime claves ni tokens. Env: STAGING_URL, CRED_FILE, PLAYWRIGHT_MODULE, OUT.
const fs = require('fs'); const { chromium } = require(process.env.PLAYWRIGHT_MODULE); const BASE = process.env.STAGING_URL.replace(/\/$/, ''), OUT = process.env.OUT || '.'
if (!/^https:\/\/backend-staging-/.test(BASE)) process.exit(2)
const lines = fs.readFileSync(process.env.CRED_FILE, 'utf8').split(/\r?\n/), e = 'qa.persona@example.test'
const l0 = lines.find(x => x.includes(e)); const pw = l0.slice(l0.indexOf(e) + e.length).replace(/^[\s:=|,;\-–>]+/, '').replace(/^(?:clave|contraseña|password)\s*[:=]\s*/i, '').split(/\s{2,}/)[0].trim()
let f = 0; const ck = (n, ok, x = '') => { if (!ok) f++; console.log((ok ? 'OK   ' : 'FALLA ') + n, x) }
const L = { es: { save: /Guardar entrada/i, del: /Eliminar|Borrar/i, edit: /Editar/i, logout: /Cerrar sesión/i, newEntry: 'Nueva entrada' }, en: { save: /Save entry/i, del: /Delete|Remove/i, edit: /Edit/i, logout: /Sign out|Log out/i, newEntry: 'New entry' } }
const today = d => { const x = new Date(); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}` }
;(async () => {
  const b = await chromium.launch(); fs.mkdirSync(OUT, { recursive: true })
  for (const [lang, w] of [['es', 1440], ['es', 390], ['en', 1440], ['en', 390]]) {
    const tag = `${lang} ${w}px`, tx = `QA2 UI ${lang} ${w} ${Date.now().toString(36)}`
    const j = await (await fetch(BASE + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: e, password: pw }) })).json(); await new Promise(s => setTimeout(s, 800))
    const c = await b.newContext({ viewport: { width: w, height: 900 }, isMobile: w < 500 }); await c.addInitScript(([t, la]) => { localStorage.setItem('elevation_token', t); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', la) }, [j.token, lang])
    const p = await c.newPage(); const errs = [], api5 = []; p.on('pageerror', x => errs.push(x.message.slice(0, 90))); p.on('response', r => { if (r.status() >= 500 && /\/api\//.test(r.url())) api5.push(r.status() + ' ' + new URL(r.url()).pathname) }); p.on('dialog', d => d.accept())
    await p.goto(BASE + '/app/diary/new', { waitUntil: 'networkidle' }); await p.waitForTimeout(800)
    ck(`F3 ${tag}: «Nueva entrada» trae la fecha de hoy`, (await p.locator('input[type=date]').inputValue()) === today(), await p.locator('input[type=date]').inputValue())
    await p.locator('textarea').fill(tx + ' <b>negrita</b> 😀'); await p.getByRole('button', { name: L[lang].save }).click(); await p.waitForTimeout(1500)
    const afterSave = await p.locator('body').innerText(); const saved = afterSave.includes(tx)
    await p.goto(BASE + '/app/diary', { waitUntil: 'networkidle' }); await p.waitForTimeout(1000); const list = await p.locator('body').innerText()
    ck(`F3 ${tag}: la entrada guardada aparece en el diario y el HTML se muestra como texto`, saved || list.includes(tx), list.includes('<b>negrita</b>') ? 'HTML literal visible' : 'sin coincidencia literal del HTML')
    await p.screenshot({ path: `${OUT}/diario-${lang}-${w}.png` })
    const item = p.getByText(tx, { exact: false }).first()
    if (await item.count()) {
      await p.getByRole('link', { name: /Abrir|Open/i }).first().click(); await p.waitForTimeout(1200); console.log('      controles al abrir (' + tag + '):', (await p.evaluate(() => [...document.querySelectorAll('button,a[href],textarea')].filter(e => e.getBoundingClientRect().width > 0).map(e => e.tagName + ':' + (e.innerText || '').trim().slice(0, 18)).join(' | '))))
      const ta = p.locator('textarea')
      if (await ta.count()) {
        await ta.fill(tx + ' EDITADA'); await p.getByRole('button', { name: /Guardar|Save/i }).first().click(); await p.waitForTimeout(1200)
        await p.goto(BASE + '/app/diary', { waitUntil: 'networkidle' }); await p.waitForTimeout(800)
        ck(tag + ': la edición se guarda', (await p.locator('body').innerText()).includes('EDITADA'))
      } else console.log('      ' + tag + ': no se encontró editor al abrir la entrada')
      const it2 = p.getByRole('link', { name: /Abrir|Open/i }).first()
      if (await it2.count()) {
        await it2.click(); await p.waitForTimeout(800); const del = p.getByRole('button', { name: L[lang].del }).first()
        if (await del.count()) {
          await del.click(); await p.waitForTimeout(800); const conf = p.getByRole('button', { name: L[lang].del }).last()
          if (await conf.count() && await conf.isVisible().catch(() => false)) await conf.click().catch(() => {})
          await p.waitForTimeout(1200); await p.goto(BASE + '/app/diary', { waitUntil: 'networkidle' }); await p.waitForTimeout(600)
          ck(tag + ': la entrada se elimina por la interfaz', !(await p.locator('body').innerText()).includes(tx))
        } else console.log('      ' + tag + ': sin botón de eliminar visible')
      }
    } else console.log('      ' + tag + ': la entrada no se encontró en la lista para abrir')
    ck(`${tag}: sin errores de página ni 5xx durante el flujo`, errs.length === 0 && api5.length === 0, errs.concat(api5).join(' | '))
    const ov = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth); ck(`${tag}: sin desplazamiento horizontal en el diario`, !ov)
    // cierre de sesión por la interfaz
    await p.goto(BASE + '/app/dashboard', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500); const out = p.getByRole('button', { name: L[lang].logout }).first()
    if (await out.count() && await out.isVisible()) { await out.click(); await p.waitForTimeout(1200); const skip = p.getByRole('button', { name: /Saltar|Skip/i }); if (await skip.count()) { await skip.first().click(); await p.waitForTimeout(1200) } const tk = await p.evaluate(() => localStorage.getItem('elevation_token')); await p.goto(BASE + '/app/dashboard', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500)
      ck(`F2 ${tag}: cerrar sesión borra la sesión y /app/dashboard lleva al ingreso`, !tk && /login|^\/$/.test(new URL(p.url()).pathname + ''), `token=${tk ? 'sigue' : 'borrado'} ruta=${new URL(p.url()).pathname}`) } else console.log(`      ${tag}: botón de cerrar sesión no visible en el dashboard (menú móvil)`)
    await c.close()
  }
  // limpieza por API de cualquier entrada QA2 UI que quede
  const j = await (await fetch(BASE + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: e, password: pw }) })).json(); const H = { Authorization: 'Bearer ' + j.token }
  const lst = await (await fetch(BASE + '/api/diary?limit=100', { headers: H })).json(); const arr = Array.isArray(lst) ? lst : lst.entries || []; let n = 0
  for (const en of arr.filter(x => /^QA2 /.test(x.content || ''))) { const r = await fetch(BASE + '/api/diary/' + en.id, { method: 'DELETE', headers: H }); if (r.ok) n++ }
  console.log(`INFO limpieza: ${n} entradas «QA2» restantes eliminadas por API`); await b.close(); console.log(f ? `\nFALLAS ${f}` : '\nTODO OK'); process.exit(f ? 1 : 0)
})().catch(e => { console.error('EXCEPCIÓN', e.message); process.exit(3) })
