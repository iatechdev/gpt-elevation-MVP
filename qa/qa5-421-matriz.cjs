// [QA-Claude-5] PR #421 (ES-303 PR B): matriz axe + desborde + errores de JS en CADA estado de las dos pantallas × 1360/390/320 × claro/oscuro × ES/EN (84 por lado). Backend real. Datos sintéticos.
// Uso: igual que qa5-421-persona.cjs, con cred421.json recién sembrado (qa5-421-seed.cjs) y sin tope de IP agotado.
const fs = require('fs'); const crypto = require('crypto'); const { chromium } = require(process.env.PLAYWRIGHT_MODULE); const axeSource = fs.readFileSync(process.env.AXE, 'utf8'); const { Client } = require('pg')
const BASE = process.env.BASE, API = process.env.API; const U = JSON.parse(fs.readFileSync((process.env.QA_TOOLS || '.') + '/qa5/cred421.json', 'utf8')).users
let ok = 0, bad = 0; const check = (l, c, ev) => { if (c) { ok++ } else { bad++; console.log('FALLA ' + l + (ev !== undefined ? ' · ' + String(ev).slice(0, 500) : '')) } }
const call = async (tk, m, p, b) => { const r = await fetch(API + p, { method: m, headers: { 'content-type': 'application/json', ...(tk ? { Authorization: 'Bearer ' + tk } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) }); let j = null; try { j = await r.json() } catch {} return { status: r.status, body: j } }
const sql = async (q, a) => { const c = new Client({ connectionString: process.env.DATABASE_URL }); await c.connect(); const r = await c.query(q, a); await c.end(); return r }
const mkInvite = async (rev) => { const r = await call(U[rev].token, 'POST', '/api/reviewer/invites', { requestId: crypto.randomUUID() }); if (r.status !== 201) throw new Error('invitación ' + r.status); return { code: r.body.code, id: r.body.invite.id } }
const axe = (page) => page.addScriptTag({ content: axeSource }).then(() => page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }).then((r) => r.violations.map((x) => x.id + ':' + x.nodes.length + ' ' + (x.nodes[0] && x.nodes[0].target.join(' '))))))
const open = async (br, { user, width, lang, scheme, hash = '', route }) => { const ctx = await br.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', colorScheme: scheme }); const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message))
  const u = U[user]; await page.addInitScript(([tk, rl, name, l]) => { localStorage.setItem('elevation_token', tk); localStorage.setItem('elevation_role', rl); localStorage.setItem('elevation_name', name); localStorage.setItem('elv_lang', l) }, [u.token, u.role, u.name, lang]); if (route) await route(page)
  await page.goto(BASE + '/app/professional-reviews' + hash); await page.waitForSelector('h2', { timeout: 20000 }); await page.waitForTimeout(700); return { ctx, page, errs } }
