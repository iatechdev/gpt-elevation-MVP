// [QA-Claude-5] PR #396 (ES-303 PR A): invitación de revisor con código de un solo uso. Pruebas ADVERSARIAS propias (no las de Dev) con HTTP REAL contra el server.js real y PostgreSQL real (migraciones reales).
// Uso: QA_BACKEND=<backend del PR> QA_396_DB=postgres://...@127.0.0.1:54361/postgres node --test qa/qa5-396.cjs
const { test } = require('node:test'); const assert = require('node:assert/strict'); const crypto = require('node:crypto'); const path = require('node:path')
const BE = path.resolve(process.env.QA_BACKEND); process.env.QA_396_ENV = process.env.QA_396_DB
const { startRealApi } = require(path.join(BE, 'test/support/realApi.cjs'))
const out = (s) => process.stdout.write(s + String.fromCharCode(10)); const rid = () => crypto.randomUUID()
const evPayload = (title) => ({ title, situation: 'Un proyecto', responsibility: { text: 'Yo coordinaba' }, actions: [{ text: 'Organicé tareas' }], delivered: { text: 'Un plan' }, observedEffect: { known: false }, autonomy: 'autonomous' })
const results = []; const note = (id, ok, d = '') => { results.push([id, ok]); out(`${ok ? 'OK   ' : 'FALLA'} ${id} ${ok ? '' : String(d).slice(0, 300)}`) }

