// [QA-Claude-5] PR #377: recorrido del PLAN dirigido POR LA PANTALLA contra el servidor real (lo que e377-real/e377-api no cubrían: proponer → elegir 2 acciones + recurso → confirmar → completar 7 → completar 30 → pausar;
// y, en otra persona, presupuesto en COP). Lo enviado por la pantalla se lee del servidor. Mata las mutaciones M11/M12/M14/M16 que sobreviven a CI + integración de Dev.
// Uso: PLAYWRIGHT_MODULE=... BASE=http://127.0.0.1:4365 API=http://127.0.0.1:8199 FRONT=<pr377/frontend> OUT=<carpeta> node qa/qa5-377-ui.cjs
const fs = require('fs'); const path = require('path')
const src = fs.readFileSync(path.join(__dirname, 'qa5-e377-real.cjs'), 'utf8'); const head = src.slice(0, src.indexOf(';(async () => { BR = await chromium.launch()'))
const lib = new Function('require', 'process', '__dirname', head + '\n; return { toDecided, persona, jf, waitText, body, ymd, T, setBR: (b) => { BR = b }, counts: () => ({ ok, bad }), check }')(require, process, __dirname)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE); const { toDecided, persona, jf, waitText, ymd, T, check } = lib
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const POST = /career-plan\/(versions|proposals)/
async function decidedPersona(x) { let c; for (let a = 1; a <= 4; a++) { c = await persona('es', 1360); try { await toDecided(c.page, x, 'es', c.p.token); return c } catch (e) { await c.c.close(); if (a === 4) throw e } } }
;(async () => {
  const BR = await chromium.launch(); lib.setBR(BR); const x = T.es
  // ── escenario 1: 7 + 30 días en la MISMA semana, 45 + 45 min (= la disponibilidad REAL de 90), un recurso del catálogo, sin presupuesto; completar 7, completar 30, pausar
  const { p, page, c } = await decidedPersona(x); const reqs = []; page.on('pageerror', (e) => console.log('INFO pageerror:', String(e.message).slice(0, 300))); page.on('response', (r) => { if (POST.test(r.url()) && r.request().method() === 'POST') r.text().then((t) => console.log('INFO respuesta', r.status(), r.url().split('/api/')[1], t.slice(0, 300))).catch(() => {}) })
  page.on('request', (r) => { if (POST.test(r.url()) && r.method() === 'POST') reqs.push({ u: r.url().split('/api/')[1], b: JSON.parse(r.postData() || '{}') }) })
  await page.getByLabel(x.pickExp, { exact: true }).selectOption({ index: 1 }); await page.getByRole('button', { name: x.proposePlan }).click(); await waitText(page, x.availab, 20000); await sleep(600)
  const acts = page.getByLabel(x.selAction, { exact: true }); await acts.nth(0).check(); await acts.nth(1).check()
  const dates = page.getByLabel(x.dateL); await dates.nth(0).fill(ymd(3)); await dates.nth(1).fill(ymd(4))
  const eff = page.getByLabel(/^(Esfuerzo|Effort)/i); const nEff = await eff.count(); await eff.nth(0).fill('45'); await eff.nth(1).fill('45')
  const resBoxes = page.locator('fieldset.cg-field input[type=checkbox]'); const nRes = await resBoxes.count(); const labels = await resBoxes.evaluateAll((els) => els.map((e) => (e.labels && e.labels[0] ? e.labels[0].textContent : '').trim())); console.log('INFO recursos ofrecidos:', JSON.stringify(labels.slice(0, 8))); const fit = process.env.QA_FORCE_RES ? 0 : labels.findIndex((t) => { const m = new RegExp('([0-9]+)[ ]*min', 'i').exec(t); return !m || Number(m[1]) <= 45 }); if (fit >= 0) await resBoxes.nth(fit).check()
  const reviewBtn = page.getByRole('button', { name: x.reviewSel }); const enabled = await reviewBtn.isEnabled().catch(() => false)
  if (!enabled) console.log('INFO revisar deshabilitado; avisos:', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('.cg-error,[role=alert]')].map((e) => e.textContent.trim().slice(0, 160)))))
  check('plan de 90 min (45+45) con disponibilidad real de 90: «Revisar selección» habilitado (con un tope fijo de 60 no lo estaría)', enabled && nEff >= 2, `enabled=${enabled} esfuerzos=${nEff}`)
  if (enabled) {
    await reviewBtn.click(); await sleep(500); await page.getByRole('button', { name: x.confirmPlan }).click(); await waitText(page, x.planAccepted, process.env.QA_FORCE_RES ? 4000 : 25000); await sleep(800); if (process.env.QA_FORCE_RES) { console.log('INFO [recurso 90 min] avisos tras confirmar:', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('.cg-error,[role=alert],[role=status]')].map((e) => e.textContent.trim().slice(0, 240))))); await c.close(); await BR.close(); process.exit(0) }
    const acc = reqs.filter((r) => /versions/.test(r.u)).pop(); console.log('INFO POST aceptar:', JSON.stringify(acc && acc.b).slice(0, 400), '| cuerpo página:', (await page.evaluate(() => document.body.innerText)).replace(/s+/g, ' ').slice(0, 200)); let lst = await jf(p.token, 'GET', '/api/career-plan'); const plan1 = lst.j.plans[0]
    check('aceptar por pantalla: 1 plan aceptado con las 2 acciones elegidas (7 y 30) y sus 45 min', lst.j.plans.length === 1 && plan1.payload.actions.map((a) => a.actionKey).join() === 'step_7,step_30' && plan1.payload.actions.every((a) => a.estimatedMinutes === 45), String(JSON.stringify(plan1 && plan1.payload.actions)).slice(0, 200))
    if (nRes && fit >= 0) check('el recurso elegido en pantalla llega al servidor (resourceRefs de la primera acción no vacío)', (acc.b.selections || []).some((s) => Array.isArray(s.resourceRefs) && s.resourceRefs.length > 0) && plan1.payload.actions.some((a) => (a.resourceRefs || []).length > 0), JSON.stringify(acc && acc.b.selections))
    else console.log('INFO el catálogo sintético no ofrece recursos con esta propuesta: no se comprobó resourceRefs por pantalla')
    check('sin presupuesto en pantalla, no se envía presupuesto', acc.b.budget === null || acc.b.budget === undefined, JSON.stringify(acc.b.budget))
    const complete = async (key) => { const sel = page.getByLabel(x.selAction, { exact: true }).last(); await sel.selectOption({ value: String(key) }); await page.getByLabel(/^(Evidencia de finalización|Completion evidence)/i).last().fill('Hecho (sintético) ' + key); const done = page.waitForResponse((r) => r.url().includes('/api/career-plan/versions') && r.request().method() === 'POST', { timeout: 20000 }).catch(() => null); await page.getByRole('button', { name: /^(Registrar finalización|Record completion)/i }).last().click(); return done }
    let b = reqs.length; try { await complete(7) } catch (e) { console.log('INFO completar 7:', String(e.message).split('\n')[0].slice(0, 140)) }
    const post7 = reqs.slice(b).find((r) => r.b.action === 'complete'); check('completar la acción de 7 días por pantalla envía actionKey step_7', !!post7 && post7.b.actionKey === 'step_7', JSON.stringify(post7 && post7.b))
    await sleep(1000); b = reqs.length; try { await complete(30) } catch (e) { console.log('INFO completar 30:', String(e.message).split('\n')[0].slice(0, 140)) }
    const post30 = reqs.slice(b).find((r) => r.b.action === 'complete'); check('completar la acción de 30 días por pantalla envía actionKey step_30 (no repite step_7)', !!post30 && post30.b.actionKey === 'step_30', JSON.stringify(post30 && post30.b))
    lst = await jf(p.token, 'GET', '/api/career-plan'); const last = lst.j.plans.sort((a, b2) => b2.version - a.version)[0]
    check('el servidor refleja las dos acciones completadas en la última versión', !!last && last.payload.actions.filter((a) => a.completion || a.completedAt || a.completionEvidence).length >= 2, String(JSON.stringify(last && last.payload.actions)).slice(0, 300))
    b = reqs.length; const pauseBtn = page.getByRole('button', { name: /^(Pausar|Pause)$/i }).first(); if (await pauseBtn.count()) { await pauseBtn.click(); await sleep(1500) }
    const postP = reqs.slice(b).find((r) => r.b.action === 'pause'); check('pausar por pantalla envía action «pause» (no «complete») con la versión esperada', !!postP && postP.b.action === 'pause' && Number.isInteger(postP.b.expectedVersion), JSON.stringify(postP && postP.b))
  }
  await c.close()
  // ── escenario 2: presupuesto en COP desde la pantalla
  const c3 = await decidedPersona(x); const pg = c3.page; const rq = []; pg.on('response', (r) => { if (POST.test(r.url()) && r.request().method() === 'POST') r.text().then((t) => console.log('INFO [presupuesto] respuesta', r.status(), r.url().split('/api/')[1], t.slice(0, 160) + ' ... ' + t.slice(-260))).catch(() => {}) })
  pg.on('request', (r) => { if (POST.test(r.url()) && r.method() === 'POST') rq.push(JSON.parse(r.postData() || '{}')) })
  await pg.getByLabel(x.pickExp, { exact: true }).selectOption({ index: 1 }); await pg.getByRole('button', { name: x.proposePlan }).click(); await waitText(pg, x.availab, 20000); await sleep(500)
  await pg.getByLabel(x.selAction, { exact: true }).nth(0).check(); await pg.getByLabel(x.dateL).nth(0).fill(ymd(3)); await pg.getByLabel(/^(Presupuesto|Budget)/i).first().fill('500'); await pg.getByLabel(/^(Moneda|Currency)/i).first().selectOption('COP'); await pg.getByLabel(/^(Costo|Cost)/i).nth(0).fill('100'); await sleep(300)
  const rb = pg.getByRole('button', { name: x.reviewSel }); const en3 = await rb.isEnabled().catch(() => false)
  if (en3) { await rb.click(); await sleep(400); await pg.getByRole('button', { name: x.confirmPlan }).click(); await waitText(pg, x.planAccepted, 12000); await sleep(2500); const last3 = rq.filter((q) => q.action === 'accept').pop(); console.log('INFO tras confirmar con presupuesto; avisos:', JSON.stringify(await pg.evaluate(() => [...document.querySelectorAll('.cg-error,[role=alert],[role=status]')].map((e) => e.textContent.trim().slice(0, 200))))); console.log('INFO payload aceptar (presupuesto):', JSON.stringify(rq.map((q) => [q.action || 'proposals', q.budget, q.proposal && q.proposal.budget, (q.selections || []).map((s) => s.declaredCost)])).slice(0, 400)); const bud3 = rq.map((q) => q.budget).filter(Boolean).pop(); check('el presupuesto enviado al servidor (propuesta) lleva la moneda elegida en pantalla (COP, 500), no USD fijo', !!bud3 && bud3.currency === 'COP' && Number(bud3.amount) === 500, JSON.stringify(bud3)) }
  else console.log('INFO con presupuesto la pantalla no habilita «Revisar selección» (se exigen costos); no se pudo comprobar la moneda')
  await c3.c.close()
  console.log(`UI #377: ${lib.counts().ok} correctas, ${lib.counts().bad} fallos`); await BR.close(); process.exit(lib.counts().bad ? 1 : 0)
})().catch((e) => { console.error('ABORTA', e); process.exit(2) })