const measure = async (label, page, errs) => { const v = await axe(page); const o = await page.evaluate(() => ({ ox: document.documentElement.scrollWidth > innerWidth + 1, wide: [...document.querySelectorAll('.rv-card, .rv-stack, .rv-code, .rv-row, .rv-chk')].filter((e) => e.getBoundingClientRect().right > innerWidth + 1).length })); check(`axe=0, sin desborde y sin errores de JS · ${label}`, v.length === 0 && !o.ox && o.wide === 0 && errs.length === 0, JSON.stringify({ v, o, errs })) }
const COMBOS = []; for (const width of [1360, 390, 320]) for (const scheme of ['light', 'dark']) for (const lang of ['es', 'en']) COMBOS.push({ width, scheme, lang })
const clickBtn = (page, es, en, lang) => page.click(`button:has-text("${lang === 'es' ? es : en}")`)
;(async () => {
  const br = await chromium.launch()
  const fresh = async () => { const rows = (await call(U.rev1.token, 'GET', '/api/reviewer/invites')).body.invites.filter((i) => i.status === 'active'); for (const r of rows) await call(U.rev1.token, 'DELETE', '/api/reviewer/invites/' + r.id) }
  // preparación persona: A autoriza a rev1 (luego retirada) y a rev2 (vigente) por la API (UN canje cada una)
  await fresh()
  const ev = (await call(U.pA.token, 'GET', '/api/evidence')).body.evidence.map((e) => e.id)
  for (const [rev, withdraw] of [['rev1', true], ['rev2', false]]) { const c = await mkInvite(rev); const r = await call(U.pA.token, 'POST', '/api/me/review-shares', { inviteCode: c.code, evidenceIds: ev.slice(0, 2), requestId: crypto.randomUUID() }); if (r.status !== 201) console.log('canje', rev, r.status); if (withdraw) await call(U.pA.token, 'DELETE', '/api/me/review-shares/' + r.body.share.id) }
  for (const c of COMBOS) {
    const L = `${c.width}px ${c.scheme} ${c.lang}`
    { const { ctx, page, errs } = await open(br, { user: 'pB', ...c }); await measure('persona · vacío · ' + L, page, errs); await ctx.close() }
    { const code = (await mkInvite('rev1')).code; const { ctx, page, errs } = await open(br, { user: 'pB', ...c, hash: '#code=' + code }); await measure('persona · código por enlace (aviso) · ' + L, page, errs); await ctx.close() }
    { const { ctx, page, errs } = await open(br, { user: 'pB', ...c }); await page.fill('input', 'ABCD-EFGH-JKMN-PQRS'); await clickBtn(page, 'Continuar', 'Continue', c.lang); await page.waitForTimeout(1000); await measure('persona · código no válido (404 uniforme) · ' + L, page, errs); await ctx.close() }
    { const { ctx, page, errs } = await open(br, { user: 'pA', ...c }); await measure('persona · lista con una activa y una retirada · ' + L, page, errs); await ctx.close() }
    { const code = (await mkInvite('rev1')).code; let fail = true; const { ctx, page, errs } = await open(br, { user: 'pA', ...c, hash: '#code=' + code, route: async (pg) => { await pg.route('**/api/me/review-shares', (route) => (route.request().method() === 'POST' && fail ? route.fulfill({ status: 500, json: {} }) : route.continue())) } })
      await clickBtn(page, 'Continuar', 'Continue', c.lang); await page.waitForSelector('fieldset'); await page.waitForTimeout(500); await measure('persona · elegir evidencias (nada marcado, título largo) · ' + L, page, errs)
      await page.locator('fieldset label').nth(1).click(); await page.locator('fieldset label').nth(0).click(); await page.click('button:has-text("' + (c.lang === 'es' ? 'Autorizar a' : 'Authorize Ana') + '")'); await page.waitForSelector('.cg-banner[class*=error], .cg-banner', { timeout: 8000 }); await page.waitForTimeout(500); await measure('persona · error al autorizar con Reintentar · ' + L, page, errs); await ctx.close() }
    { const code = (await mkInvite('rev1')).code; const { ctx, page, errs } = await open(br, { user: 'pB', ...c, hash: '#code=' + code }); await clickBtn(page, 'Continuar', 'Continue', c.lang); await page.waitForSelector('fieldset'); await page.waitForTimeout(500); await measure('persona · sin evidencias para compartir · ' + L, page, errs); await ctx.close() }
    await fresh()
  }
  console.log(`MATRIZ persona: ${ok} correctas, ${bad} fallos`); const okP = ok, badP = bad; ok = 0; bad = 0
  // ── revisor: vacío (rev1 limpio), lista con 4 estados, panel del código, diálogo, tope, error de lista
  await sql('DELETE FROM "ReviewerInvites" WHERE "reviewerId"=(SELECT id FROM "Users" WHERE email=$1)', [U.rev1.email])
  for (const c of COMBOS) { const L = `${c.width}px ${c.scheme} ${c.lang}`; const { ctx, page, errs } = await open(br, { user: 'rev1', ...c }); await measure('revisor · vacío · ' + L, page, errs); await ctx.close() }
  { const a = await mkInvite('rev1'), u = await mkInvite('rev1'), e = await mkInvite('rev1'), r = await mkInvite('rev1'); await sql('UPDATE "ReviewerInvites" SET "usedAt"=now(), "usedByUserId"=(SELECT id FROM "Users" WHERE email=$2) WHERE id=$1', [u.id, U.pA.email]); await sql('UPDATE "ReviewerInvites" SET "expiresAt"=now()-interval \'1 hour\' WHERE id=$1', [e.id]); await call(U.rev1.token, 'DELETE', '/api/reviewer/invites/' + r.id) }
  for (const c of COMBOS) { const L = `${c.width}px ${c.scheme} ${c.lang}`
    { const { ctx, page, errs } = await open(br, { user: 'rev1', ...c }); await measure('revisor · lista con activa, usada, vencida y anulada · ' + L, page, errs); await ctx.close() }
    { const { ctx, page, errs } = await open(br, { user: 'rev1', ...c }); await clickBtn(page, 'Crear invitación', 'Create invitation', c.lang); await page.waitForSelector('.rv-code'); await page.waitForTimeout(500); await measure('revisor · código nuevo (panel no modal) · ' + L, page, errs); await ctx.close(); await fresh() }
    { const a = await mkInvite('rev1'); const { ctx, page, errs } = await open(br, { user: 'rev1', ...c }); await page.locator('.rv-row button').first().click(); await page.waitForSelector('dialog[open]'); await page.waitForTimeout(400); await measure('revisor · diálogo de anular abierto · ' + L, page, errs); await ctx.close(); await fresh() }
    { let n = 0; const { ctx, page, errs } = await open(br, { user: 'rev1', ...c, route: async (pg) => { await pg.route('**/api/reviewer/invites', (route) => (route.request().method() === 'GET' ? route.fulfill({ status: 500, json: {} }) : route.continue())) } }); await page.waitForTimeout(800); await measure('revisor · error de la lista con Reintentar · ' + L, page, errs); await ctx.close() }
    { for (let i = 0; i < 10; i++) await mkInvite('rev1'); const { ctx, page, errs } = await open(br, { user: 'rev1', ...c }); await measure('revisor · tope de 10 activas · ' + L, page, errs); await ctx.close(); await fresh() }
  }
  console.log(`MATRIZ revisor: ${ok} correctas, ${bad} fallos`); console.log(`TOTAL: ${okP + ok} correctas, ${badP + bad} fallos`); await br.close(); process.exit(bad + badP ? 1 : 0)
})().catch((e) => { console.error('ABORTA', e); process.exit(2) })