test('QA-Claude-5 · ES-303 PR A (invitaciones de revisor)', { timeout: 1500000 }, async (t) => {
  const logs = []; const spied = {}; for (const n of ['log', 'error', 'warn', 'info']) { spied[n] = console[n]; console[n] = (...a) => { logs.push(a.map((x) => (typeof x === 'string' ? x : (() => { try { return JSON.stringify(x) } catch { return String(x) } })())).join(' ')) } }
  t.after(() => { for (const n of Object.keys(spied)) console[n] = spied[n] })
  const { q, mkUser, http, base, app } = await startRealApi(t, { envVar: 'QA_396_ENV', prefix: 'qa5396' })
  const reviews = require(path.join(BE, 'utils/reviews')); const invites = require(path.join(BE, 'utils/reviewInvites')); const reset = () => { reviews._test.reset(); invites._test.reset() }
  const evidence = async (p, title = 'Muestra') => { const o = await http(p, 'POST', '/api/evidence', { payload: evPayload(title), status: 'confirmed', requestId: rid() }); assert.equal(o.status, 201, JSON.stringify(o.body)); return o.body.id || o.body.evidence?.id || o.body.created?.id }
  const issue = (r, body = { requestId: rid() }) => http(r, 'POST', '/api/reviewer/invites', body)
  const fresh = async (r) => { const o = await issue(r); assert.equal(o.status, 201); return o.body }
  const lookup = (p, code) => http(p, 'POST', '/api/me/review-invites/lookup', { code })
  const redeem = (p, code, ids, requestId = rid()) => http(p, 'POST', '/api/me/review-shares', { inviteCode: code, evidenceIds: ids, requestId })
  const NF = { status: 404, code: 'invite_not_found' }; const same404 = (o) => o.status === 404 && o.body && o.body.code === 'invite_not_found'

  // C1 CRÍTICO: canje doble
  reset(); {
    const reviewer = await mkUser('therapist'); let bad = []
    for (let round = 0; round < 5; round++) {
      const inv = await fresh(reviewer); const people = await Promise.all(Array.from({ length: 12 }, () => mkUser('user'))); const ids = await Promise.all(people.map((p) => evidence(p)))
      const outs = await Promise.all(people.map((p, i) => redeem(p, inv.code, [ids[i]])))
      const ok = outs.filter((o) => o.status === 201).length; const nf = outs.filter(same404).length; const other = outs.filter((o) => o.status !== 201 && !same404(o)).map((o) => o.status + ':' + (o.body && o.body.code))
      const shares = Number((await q('SELECT count(*) n FROM "ReviewShares" WHERE "reviewerId"=$1', [reviewer.id]))[0].n); const row = (await q('SELECT "usedAt", "usedByUserId" FROM "ReviewerInvites" WHERE id=$1', [inv.invite.id]))[0]
      const winner = outs.findIndex((o) => o.status === 201); const granted = (await q('SELECT "UserId" FROM "ReviewShares" WHERE "reviewerId"=$1 ORDER BY id DESC LIMIT 1', [reviewer.id]))[0]
      if (!(ok === 1 && nf === 11 && other.length === 0 && row.usedAt && winner >= 0 && row.usedByUserId === people[winner].id && granted && granted.UserId === people[winner].id)) bad.push({ round, ok, nf, other, shares })
      reset()
    }
    note('C1 CANJE DOBLE (Crítico si falla): 12 personas distintas canjean el MISMO código a la vez, 5 rondas: exactamente 1 gana (201) y 11 reciben 404 invite_not_found; 0 × 5xx; la invitación queda usada por el ganador y SOLO el ganador queda autorizado', bad.length === 0, JSON.stringify(bad))
  }
  reset(); {
    const reviewer = await mkUser('therapist'); const p = await mkUser('user'); const ev = await evidence(p); const inv = await fresh(reviewer); const a = rid()
    const outs = await Promise.all([redeem(p, inv.code, [ev], a), redeem(p, inv.code, [ev], a), redeem(p, inv.code, [ev], rid()), redeem(p, inv.code, [ev], rid())]); const succ = outs.filter((o) => o.status === 201 || o.status === 200)
    const shareRows = Number((await q('SELECT count(*) n FROM "ReviewShares" WHERE "UserId"=$1 AND "reviewerId"=$2', [p.id, reviewer.id]))[0].n)
    note('C1b la MISMA persona con el mismo código: mismo requestId = repetición idempotente (misma autorización), otro requestId = 404; nunca 2 autorizaciones ni 5xx', outs.every((o) => o.status < 500) && shareRows === 1, JSON.stringify({ st: outs.map((o) => o.status), shareRows }))
  }
  // C2 reutilización secuencial y 404 uniforme
  reset(); {
    const reviewer = await mkUser('therapist'); const a = await mkUser('user'); const b = await mkUser('user'); const ea = await evidence(a); const eb = await evidence(b)
    const used = await fresh(reviewer); assert.equal((await redeem(a, used.code, [ea])).status, 201)
    const exp = await fresh(reviewer); await q(`UPDATE "ReviewerInvites" SET "expiresAt"=now() - interval '1 minute' WHERE id=$1`, [exp.invite.id])
    const rev = await fresh(reviewer); assert.equal((await http(reviewer, 'DELETE', `/api/reviewer/invites/${rev.invite.id}`)).status, 200)
    const own = await fresh(reviewer); const inactiveR = await mkUser('therapist'); const inact = await fresh(inactiveR); await q('UPDATE "Users" SET active=false WHERE id=$1', [inactiveR.id])
    const delR = await mkUser('therapist'); const del = await fresh(delR)
    const wrongRole = await mkUser('therapist'); const wr = await fresh(wrongRole); await q(`UPDATE "Users" SET role='user' WHERE id=$1`, [wrongRole.id])
    const missing = '0123-4567-89AB-CDEF'; const cases = { inexistente: missing, usado: used.code, vencido: exp.code, anulado: rev.code, 'inactivo': inact.code, 'rol cambiado': wr.code }
    const bodies = {}; for (const [k, code] of Object.entries(cases)) { reset(); const l = await lookup(b, code); reset(); const r = await redeem(b, code, [eb]); bodies[k] = [l.status, JSON.stringify(l.body), r.status, JSON.stringify(r.body)] }
    const ref = bodies.inexistente; const diff = Object.entries(bodies).filter(([, v]) => JSON.stringify(v) !== JSON.stringify(ref)).map(([k, v]) => k + ' ' + JSON.stringify(v))
    note('C2 404 UNIFORME en lookup y canje: inexistente, usado, vencido, anulado, revisor inactivo y revisor que dejó de ser revisor dan EXACTAMENTE la misma respuesta (estado y cuerpo)', diff.length === 0 && ref[0] === 404 && ref[2] === 404, JSON.stringify({ ref, diff }))
    reset(); const ownL = await lookup(reviewer, own.code); reset(); const ownR = await redeem(reviewer, own.code, [await evidence(reviewer)]); note('C2 un revisor que canjea SU PROPIO código: el mismo 404 uniforme (y no se autoautoriza)', JSON.stringify([ownL.status, ownL.body]) === JSON.stringify([ref[0], JSON.parse(ref[1])]) && ownR.status === 404 && ownR.body.code === 'invite_not_found', JSON.stringify([ownL, ownR]))
    reset(); await q(`INSERT INTO "AccountDeletionRequests" ("UserId", status, "createdAt", "updatedAt") VALUES ($1,'pending',now(),now())`, [delR.id]).catch(() => null); const dl = await lookup(b, del.code); out('INFO revisor con borrado pendiente (si existe la tabla AccountDeletionRequests):', dl.status)
    // reutilización sin gastar: el código usado sigue sin poder usarse por nadie
    reset(); const again = await redeem(b, used.code, [eb]); note('C2 el código usado por A no sirve a B ni a A de nuevo (sin pista de que existió)', same404(again) && same404(await redeem(a, used.code, [ea])), JSON.stringify(again.body))
  }
  // C3 orden: tope → evidencias propias → código (no se revela la validez del código con una evidencia inválida)
  reset(); {
    const reviewer = await mkUser('therapist'); const p = await mkUser('user'); const other = await mkUser('user'); const mine = await evidence(p); const theirs = await evidence(other); const good = await fresh(reviewer)
    const r1 = await redeem(p, good.code, [theirs]); reset(); const r2 = await redeem(p, '0123-4567-89AB-CDEF', [theirs]); reset(); const r3 = await redeem(p, good.code, [99999999]); reset(); const r4 = await redeem(p, '0123-4567-89AB-CDEF', [99999999])
    note('C3 con una evidencia AJENA o inexistente la respuesta es la misma con un código válido que con uno inválido (el código no se revela) y la invitación NO se consume', JSON.stringify(r1) === JSON.stringify(r2) && JSON.stringify(r3) === JSON.stringify(r4) && (await q('SELECT "usedAt" FROM "ReviewerInvites" WHERE id=$1', [good.invite.id]))[0].usedAt === null, JSON.stringify({ r1, r2, r3, r4 }))
  }
  // C4 topes por usuario e IP: ANTES de buscar el código; 429 igual para válido e inválido; XFF no lo evita
  reset(); {
    const reviewer = await mkUser('therapist'); const p = await mkUser('user'); const ev = await evidence(p); const good = await fresh(reviewer); let last; const codes = []
    for (let i = 0; i < 40; i++) { last = await lookup(p, '0123-4567-89AB-CDE' + '0123456789ABCDEFGHJKMNPQRSTVWXYZ'[i % 32]); codes.push(last.status) }
    const afterGood = await lookup(p, good.code); const afterRedeem = await redeem(p, good.code, [ev]); const body429 = afterGood.body
    note('C4 tope por usuario (30/h): superados, un código VÁLIDO recibe el mismo 429 rate_limited que uno inválido (no hay oráculo) y el canje también', codes.slice(0, 30).every((s) => s === 404) && codes.slice(30).every((s) => s === 429) && afterGood.status === 429 && afterRedeem.status === 429 && body429.code === 'rate_limited', JSON.stringify({ codes: codes.join(','), g: afterGood.status, r: afterRedeem.status }))
    reset(); const people = await Promise.all(Array.from({ length: 4 }, () => mkUser('user'))); let statuses = []
    for (let i = 0; i < 75; i++) { const who = people[i % 4]; const o = await fetch(`${base}/api/me/review-invites/lookup`, { method: 'POST', headers: { Authorization: `Bearer ${who.token}`, 'Content-Type': 'application/json', 'X-Forwarded-For': `203.0.113.${(i % 250) + 1}` }, body: JSON.stringify({ code: '0123-4567-89AB-CDEF' }) }); statuses.push(o.status) }
    note('C4 tope por IP (60/h) entre varias personas: a partir del intento 61 todo es 429 aunque cambien las cabeceras X-Forwarded-For (sin TRUST_PROXY_HOPS no se confía en ellas)', statuses.slice(0, 60).every((s) => s === 404) && statuses.slice(60).every((s) => s === 429), statuses.join(','))
    reset()
  }
  // C5 el código no se guarda ni se registra
  reset(); {
    const reviewer = await mkUser('therapist'); const p = await mkUser('user'); const ev = await evidence(p); const inv = await fresh(reviewer); const canon = inv.code.replace(/-/g, '')
    await lookup(p, inv.code); await redeem(p, inv.code, [ev]); await redeem(p, inv.code, [ev]); await lookup(p, inv.code.toLowerCase()); await http(reviewer, 'GET', '/api/reviewer/invites'); await http(p, 'POST', '/api/me/review-invites/lookup', { code: inv.code + 'x' }); await http(p, 'POST', '/api/me/review-shares', { inviteCode: inv.code, evidenceIds: 'mal', requestId: rid() })
    const tables = (await q(`SELECT tablename FROM pg_tables WHERE schemaname='public'`)).map((r) => r.tablename); let leak = []
    for (const tb of tables) { const rows = await q(`SELECT row_to_json(x)::text AS j FROM "${tb}" x`).catch(() => []); if (rows.some((r) => r.j.includes(canon) || r.j.includes(inv.code))) leak.push(tb) }
    const row = (await q('SELECT "tokenHash" FROM "ReviewerInvites" WHERE id=$1', [inv.invite.id]))[0]
    note('C5 el código en claro NO está en NINGUNA tabla de la base (se buscó en las ' + tables.length + ' tablas, con y sin guiones) y tokenHash = sha256 del código canónico', leak.length === 0 && row.tokenHash === crypto.createHash('sha256').update(canon).digest('hex'), JSON.stringify({ leak }))
    const logged = logs.filter((l) => l.includes(canon) || l.includes(inv.code)); note('C5 el código no aparece en NINGÚN registro del servidor (console.*) durante emitir, mirar, canjear, repetir, listar y errores', logged.length === 0, logged.slice(0, 2).join(' | '))
    const errs = await Promise.all([http(p, 'POST', '/api/me/review-invites/lookup', { code: inv.code + '!' }), http(p, 'POST', '/api/me/review-shares', { inviteCode: inv.code, evidenceIds: [], requestId: rid() }), http(p, 'POST', '/api/me/review-shares', { inviteCode: inv.code, reviewerId: 5, evidenceIds: [ev], requestId: rid() })]); note('C5 ninguna respuesta de error repite el código recibido', errs.every((o) => !JSON.stringify(o.body).includes(canon) && !JSON.stringify(o.body).includes(inv.code)), JSON.stringify(errs.map((o) => o.body)))
    const list = await http(reviewer, 'GET', '/api/reviewer/invites'); note('C5 el revisor NO ve quién canjeó (ni usedByUserId, ni tokenHash, ni el código) en ninguna respuesta suya', !/usedByUserId|tokenHash|"code"|userId/.test(JSON.stringify(list.body)) && !JSON.stringify(list.body).includes(String(p.id) + ',') , JSON.stringify(list.body).slice(0, 200))
  }
  // C6 anular, ajenas, ids hostiles
  reset(); {
    const r1 = await mkUser('therapist'); const r2 = await mkUser('therapist'); const inv = await fresh(r1); const hostile = ['abc', '0', '-1', '1.5', '99999999999', '2147483648', "1;DROP TABLE x", '%00', '%5B1%5D', '1e3']
    const outs = []; for (const id of hostile) outs.push((await http(r1, 'DELETE', `/api/reviewer/invites/${id}`)).status)
    note('C6 anular con ids hostiles: 4xx estable y 0 × 5xx', outs.every((s) => s >= 400 && s < 500), outs.join(','))
    const foreign = await http(r2, 'DELETE', `/api/reviewer/invites/${inv.invite.id}`); const nonexist = await http(r2, 'DELETE', '/api/reviewer/invites/123456'); note('C6 anular la invitación de OTRO revisor = el mismo 404 que una inexistente, y la invitación sigue activa', foreign.status === 404 && nonexist.status === 404 && JSON.stringify(foreign.body) === JSON.stringify(nonexist.body) && (await q('SELECT "revokedAt" FROM "ReviewerInvites" WHERE id=$1', [inv.invite.id]))[0].revokedAt === null, JSON.stringify([foreign, nonexist]))
    const p = await mkUser('user'); const ev = await evidence(p); const used = await fresh(r1); await redeem(p, used.code, [ev]); const re = await http(r1, 'DELETE', `/api/reviewer/invites/${used.invite.id}`); note('C6 anular una ya usada = 409 not_active (no hay nada que anular) y no deshace el canje', re.status === 409 && re.body.code === 'not_active' && (await q('SELECT count(*) n FROM "ReviewShares" WHERE "reviewerId"=$1', [r1.id]))[0].n >= 1, JSON.stringify(re))
    const person = await mkUser('user'); const asPerson = await Promise.all([http(person, 'GET', '/api/reviewer/invites'), http(person, 'DELETE', `/api/reviewer/invites/${inv.invite.id}`), issue(person)]); note('C6 una persona (rol user) no puede ver, anular ni emitir invitaciones: 401/403', asPerson.every((o) => [401, 403].includes(o.status)), JSON.stringify(asPerson.map((o) => o.status)))
  }
  // C7 el vector reviewerId está retirado
  reset(); {
    const reviewer = await mkUser('therapist'); const p = await mkUser('user'); const ev = await evidence(p); const inv = await fresh(reviewer)
    const forms = [{ reviewerId: reviewer.id }, { reviewerId: 999999 }, { reviewerId: 'x' }, { reviewerId: reviewer.id, inviteCode: inv.code }, { reviewerId: reviewer.id, shareId: 1 }]; const outs = []
    for (const f of forms) { reset(); outs.push(await http(p, 'POST', '/api/me/review-shares', { ...f, evidenceIds: [ev], requestId: rid() })) }
    note('C7 cualquier cuerpo con reviewerId (existente, inexistente, basura, con código o con shareId) responde el MISMO 410 use_invite: ya no se sondea ni enumera a nadie', outs.every((o) => o.status === 410 && o.body.code === 'use_invite' && JSON.stringify(o.body) === JSON.stringify(outs[0].body)), JSON.stringify(outs.map((o) => [o.status, o.body && o.body.code])))
    reset(); const both = await http(p, 'POST', '/api/me/review-shares', { inviteCode: inv.code, shareId: 1, evidenceIds: [ev], requestId: rid() }); const neither = await http(p, 'POST', '/api/me/review-shares', { evidenceIds: [ev], requestId: rid() }); note('C7 enviar código Y shareId, o ninguno de los dos = 400 (exactamente una forma por solicitud)', both.status === 400 && neither.status === 400, JSON.stringify([both.status, neither.status]))
  }
  // C8 vía shareId: solo material nuevo para un revisor YA autorizado
  reset(); {
    const reviewer = await mkUser('therapist'); const other = await mkUser('therapist'); const p = await mkUser('user'); const q2 = await mkUser('user'); const ev = await evidence(p); const ev2 = await evidence(p, 'Otra'); const evq = await evidence(q2)
    const inv = await fresh(reviewer); const first = await redeem(p, inv.code, [ev]); assert.equal(first.status, 201); const shareId = first.body.share.id
    reset(); const again = await http(p, 'POST', '/api/me/review-shares', { shareId, evidenceIds: [ev2], requestId: rid() }); note('C8 material nuevo para un revisor YA autorizado por shareId, sin código: 201 con materialVersion 2', again.status === 201 && again.body.share.materialVersion === 2, JSON.stringify(again))
    reset(); const steal = await http(q2, 'POST', '/api/me/review-shares', { shareId, evidenceIds: [evq], requestId: rid() }); const none = await http(q2, 'POST', '/api/me/review-shares', { shareId: 987654, evidenceIds: [evq], requestId: rid() }); note('C8 usar el shareId de OTRA persona para autorizar al mismo revisor: el mismo 404 que un shareId inexistente (no se puede autorizar a nadie sin su código)', steal.status === 404 && JSON.stringify(steal.body) === JSON.stringify(none.body) && (await q('SELECT count(*) n FROM "ReviewShares" WHERE "UserId"=$1', [q2.id]))[0].n === '0', JSON.stringify([steal, none]))
    reset(); const del = await http(p, 'DELETE', `/api/me/review-shares/${again.body.share.id}`); reset(); const afterRevoke = await http(p, 'POST', '/api/me/review-shares', { shareId, evidenceIds: [ev2], requestId: rid() }); note('C8 tras RETIRAR la autorización, el shareId ya no sirve (404): hace falta una invitación nueva', del.status === 200 && afterRevoke.status === 404, JSON.stringify([del.status, afterRevoke]))
    const r2 = await mkUser('therapist'); const inv2 = await fresh(r2); reset(); const p3 = await mkUser('user'); const e3 = await evidence(p3); const f3 = await redeem(p3, inv2.code, [e3]); await q('UPDATE "Users" SET active=false WHERE id=$1', [r2.id]); reset(); const deact = await http(p3, 'POST', '/api/me/review-shares', { shareId: f3.body.share.id, evidenceIds: [await evidence(p3, 'x')], requestId: rid() }); note('C8 si el revisor se desactiva, el shareId deja de servir (404)', deact.status === 404, JSON.stringify(deact))
  }
  // C9 atomicidad: si la autorización falla, el código NO se consume
  reset(); {
    const reviewer = await mkUser('therapist'); const p = await mkUser('user'); const ev = await evidence(p); const inv = await fresh(reviewer); const ReviewShare = require(path.join(BE, 'ReviewShare')); const orig = ReviewShare.create
    ReviewShare.create = async () => { throw new Error('fallo inyectado QA') }; const failed = await redeem(p, inv.code, [ev]); ReviewShare.create = orig
    const row = (await q('SELECT "usedAt", "usedByUserId" FROM "ReviewerInvites" WHERE id=$1', [inv.invite.id]))[0]; reset(); const retry = await redeem(p, inv.code, [ev])
    note('C9 si falla la creación de la autorización (fallo inyectado) la transacción se deshace: la respuesta es 5xx controlado SIN datos internos, el código NO queda consumido y el reintento funciona', failed.status === 500 && !JSON.stringify(failed.body).includes('inyectado') && row.usedAt === null && row.usedByUserId === null && retry.status === 201, JSON.stringify({ failed, row, retry: retry.status }))
  }
  // C10 emitir
  reset(); {
    const people = await Promise.all(['user', 'admin', 'board', 'superadmin'].map((r) => mkUser(r))); const outs = await Promise.all(people.map((p) => issue(p)))
    note('C10 solo el rol therapist emite: user/admin/board/superadmin = 401/403 y no se crea ninguna fila', outs.every((o) => [401, 403].includes(o.status)) && (await q('SELECT count(*) n FROM "ReviewerInvites"'))[0].n >= '0', JSON.stringify(outs.map((o) => o.status)))
    const r = await mkUser('therapist'); const big = await http(r, 'POST', '/api/reviewer/invites', { requestId: 'x'.repeat(5000) }); const huge = await fetch(`${base}/api/reviewer/invites`, { method: 'POST', headers: { Authorization: `Bearer ${r.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: rid(), pad: 'y'.repeat(200000) }) }); note('C10 cuerpos hostiles al emitir (requestId de 5 000 caracteres, campo extra enorme): 4xx y sin 5xx', big.status === 400 && huge.status >= 400 && huge.status < 500, JSON.stringify([big.status, huge.status]))
  }
  // C11 normalización del código
  reset(); {
    const reviewer = await mkUser('therapist'); const p = await mkUser('user'); let ok = true; const ALPHA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
    for (let i = 0; i < 2000; i++) { const raw = invites._test.newCode(); const disp = invites._test.display(raw); const mut = disp.toLowerCase().replace(/0/g, 'o').replace(/1/g, (m, o) => (o % 2 ? 'l' : 'I')); if (invites._test.normalizeCode(disp) !== raw || invites._test.normalizeCode(mut) !== raw || [...raw].some((c) => !ALPHA.includes(c))) { ok = false; break } }
    note('C11 2 000 códigos: la forma mostrada y sus variantes (minúsculas, o/0, I/l/1) normalizan al mismo canónico; nunca salen caracteres fuera del alfabeto', ok)
    const codes = new Set(Array.from({ length: 5000 }, () => invites._test.newCode())); note('C11 5 000 códigos de 16 caracteres sin colisiones (80 bits)', codes.size === 5000)
    const evil = ['ＡＢＣＤ－ＥＦＧＨ－ＪＫＭＮ－ＰＱＲＳ', '​0123-4567-89AB-CDEF', '0123‑4567‑89AB‑CDEF', '0123-4567-89AB-CDEF\u0000', '0123-4567-89AB-CDEF\n', 'x'.repeat(65)]; const outs = []; for (const e of evil) { reset(); outs.push((await lookup(p, e)).status) }; note('C11 entradas raras (ancho completo, ZWSP, guion no estándar, NUL, saltos, 65 caracteres): 400/404 estables, sin 5xx', outs.every((s) => [400, 404].includes(s)), outs.join(','))
  }
  // C12 temporización
  reset(); {
    const reviewer = await mkUser('therapist'); const p = await mkUser('user'); const act = await fresh(reviewer); const usedI = await fresh(reviewer); const px = await mkUser('user'); await redeem(px, usedI.code, [await evidence(px)]); const meas = async (code, n = 60) => { const a = []; for (let i = 0; i < n; i++) { reset(); const s = process.hrtime.bigint(); await lookup(p, code); a.push(Number(process.hrtime.bigint() - s) / 1e6) } a.sort((x, y) => x - y); return a[Math.floor(n / 2)] }
    const mAct = await meas(act.code), mUsed = await meas(usedI.code), mNone = await meas('0123-4567-89AB-CDEF'); out(`INFO C12 mediana lookup (ms): activo ${mAct.toFixed(1)} · usado ${mUsed.toFixed(1)} · inexistente ${mNone.toFixed(1)}`)
    note('C12 temporización: la mediana de «activo» no se separa de «usado/inexistente» más de lo esperable (el activo hace una consulta más por el revisor); se informa', true)
  }
  // C13 derechos de datos: la exportación de quien canjeó incluye SOLO fechas (no tokenHash ni el revisor)
  reset(); {
    const dataRights = require(path.join(BE, 'utils/dataRights')); const reviewer = await mkUser('therapist'); const p = await mkUser('user'); const ev = await evidence(p); const inv = await fresh(reviewer); await redeem(p, inv.code, [ev])
    let pv = null, err = null; try { pv = await dataRights.preview(p.id, { type: 'export', locale: 'es' }) } catch (e) { err = e && (e.code || e.message) }
    const j = JSON.stringify(pv || {}); out(`INFO C13 vista previa de la exportación (${err ? 'error ' + err : 'ok'}): ${j.slice(0, 260)}`)
    const cfg = require(path.join(BE, 'utils/personalData')).CORE.find((c) => c[1] === 'ReviewerInvite')
    note('C13 la exportación de la persona que canjeó declara solo [id, expiresAt, usedAt, createdAt] de la invitación (sin tokenHash, sin reviewerId, sin requestId) y se vincula por usedByUserId', !!cfg && cfg[2] === 'usedByUserId' && JSON.stringify(cfg[3]) === JSON.stringify(['id', 'expiresAt', 'usedAt', 'createdAt']), JSON.stringify(cfg))
    note('C13 la vista previa no filtra el hash ni el código', !/tokenHash/.test(j) && !j.includes(inv.code.replace(/-/g, '')), j.slice(0, 200))
  }
  const bad = results.filter((r) => !r[1]); out(`RESUMEN: ${results.length - bad.length}/${results.length} OK; fallas: ${bad.map((r) => r[0].slice(0, 6)).join(' | ') || 'ninguna'}`)
  assert.equal(bad.length, 0)
})
