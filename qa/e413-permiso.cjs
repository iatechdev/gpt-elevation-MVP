// [QA-Claude-3] PR #413 (F404-1): tras source_consent_revoked / source_consent_required el interruptor refleja «Retirado» sin cambiar de pestaña. Backend REAL (permisos, vista previa y confirmación reales);
// SOLO se simula el análisis con IA (/api/insights/proposals). El «otro dispositivo» retira el permiso por la API real justo antes de que la petición llegue al servidor. Datos sintéticos.
// Uso: via qa/run.sh e413-permiso.cjs <build> <db>  (LABEL=pr|main: en main el interruptor NO se actualiza = control positivo del defecto)
const L = require('./lib3.cjs'); const { ck, info, mk, open, call, dbq, sleep, axeRun } = L
const PR = L.LABEL === 'pr'
const T = { es: { analyze: 'Analizar mi chat', authorize: /Autorizar cruce/, confirm: 'Confirmar', changed: 'Los permisos cambiaron en otra pestaña o dispositivo. Los actualizamos.' }, en: { analyze: 'Analyze my chat', authorize: /Authorize crossing/, confirm: 'Confirm', changed: 'The permissions changed in another tab or device. We updated them.' } }
const setup = async name => { const U = await mk('user', name); await call('PUT', '/api/consents/professional_bridge', U.token, { status: 'granted' }); await call('PUT', '/api/consents/insights_chat', U.token, { status: 'granted' })
  const cols = (await dbq(`SELECT column_name FROM information_schema.columns WHERE table_name='ChatTurns'`)).map(r => r.column_name); const enc = L.crypto
  await dbq(`INSERT INTO "ChatTurns"("UserId","requestId","status","userContent","replyContent","createdAt","updatedAt") VALUES ($1,$2,'completed','x','y',now(),now())`, [U.id, 'qa3-413-' + U.id]); const id = (await dbq(`SELECT id FROM "ChatTurns" WHERE "UserId"=$1`, [U.id]))[0].id; return { U, turn: id, cols: cols.length } }
async function scenario({ lang, code, scheme = 'light', w = 1100, mockCode = false }) {
  const { U, turn } = await setup(`P413-${lang}-${code}-${scheme}-${Math.random().toString(36).slice(2, 6)}`); const hit = { consents: 0 }
  const revoke = () => call('PUT', '/api/consents/insights_chat', U.token, { status: 'revoked' })
  const routes = async p => { await p.route(x => new URL(x).pathname === '/api/insights/proposals', rt => rt.fulfill({ json: { insights: [{ key: 'energy_gives', text: 'Disfruto coordinar equipos pequeños', origins: [{ type: 'chat_turn', id: turn, quote: 'coordiné al equipo' }] }] } }))
    await p.route(x => new URL(x).pathname === '/api/consents' , async rt => { if (rt.request().method() === 'GET') hit.consents++; await rt.continue() })
    const target = code === 'source_consent_required' ? '/api/career-context/preview' : '/api/career-context/confirm'
    await p.route(x => new URL(x).pathname === target, async rt => { if (mockCode) return rt.fulfill({ status: 403, json: { code } }); await revoke(); await rt.continue() }) }
  const p = await open(U, { lang, w, scheme, theme: scheme, url: '/app/bridge', routes, wait: 2500 }); const sw = p.locator('[role="switch"][data-source="chat"]'); await sw.waitFor({ timeout: 15000 })
  const before = await sw.getAttribute('aria-checked'); await p.getByRole('button', { name: T[lang].analyze }).click(); await p.locator('.br-card').first().waitFor({ timeout: 15000 })
  const c0 = hit.consents; await p.locator('.br-card').first().getByRole('button', { name: T[lang].authorize }).click()
  await p.locator('.br-card').first().getByRole('button', { name: T[lang].confirm }).click(); await sleep(2000)
  const after = await sw.getAttribute('aria-checked'); const body = await p.evaluate(() => document.body.innerText.replace(/\s+/g, ' ')); const ax = await axeRun(p); const ov = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  const db = (await call('GET', '/api/consents', U.token)).j; const dbStatus = (db.consents || db).find?.(c => c.purpose === 'insights_chat')?.status
  const r = { before, after, notice: body.includes(T[lang].changed), reads: hit.consents - c0, ax, ov, dbStatus, errs: p.errs.length, reqs: process.env.DBG ? p.reqs.filter(x=>x.m!=='GET'||/consents|career/.test(x.u)).map(x=>x.m+' '+x.u.split('?')[0]).join(' | ') : undefined }; await p.c.close(); return r }
;(async () => {
  await L.DB.connect(); await L.launch(); const srv = await L.serve(); info('build', process.env.DIST, 'label', L.LABEL)
  for (const lang of (process.env.LANGS||'es,en').split(',')) for (const code of (process.env.CODES||'source_consent_revoked,source_consent_required').split(',')) for (const [scheme, w] of [['light', 1100], ['dark', 390]]) {
    const r = await scenario({ lang, code, scheme, w }); const tag = `${lang} ${code} ${scheme} ${w}`
    if (PR) ck(`F413 [${tag}] servidor real: el permiso quedó retirado en la base, el interruptor pasa true→false, hay ≥ 1 lectura de permisos tras el error, aviso «permisos cambiaron», axe 0, sin desborde, sin errores JS`, r.dbStatus === 'revoked' && r.before === 'true' && r.after === 'false' && r.reads >= 1 && r.notice && !r.ax.length && r.ov <= 0 && r.errs === 0, JSON.stringify(r))
    else info(`CONTROL main [${tag}]: ${JSON.stringify({ before: r.before, after: r.after, notice: r.notice, reads: r.reads, db: r.dbStatus })}`) }
  { const r = await scenario({ lang: 'es', code: 'source_consent_revoked', mockCode: true }); ck(`F413 la base SIGUE concedida (el código llega pero el permiso no cambió): el interruptor queda «true» y no hay aviso falso [${L.LABEL}]`, r.dbStatus === 'granted' && r.after === 'true' && !r.notice, JSON.stringify({ after: r.after, notice: r.notice, db: r.dbStatus, reads: r.reads })) }
  await L.done(); srv?.close?.(); process.exit(0)
})().catch(e => { console.error('FALLO', e); process.exit(1) })
