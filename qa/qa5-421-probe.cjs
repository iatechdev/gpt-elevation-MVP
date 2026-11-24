// [QA-Claude-5] #421: sondas de foco del diálogo «Anular» y de duplicados del aviso de tope. Backend real. Datos sintéticos.
const fs = require('fs'); const crypto = require('crypto'); const { chromium } = require(process.env.PLAYWRIGHT_MODULE)
const BASE = process.env.BASE, API = process.env.API; const U = JSON.parse(fs.readFileSync((process.env.QA_TOOLS || '.') + '/qa5/cred421.json', 'utf8')).users
const call = async (tk, m, p, b) => { const r = await fetch(API + p, { method: m, headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + tk }, body: b === undefined ? undefined : JSON.stringify(b) }); let j = null; try { j = await r.json() } catch {} return { status: r.status, body: j } }
const open = async (br, user, lang = 'es') => { const ctx = await br.newContext({ viewport: { width: 1360, height: 900 }, reducedMotion: 'reduce' }); const page = await ctx.newPage(); const u = U[user]
  await page.addInitScript(([tk, rl, name, l]) => { localStorage.setItem('elevation_token', tk); localStorage.setItem('elevation_role', rl); localStorage.setItem('elevation_name', name); localStorage.setItem('elv_lang', l) }, [u.token, u.role, u.name, lang]); await page.goto(BASE + '/app/professional-reviews'); await page.waitForSelector('h2'); await page.waitForTimeout(900); return { ctx, page } }
const foc = (page) => page.evaluate(() => { const a = document.activeElement; return a === document.body ? 'BODY' : a.tagName + '.' + (a.className || '') + ' «' + (a.textContent || '').trim().slice(0, 30) + '»' })
;(async () => {
  const br = await chromium.launch()
  // sembrar 2 activas en rev1
  for (let i = 0; i < 3; i++) await call(U.rev1.token, 'POST', '/api/reviewer/invites', { requestId: crypto.randomUUID() })
  for (const how of ['Esc', 'Conservar (clic)', 'Conservar (Enter)', 'Sí, anular']) {
    const { ctx, page } = await open(br, 'rev1'); const btn = page.locator('.rv-row button:has-text("Anular")').first(); await btn.focus(); await page.keyboard.press('Enter'); await page.waitForSelector('dialog[open]'); const f0 = await foc(page)
    if (how === 'Esc') await page.keyboard.press('Escape'); else if (how === 'Conservar (clic)') await page.click('button:has-text("Conservar")'); else if (how === 'Conservar (Enter)') await page.keyboard.press('Enter'); else await page.click('button:has-text("Sí, anular")')
    await page.waitForTimeout(1200); console.log(`dialogo anular · ${how}: foco inicial ${f0} → foco final ${await foc(page)} · dialog abierto: ${await page.evaluate(() => !!document.querySelector('dialog[open]'))}`); await ctx.close() }
  // el diálogo existente (PersonReviews «Dialog»: salir con borrador) usa el mismo patrón: no se compara aquí
  // duplicados del aviso de tope
  { const act = (await call(U.rev2.token, 'GET', '/api/reviewer/invites')).body.invites.filter((i) => i.status === 'active'); for (let i = act.length; i < 10; i++) await call(U.rev2.token, 'POST', '/api/reviewer/invites', { requestId: crypto.randomUUID() })
    const { ctx, page } = await open(br, 'rev2'); const d = await page.evaluate(() => { const t = 'Ya tienes 10 invitaciones activas'; const all = [...document.querySelectorAll('*')].filter((e) => e.children.length === 0 && e.textContent.includes(t)); return { n: all.length, vis: all.map((e) => (e.className || e.tagName) + ':' + (e.offsetParent !== null)) } }); console.log('tope cargado con 10 activas: copias del aviso', JSON.stringify(d)); await ctx.close() }
  { const act = (await call(U.rev2.token, 'GET', '/api/reviewer/invites')).body.invites.filter((i) => i.status === 'active'); while (act.length > 9) { const x = act.shift(); await call(U.rev2.token, 'DELETE', '/api/reviewer/invites/' + x.id) }
    const { ctx, page } = await open(br, 'rev2'); await call(U.rev2.token, 'POST', '/api/reviewer/invites', { requestId: crypto.randomUUID() }); await page.click('button:has-text("Crear invitación")'); await page.waitForTimeout(1500)
    const d = await page.evaluate(() => { const t = 'Ya tienes 10 invitaciones activas'; const all = [...document.querySelectorAll('*')].filter((e) => e.children.length === 0 && e.textContent.includes(t)); return { n: all.length, vis: all.map((e) => (e.className || e.tagName) + ' vis=' + (e.getBoundingClientRect().width > 1 && getComputedStyle(e).clip !== 'rect(0px, 0px, 0px, 0px)')), roles: [...document.querySelectorAll('[role=alert]')].map((e) => e.textContent.trim().slice(0, 40)) } }); console.log('tope tras 409: copias del aviso', JSON.stringify(d), 'foco', await foc(page)); await ctx.close() }
  await br.close()
})().catch((e) => { console.error('ABORTA', e); process.exit(2) })
