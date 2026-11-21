// ES-303 (PR B) · Invitación de revisor con código de un solo uso: lógica pura del cliente, textos ES/EN y reglas de privacidad del código. La medición con servidor y PostgreSQL reales y navegador la hace
// scripts/es303-pantallas-check.cjs (canje feliz, 404 uniforme, 429, tope de 10, anular, código por enlace y limpieza de la URL).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { AuthError, activeInvites, codeComplete, codeFromHash, formatCode, inviteLink, latestShares, parseInvites, parseLookup, parseShares, problemOf, reviewAuthApi, MAX_ACTIVE_INVITES } from '../src/facilitation/reviewAuthApi.ts'
import { authKeys, authText, authWords, format } from '../src/facilitation/reviewAuthCopy.ts'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const files = { api: read('../src/facilitation/reviewAuthApi.ts'), person: read('../src/facilitation/ReviewAuthorize.tsx'), reviewer: read('../src/facilitation/InviteIssuer.tsx'), page: read('../src/facilitation/PersonReviews.tsx'), css: read('../src/facilitation/person-reviews.css'), copy: read('../src/facilitation/reviewAuthCopy.ts') }
const CODE = 'ABCD-EFGH-JKMN-PQRS'

test('ES-303: formatCode deja mayúsculas, solo letras y números, grupos de 4 y máximo 16; codeComplete exige los 16', () => {
  assert.equal(formatCode('abcdefghjkmnpqrs'), CODE); assert.equal(formatCode('  abcd efgh-jkmn_pqrs  '), CODE); assert.equal(formatCode('ab'), 'AB'); assert.equal(formatCode('abcde'), 'ABCD-E')
  assert.equal(formatCode('ABCD-EFGH-JKMN-PQRS-TUVW'), CODE, 'más de 16 se recorta'); assert.equal(formatCode(''), ''); assert.equal(formatCode('!!!'), '')
  assert.equal(codeComplete(CODE), true); assert.equal(codeComplete('ABCD-EFGH'), false); assert.equal(codeComplete(''), false)
})

test('ES-303: codeFromHash lee el código del fragmento (con o sin #, con otros parámetros), lo formatea y descarta lo implausible', () => {
  assert.equal(codeFromHash(`#code=${CODE}`), CODE); assert.equal(codeFromHash(`code=${CODE}`), CODE); assert.equal(codeFromHash('#code=abcdefghjkmnpqrs'), CODE)
  assert.equal(codeFromHash(`#x=1&code=${CODE}`), CODE); assert.equal(codeFromHash(`#code=${CODE}&y=2`), CODE); assert.equal(codeFromHash('#code=ABCD-EFGH-JKMN'), '', 'incompleto no se rellena')
  for (const hash of ['', '#', '#otra=1', '#code=', '#code=%E0%A4%A', '#code=<script>', '#mycode=ABCD-EFGH-JKMN-PQRS']) assert.equal(codeFromHash(hash), '', hash)
})

test('ES-303: inviteLink pone el código en el FRAGMENTO (nunca en la ruta ni en la consulta)', () => {
  const link = inviteLink('https://app.example.test', CODE); assert.equal(link, `https://app.example.test/app/professional-reviews#code=${CODE}`)
  const url = new URL(link); assert.equal(url.search, ''); assert.ok(!url.pathname.includes('ABCD')); assert.equal(url.hash, `#code=${CODE}`)
})

test('ES-303: problemOf — 404 y 410 son UNO («invalid»: sin distinguir la causa), 429 límite, 403/401 sesión, 5xx y red = network; 409 too_many_active = full', () => {
  const e = (status, code = '') => new AuthError(status, { code })
  assert.equal(problemOf(e(404, 'invite_not_found')), 'invalid'); assert.equal(problemOf(e(404, 'otra')), 'invalid'); assert.equal(problemOf(e(410, 'use_invite')), 'invalid')
  assert.equal(problemOf(e(429, 'rate_limited')), 'limit'); assert.equal(problemOf(e(401)), 'session'); assert.equal(problemOf(e(403)), 'session')
  assert.equal(problemOf(e(409, 'too_many_active')), 'full'); assert.equal(problemOf(e(409, 'not_active')), 'gone'); assert.equal(problemOf(e(400, 'invalid_evidence')), 'invalidEvidence'); assert.equal(problemOf(e(400, 'invalid_input')), 'invalid')
  assert.equal(problemOf(e(500)), 'network'); assert.equal(problemOf(e(502)), 'network'); assert.equal(problemOf(new TypeError('fetch failed')), 'network'); assert.equal(problemOf(null), 'network')
})

