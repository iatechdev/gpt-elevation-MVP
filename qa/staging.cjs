// QA-Claude-2 — plan A (staging), casos ST-1, ST-3, ST-4, ST-5, ST-6, ST-8. SOLO staging, SOLO personas sintéticas @example.test,
// sin leer ni imprimir secretos ni tokens. Aprobado por Mauricio en Jira ES-37 (comentarios 10628 y 10635).
// Env: BASE (URL de staging). Carga acotada: 6 personas x 20 lecturas, una ráfaga. Sin DoS, sin escaneo, sin borrado.
const BASE = (process.env.BASE || '').replace(/\/$/, ''); if (!/^https:\/\/backend-staging-/.test(BASE)) { console.error('BASE debe ser el staging aprobado'); process.exit(2) }
const PASS = require('crypto').randomBytes(12).toString('hex') + 'Aa1!'
let fails = 0; const ck = (n, ok, x = '') => { if (!ok) fails++; console.log(`${ok ? 'OK   ' : 'FALLA'} ${n} ${x}`) }
const t0 = () => performance.now()
const call = async (m, p, tk, b, extra = {}) => { const s = t0(); const r = await fetch(BASE + p, { method: m, headers: { 'content-type': 'application/json', ...(tk ? { Authorization: 'Bearer ' + tk } : {}), ...(extra.headers || {}) }, body: b === undefined ? undefined : (typeof b === 'string' ? b : JSON.stringify(b)), signal: AbortSignal.timeout(30000), redirect: 'manual' }); const text = await r.text(); let j = null; try { j = JSON.parse(text) } catch {} return { s: r.status, j, text, h: r.headers, ms: t0() - s } }
const pct = (a, q) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))] }
const tag = Date.now().toString(36)
const person = async (i) => { const email = `qa2s-${tag}-${i}@example.test`; const r = await call('POST', '/api/register', null, { name: 'QA2 ' + i, email, password: PASS }); const l = await call('POST', '/api/login', null, { email, password: PASS }); return { email, token: l.j?.token, reg: r.s, login: l.s } }
const ev = (n) => ({ requestId: `s-${tag}-${n}-${Math.floor(Math.random() * 1e6)}`, status: 'confirmed', payload: { title: 'Evidencia sintética QA ' + n, situation: 'Situación sintética.', responsibility: { text: 'Mi parte.' }, actions: [{ text: 'Acción.' }], delivered: { text: 'Entregable.' }, observedEffect: { known: false }, autonomy: 'assisted' } })
;(async () => {
  console.log(`staging: ${BASE} · ${new Date().toISOString()}`)
  // ST-1 salud y página
  const h = await call('GET', '/api/health'); ck('ST-1 /api/health 200 {"status":"ok"}', h.s === 200 && h.j?.status === 'ok', `${h.ms.toFixed(0)} ms; commit=${h.j?.commit || '(no informa)'}`)
  const home = await call('GET', '/'); ck('ST-1 la SPA responde (HTML)', home.s === 200 && /<div id="root"/.test(home.text), `${home.ms.toFixed(0)} ms`)
  const spa = await call('GET', '/app/skill-map'); ck('ST-1 ruta de la SPA sirve el HTML (sin 404)', spa.s === 200 && /<div id="root"/.test(spa.text))
  const nf0 = await call('GET', '/api/no-existe'); ck('ST-5 ruta /api inexistente SIN sesión → 401/403 (no revela rutas)', [401, 403].includes(nf0.s), `HTTP ${nf0.s}`)
  // personas
  const P = []; for (let i = 0; i < 6; i++) P.push(await person(i))
  ck('ST-3 6 personas sintéticas: registro 201 y login 200', P.every(p => p.reg === 201 && p.login === 200 && p.token), P.map(p => p.reg + '/' + p.login).join(' '))
  if (!P.every(p => p.token)) { console.log('Sin sesión: abandono'); process.exit(1) }
  const [A, B] = P
  // ST-3 humo
  const nf = await call('GET', '/api/no-existe', A.token); ck('ST-5 ruta /api inexistente CON sesión → 404 JSON sin traza', nf.s === 404 && !!nf.j && !/at |node_modules/.test(nf.text), `HTTP ${nf.s}`)
  const ses = await call('GET', '/api/session', A.token); ck('ST-3 /api/session 200', ses.s === 200)
  const map = await call('GET', '/api/skill-map', A.token); const hasCatalog = map.s === 200 && Array.isArray(map.j?.skills) && map.j.skills.length > 0
  console.log(`   /api/skill-map → HTTP ${map.s}; catálogo ${map.s === 200 ? 'v' + map.j.catalogVersion + ' con ' + map.j.skills.length + ' capacidades' : 'no disponible: ' + JSON.stringify(map.j)?.slice(0, 120)}`)
  ck('ST-3 GET /api/skill-map responde sin 5xx', map.s < 500)
  if (map.s === 200) ck('ST-3 todas las capacidades de una persona nueva con nivel null (sin déficits ni ceros)', map.j.skills.every(s => (s.self === null || s.self.level === null) && (s.review === null || s.review.level === null)))
  const con = await call('GET', '/api/consents', A.token); ck('ST-3 GET /api/consents 200', con.s === 200)
  // ST-4 aislamiento con evidencia REAL de B
  const bEv = await call('POST', '/api/evidence', B.token, ev('B')); ck('ST-4 B crea una evidencia confirmada', bEv.s === 201, `HTTP ${bEv.s}`)
  const id = bEv.j?.id
  if (id) {
    const g = await call('GET', `/api/evidence/${id}`, A.token); ck('ST-4 A NO lee la evidencia de B por id (404/403)', [403, 404].includes(g.s) && !/Evidencia sintética QA B/.test(g.text), `HTTP ${g.s}`)
    const l = await call('GET', '/api/evidence', A.token); ck('ST-4 el listado de A no incluye la evidencia de B', l.s === 200 && !JSON.stringify(l.j).includes('Evidencia sintética QA B'))
    const u = await call('PUT', `/api/evidence/${id}`, A.token, { ...ev('X'), baseVersion: 1 }); ck('ST-4 A NO puede editar la evidencia de B', [403, 404].includes(u.s), `HTTP ${u.s}`)
    const d = await call('DELETE', `/api/evidence/${id}`, A.token); ck('ST-4 A NO puede borrar la evidencia de B', [403, 404].includes(d.s), `HTTP ${d.s}`)
    const own = await call('GET', `/api/evidence/${id}`, B.token); ck('ST-4 la evidencia de B sigue íntegra para B', own.s === 200 && /Evidencia sintética QA B/.test(own.text))
    const self = await call('POST', '/api/skill-map/self', A.token, { requestId: `x-${tag}-${Math.floor(Math.random() * 1e6)}`, skillKey: map.j?.skills?.[0]?.skillKey || 'comunicacion', level: 2, evidenceRefs: [{ evidenceId: id, version: 1 }], rationale: 'x' }); ck('ST-4 A NO puede citar la evidencia de B para registrar un nivel (4xx)', self.s >= 400 && self.s < 500, `HTTP ${self.s} ${self.j?.code || ''}`)
  }
  const cc = await call('GET', '/api/career-context', A.token); ck('ST-4 contexto del puente de A no contiene datos de B', cc.s === 200 && !/qa2s-.*-1@/.test(cc.text))
  for (const [n, p] of [['/api/skill-map', 'sin token'], ['/api/evidence', 'sin token'], ['/api/career-context', 'sin token'], ['/api/consents', 'sin token']]) { const r = await call('GET', n); ck(`ST-4 ${n} ${p}: 401/403`, [401, 403].includes(r.s), `HTTP ${r.s}`) }
  const adm = await call('GET', '/api/admin/skill-catalog', A.token); ck('ST-4 persona sin rol admin: /api/admin/skill-catalog 403/401/404', [401, 403, 404].includes(adm.s), `HTTP ${adm.s}`)
  const man = await call('GET', '/api/skill-map', A.token.slice(0, -4) + 'xxxx'); ck('ST-4 token manipulado → 401/403', [401, 403].includes(man.s), `HTTP ${man.s}`)
  // ST-5 cabeceras y CORS
  const H = home.h; const hv = (k) => H.get(k)
  console.log('   cabeceras de / :', ['content-security-policy', 'x-frame-options', 'referrer-policy', 'strict-transport-security', 'x-content-type-options', 'x-powered-by', 'access-control-allow-origin'].map(k => `${k}=${hv(k) ? (hv(k).length > 60 ? hv(k).slice(0, 60) + '…' : hv(k)) : '—'}`).join(' | '))
  ck('ST-5 CSP presente con default-src \'self\'', /default-src 'self'/.test(hv('content-security-policy') || ''))
  ck('ST-5 X-Frame-Options DENY/SAMEORIGIN y frame-ancestors none', /DENY|SAMEORIGIN/i.test(hv('x-frame-options') || '') && /frame-ancestors 'none'/.test(hv('content-security-policy') || ''))
  ck('ST-5 Referrer-Policy no-referrer', /no-referrer/.test(hv('referrer-policy') || ''))
  ck('ST-5 sin X-Powered-By', !hv('x-powered-by'))
  ck('ST-5 X-Content-Type-Options nosniff', /nosniff/i.test(hv('x-content-type-options') || ''))
  ck('ST-5 HSTS presente (https)', !!hv('strict-transport-security'), hv('strict-transport-security') || 'ausente (puede ponerlo el proxy)')
  const cors = await call('OPTIONS', '/api/skill-map', null, undefined, { headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'authorization' } }); const acao = cors.h.get('access-control-allow-origin')
  ck('ST-5 CORS: un origen ajeno NO queda autorizado (ni * ni el propio origen ajeno)', acao !== '*' && acao !== 'https://evil.example', `ACAO=${acao || '(ninguno)'}`)
  const bad = await call('POST', '/api/login', null, '{"email":'); ck('ST-5 JSON roto → 400 sin traza ni eco del cuerpo', bad.s === 400 && !/at |node_modules|SyntaxError/.test(bad.text), `HTTP ${bad.s}`)
  const inj = await call('POST', '/api/login', null, { email: "' OR 1=1 --", password: 'x' }); ck('ST-5 inyección SQL en login → 4xx, nunca 5xx ni sesión', inj.s >= 400 && inj.s < 500 && !inj.j?.token, `HTTP ${inj.s}`)
  const big = await call('POST', '/api/login', null, JSON.stringify({ email: 'a@b.test', password: 'y'.repeat(2_000_000) })); ck('ST-5 cuerpo de 2 MB → 4xx (413) sin 5xx', big.s >= 400 && big.s < 500, `HTTP ${big.s}`)
  // ST-6 carga acotada
  let writes = []; const reads = []
  if (hasCatalog) { for (const [i, p] of P.entries()) { const e = await call('POST', '/api/evidence', p.token, ev('c' + i)); p.ev = e.j?.id } }
  const tL = t0()
  await Promise.all(P.map(async (p, i) => { for (let k = 0; k < 20; k++) { reads.push(await call('GET', '/api/skill-map', p.token)); if (hasCatalog && p.ev && k < 1) writes.push(await call('POST', '/api/skill-map/self', p.token, { requestId: `w-${tag}-${i}-${k}-${Math.floor(Math.random() * 1e6)}`, skillKey: map.j.skills[k % map.j.skills.length].skillKey, level: 1 + (i % 4), evidenceRefs: [{ evidenceId: p.ev, version: 1 }], rationale: 'carga' })) } }))
  const dur = ((t0() - tL) / 1000).toFixed(1); const rms = reads.map(r => r.ms), wms = writes.map(r => r.ms)
  console.log(`   carga: 6 personas, ${reads.length} lecturas${writes.length ? ' + ' + writes.length + ' registros de nivel' : ' (sin catálogo: sin registros de nivel)'} en ${dur}s`)
  console.log(`   GET /api/skill-map p50=${pct(rms, .5).toFixed(0)} p95=${pct(rms, .95).toFixed(0)} max=${Math.max(...rms).toFixed(0)} ms · estados ${[...new Set(reads.map(r => r.s))].join(',')}`)
  if (writes.length) console.log(`   POST /api/skill-map/self p50=${pct(wms, .5).toFixed(0)} p95=${pct(wms, .95).toFixed(0)} ms · estados ${[...new Set(writes.map(r => r.s))].join(',')}`)
  ck('ST-6 0 errores 5xx en la ráfaga', [...reads, ...writes].every(r => r.s < 500), `${[...reads, ...writes].filter(r => r.s >= 500).length} errores 5xx`)
  ck('ST-6 p95 de lectura ≤ 600 ms (umbral propuesto, desde esta red)', pct(rms, .95) <= 600, `p95 ${pct(rms, .95).toFixed(0)} ms`)
  if (writes.length) ck('ST-6 registros de nivel 2xx y p95 ≤ 600 ms', writes.every(r => r.s < 300) && pct(wms, .95) <= 600)
  // ST-3 logout revoca
  const lo = await call('POST', '/api/logout', A.token); const aft = await call('GET', '/api/skill-map', A.token); ck('ST-3 logout 200 y el token queda revocado', lo.s === 200 && [401, 403].includes(aft.s), `logout ${lo.s}, después ${aft.s}`)
  // ST-8 secretos y mapas de código en el bundle servido
  const scripts = [...new Set([...home.text.matchAll(/(?:src|href)="(\/assets\/[^"]+\.js)"/g)].map(m => m[1]))]; let bundle = ''; for (const s of scripts) bundle += (await call('GET', s)).text
  console.log(`   bundle: ${scripts.length} archivos JS, ${(bundle.length / 1024).toFixed(0)} KB`)
  const pats = { 'clave de Anthropic': /sk-ant-[A-Za-z0-9_-]{10,}/, 'clave AWS': /AKIA[0-9A-Z]{16}/, 'token JWT literal': /eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}/, 'URL de base de datos': /postgres(ql)?:\/\/[^\s"']+/, 'clave privada': /-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'JWT_SECRET/DATA_ENCRYPTION_KEY': /(JWT_SECRET|DATA_ENCRYPTION_KEY|SERVICE_ROLE|ANTHROPIC_API_KEY)\s*[:=]\s*["'][^"']{8,}/ }
  for (const [n, re] of Object.entries(pats)) ck(`ST-8 el bundle no contiene ${n}`, !re.test(bundle))
  ck('ST-8 el bundle no apunta a localhost ni a mocks de desarrollo', !/localhost:8099|mock-es37|VITE_SKILL_MAP_SAMPLE/.test(bundle))
  const maps = await Promise.all(scripts.slice(0, 3).map(s => call('GET', s + '.map'))); ck('ST-8 sin mapas de código (.map) públicos', maps.every(m => m.s !== 200 || !/"sources"/.test(m.text)), maps.map(m => m.s).join(','))
  for (const p of ['/.env', '/.git/config', '/package.json']) { const r = await call('GET', p); ck(`ST-8 ${p} no expone archivos (200 solo si es la SPA)`, r.s !== 200 || /<div id="root"/.test(r.text), `HTTP ${r.s}`) }
  console.log(`\nPersonas sintéticas creadas en staging (quedan en la base): 6 con prefijo qa2s-${tag}-*@example.test`)
  console.log(fails ? `FALLAS: ${fails}` : 'TODO OK'); process.exit(fails ? 1 : 0)
})().catch(e => { console.error('EXCEPCIÓN', e.message); process.exit(3) })