test('ES-303: parseInvites, parseShares y parseLookup validan la forma completa; algo inesperado lanza (nunca se muestra a medias)', () => {
  const inv = { id: 3, status: 'active', createdAt: '2026-11-21T10:00:00.000Z', expiresAt: '2026-11-28T10:00:00.000Z', usedAt: null, revokedAt: null }
  assert.deepEqual(parseInvites({ invites: [inv] }), [inv]); assert.deepEqual(parseInvites({ invites: [] }), [])
  for (const bad of [{}, { invites: 'x' }, { invites: [{ ...inv, status: 'otro' }] }, { invites: [{ ...inv, id: 0 }] }, { invites: [{ ...inv, createdAt: 'no' }] }, null]) assert.throws(() => parseInvites(bad), undefined, JSON.stringify(bad))
  const share = { id: 9, reviewerId: 4, reviewerName: 'Ana', materialVersion: 2, evidenceCount: 3, status: 'granted', createdAt: '2026-11-21T10:00:00.000Z', revokedAt: null }
  assert.deepEqual(parseShares({ shares: [share] }), [share]); assert.equal(parseShares({ shares: [{ ...share, reviewerName: undefined }] })[0].reviewerName, null, 'sin nombre (servidor anterior) = null'); assert.equal(parseShares({ shares: [{ ...share, reviewerName: '  ' }] })[0].reviewerName, null); assert.equal(parseShares({ shares: [{ ...share, reviewerName: 7 }] })[0].reviewerName, null); assert.throws(() => parseShares({ shares: [{ ...share, status: 'x' }] })); assert.throws(() => parseShares({}))
  assert.deepEqual(parseLookup({ reviewer: { name: 'Ana' }, expiresAt: '2026-11-28T10:00:00.000Z' }), { reviewerName: 'Ana', expiresAt: '2026-11-28T10:00:00.000Z' })
  for (const bad of [{}, { reviewer: { name: '' }, expiresAt: '2026-11-28T10:00:00.000Z' }, { reviewer: { name: 'Ana' } }, { reviewer: { name: 'Ana' }, expiresAt: 'no' }]) assert.throws(() => parseLookup(bad))
})

test('ES-303: latestShares deja UNA fila por persona revisora (la más reciente) y activeInvites cuenta las activas sin vencer', () => {
  const s = (id, reviewerId, status) => ({ id, reviewerId, reviewerName: null, materialVersion: 1, evidenceCount: 1, status, createdAt: '2026-11-21T10:00:00.000Z', revokedAt: null })
  assert.deepEqual(latestShares([s(1, 4, 'superseded'), s(2, 4, 'granted'), s(3, 5, 'revoked'), s(4, 5, 'superseded')]).map(x => x.id), [4, 2], 'por revisor, la de id mayor; orden por id descendente')
  assert.deepEqual(latestShares([]), [])
  const now = Date.parse('2026-11-22T00:00:00.000Z'); const i = (status, expiresAt) => ({ id: 1, status, createdAt: expiresAt, expiresAt, usedAt: null, revokedAt: null })
  assert.equal(activeInvites([i('active', '2026-11-23T00:00:00.000Z'), i('active', '2026-11-21T00:00:00.000Z'), i('used', '2026-11-23T00:00:00.000Z'), i('revoked', '2026-11-23T00:00:00.000Z')], now), 1); assert.equal(MAX_ACTIVE_INVITES, 10)
})

test('ES-303: el cliente NUNCA envía reviewerId; la autorización con código y con shareId llevan exactamente los campos del contrato; el código viaja en el CUERPO, no en la URL', async () => {
  const calls = []; const fetcher = async (url, init) => { calls.push({ url, init }); return { ok: true, status: 200, json: async () => ({}) } }
  const api = reviewAuthApi('http://api.test', 'tok', fetcher)
  await api.authorizeWithCode({ code: CODE, evidenceIds: [2, 1], requestId: 'rid-1' }); await api.authorizeAgain({ shareId: 7, evidenceIds: [1], requestId: 'rid-2' })
  const first = JSON.parse(calls[0].init.body); const second = JSON.parse(calls[1].init.body)
  assert.deepEqual(Object.keys(first).sort(), ['evidenceIds', 'inviteCode', 'requestId']); assert.deepEqual(Object.keys(second).sort(), ['evidenceIds', 'requestId', 'shareId'])
  for (const call of calls) { assert.ok(!/reviewerId/.test(call.init.body)); assert.ok(!call.url.includes('ABCD')); assert.equal(call.init.referrerPolicy, 'no-referrer'); assert.equal(call.init.cache, 'no-store'); assert.equal(call.init.headers.Authorization, 'Bearer tok') }
  assert.ok(calls.every(call => call.url === 'http://api.test/api/me/review-shares' && call.init.method === 'POST'))
})

test('ES-303: el lookup envía { code } (contrato del servidor) y la autorización { inviteCode }; el lookup no gasta ni envía nada más', async () => {
  const calls = []; const api = reviewAuthApi('http://api.test', 'tok', async (url, init) => { calls.push({ url, init }); return { ok: true, status: 200, json: async () => ({ reviewer: { name: 'Ana' }, expiresAt: '2026-11-28T10:00:00.000Z' }) } })
  await api.lookup(CODE); assert.equal(calls[0].url, 'http://api.test/api/me/review-invites/lookup'); assert.deepEqual(JSON.parse(calls[0].init.body), { code: CODE }); assert.equal(calls[0].init.method, 'POST')
})

test('ES-303: createInvite devuelve el código solo si el servidor lo envía (un reintento no lo trae); un cuerpo mal formado lanza', async () => {
  const make = body => reviewAuthApi('http://api.test', 'tok', async () => ({ ok: true, status: 201, json: async () => body }))
  const invite = { id: 1, status: 'active', createdAt: '2026-11-21T10:00:00.000Z', expiresAt: '2026-11-28T10:00:00.000Z', usedAt: null, revokedAt: null }
  assert.deepEqual(await make({ invite, code: CODE }).createInvite('r'), { invite, code: CODE }); assert.deepEqual(await make({ invite }).createInvite('r'), { invite, code: null })
  await assert.rejects(() => make({ invite: { ...invite, status: 'x' } }).createInvite('r'))
})

test('ES-303: errores del servidor → AuthError con status y code, sin repetir el cuerpo ni el código', async () => {
  const api = reviewAuthApi('http://api.test', 'tok', async () => ({ ok: false, status: 404, json: async () => ({ code: 'invite_not_found', error: `No se encontró ${CODE}` }) }))
  await assert.rejects(() => api.lookup(CODE), error => { assert.ok(error instanceof AuthError); assert.equal(error.status, 404); assert.equal(error.code, 'invite_not_found'); assert.ok(!error.message.includes('ABCD')); return true })
})

test('ES-303: textos ES y EN completos y distintos; sin voseo en ES; los marcadores {…} coinciden entre idiomas; ningún texto lleva un código de ejemplo', () => {
  for (const key of authKeys) {
    const [es, en] = authWords[key]; assert.ok(es.trim() && en.trim(), key)
    assert.deepEqual([...es.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort(), [...en.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort(), `marcadores de ${key}`)
    assert.ok(!/\b(vos|tenés|podés|querés|elegí|pegá|hacé|mirá)\b/i.test(es), `voseo en ${key}`)
    if (!['codePlaceholder', 'done', 'title', 'create', 'copyCode', 'invitation', 'authorize'].includes(key)) assert.notEqual(es, en, `EN sin traducir: ${key}`)
  }
  assert.equal(authText('es', 'selected', { n: 2 }), 'Seleccionadas: 2'); assert.equal(authText('en', 'selected', { n: 2 }), 'Selected: 2'); assert.equal(format('{a}-{a}', { a: 'x' }), 'x-x')
  assert.equal(authText('es', 'title'), 'Revisiones profesionales'); assert.equal(authText('en', 'title'), 'Professional reviews')
})

test('ES-303: textos definitivos de 12827 presentes tal cual (ES y EN) y los extra aprobados de la maqueta (12839)', () => {
  const must = {
    inviteTitle: ['Invitar a una persona', 'Invite a person'], create: ['Crear invitación', 'Create invitation'], newWarn: ['Este código se muestra solo ahora. Cópialo y envíaselo a la persona.', 'This code is shown only now. Copy it and send it to the person.'],
    copyCode: ['Copiar código', 'Copy code'], copied: ['Código copiado', 'Code copied'], revokeBody: ['¿Anular esta invitación? La persona ya no podrá usar el código.', 'Cancel this invitation? The person will no longer be able to use the code.'],
    full: ['Ya tienes 10 invitaciones activas. Anula alguna o espera a que venzan.', 'You already have 10 active invitations. Cancel one or wait for them to expire.'], cardTitle: ['Autorizar una revisión', 'Authorize a review'],
    invalidCode: ['No encontramos esa invitación. Revisa el código o pide uno nuevo.', 'We could not find that invitation. Check the code or ask for a new one.'], tooMany: ['Demasiados intentos seguidos. Inténtalo más tarde.', 'Too many attempts in a row. Try again later.'],
    copyLink: ['Copiar enlace', 'Copy link'], update: ['Actualizar evidencias', 'Update evidence'], withdraw: ['Retirar acceso', 'Withdraw access'], selected: ['Seleccionadas: {n}', 'Selected: {n}'],
    fromLink: ['El código llegó por el enlace; revísalo y pulsa Continuar', 'The code came from the link; check it and press Continue'],
  }
  for (const [key, [es, en]] of Object.entries(must)) assert.deepEqual(authWords[key], [es, en], key)
})

test('ES-303 (privacidad): el código no se guarda en el almacenamiento del navegador, no se escribe en errores, no hay estilos en línea ni enlaces salientes, y la URL se limpia con replaceState', () => {
  for (const [name, source] of Object.entries({ api: files.api, person: files.person, reviewer: files.reviewer, copy: files.copy })) {
    assert.ok(!/localStorage|sessionStorage|indexedDB|document\.cookie/.test(source), `${name}: sin almacenamiento del navegador`)
    assert.ok(!/console\.(log|error|warn|info)/.test(source), `${name}: sin console`)
    assert.ok(!/\bstyle=\{/.test(source), `${name}: sin estilos en línea`); assert.ok(!/href="https?:/.test(source), `${name}: sin enlaces salientes`); assert.ok(!/target="_blank"/.test(source), `${name}: sin target=_blank`)
    assert.ok(!/reviewerId/.test(source.replace(/\/\/.*$/gm, '').replace(/reviewerId: id\(row\.reviewerId\)|reviewerId: number|\.reviewerId/g, '')) || name === 'api', `${name}: sin reviewerId en el cuerpo`)
  }
  assert.ok(/replaceState/.test(files.person), 'la pantalla de la persona limpia el fragmento'); assert.ok(/no-referrer/.test(files.person) && /no-referrer/.test(files.reviewer), 'Referrer-Policy estricta en ambas')
  assert.ok(!/style=/.test(files.css), 'CSS sin atributos style'); assert.ok(/aria-live="polite"/.test(files.reviewer), 'panel del código con región viva')
})

test('ES-303 (alcance): la ruta es /app/professional-reviews; el profesional ve invitar y la persona ve autorizar; el panel del código NO es un diálogo modal; ninguna evidencia viene marcada', () => {
  assert.ok(/role === 'therapist' \? <IssuerSide/.test(files.page), 'el rol profesional ve «Invitar a una persona»'); assert.ok(/<ReviewAuthorize /.test(files.page))
  assert.ok(!/showModal/.test(files.reviewer.split('function RevokeDialog')[1].split('export function InviteIssuer')[1] ?? ''), 'el panel del código no es modal'); assert.ok(/showModal/.test(files.reviewer), 'solo anular es un diálogo')
  assert.ok(/checked=\{chosen\.includes\(row\.id\)\}/.test(files.person) && /useState<number\[\]>\(\[\]\)/.test(files.person), 'la selección inicial está vacía')
  assert.ok(/chosen\.length === 0/.test(files.person), 'autorizar deshabilitado sin selección')
  assert.ok(readdirSync(new URL('../src/facilitation/', import.meta.url)).includes('reviewAuthApi.ts'))
})

test('O303-focus (QA-421 v2): tras el 409 del tope el foco se queda en el aviso (el banner derivado de la lista conserva la referencia) y se reubica cuando cambia full', () => {
  const src = files.reviewer
  assert.ok(src.includes("{full && (message === 'full' ? <div ref={messageRef} tabIndex={-1}><Banner kind=\"error\" title={t('full')} /></div> : <Banner kind=\"error\" title={t('full')} />)}"), 'con message=full y full, el aviso derivado lleva ref y tabIndex')
  assert.ok(src.includes('}, [message, full])'), 'el efecto de foco también depende de full')
  assert.ok(src.includes("{message && !(message === 'full' && full) && <div ref={messageRef} tabIndex={-1}>"), 'el aviso del servidor sigue siendo único (F421-2)')
})
