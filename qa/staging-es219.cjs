// QA-Claude-2 — ES-219 en STAGING (solo lectura): comprueba que staging sirve el commit esperado y que las rutas de guías (/prompts, /prompt/:key/versions) responden bien tras la migración.
// No crea, cambia ni borra nada. Cuenta qa.superadmin del archivo local (la clave se lee dentro del proceso y no se imprime). 0 IA.
// Env: STAGING_URL, CRED_FILE, EXPECT_COMMIT (opcional).
const fs = require('fs'); const BASE = process.env.STAGING_URL.replace(/\/$/, ''); if (!/^https:\/\/backend-staging-/.test(BASE)) process.exit(2)
const lines = fs.readFileSync(process.env.CRED_FILE, 'utf8').split(/\r?\n/); const sec = e => { const l = lines.find(x => x.includes(e)); return l.slice(l.indexOf(e) + e.length).replace(/^[\s:=|,;\-–>]+/, '').replace(/^(?:clave|contraseña|password)\s*[:=]\s*/i, '').split(/\s{2,}/)[0].trim() }
let f = 0; const ck = (n, ok, x = '') => { if (!ok) f++; console.log((ok ? 'OK   ' : 'FALLA ') + n, x) }; const info = (...a) => console.log('INFO', ...a)
const call = async (p, t) => { const t0 = Date.now(); const r = await fetch(BASE + p, { headers: t ? { Authorization: 'Bearer ' + t } : {} }); let j = null; try { j = await r.json() } catch {} return { s: r.status, j, ms: Date.now() - t0 } }
;(async () => {
  const h = await call('/api/health'); ck('Staging responde y sirve el commit esperado', h.s === 200 && (!process.env.EXPECT_COMMIT || h.j?.commit === process.env.EXPECT_COMMIT), JSON.stringify(h.j))
  const e = 'qa.superadmin@example.test'; const r = await fetch(BASE + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: e, password: sec(e) }) }); const tk = (await r.json().catch(() => ({}))).token; ck('Sesión de la cuenta qa.superadmin', !!tk, 'HTTP ' + r.status)
  const l = await call('/api/superadmin/prompts', tk); const rows = Array.isArray(l.j) ? l.j : l.j?.prompts || []; ck('GET /api/superadmin/prompts responde 200 con la lista de guías', l.s === 200 && rows.length > 0, `HTTP ${l.s} ${l.ms} ms, ${rows.length} guías`)
  const a = await call('/api/admin/prompts', tk); ck('GET /api/admin/prompts (ruta de administración) responde 200', a.s === 200, `HTTP ${a.s} ${a.ms} ms`)
  let bad = 0, n = 0; for (const k of rows.map(x => x.key).filter(Boolean).slice(0, 12)) { const v = await call('/api/superadmin/prompt/' + encodeURIComponent(k) + '/versions', tk); n++; const vs = Array.isArray(v.j) ? v.j : v.j?.versions || []; const seen = new Set(vs.map(x => x.version)); const act = vs.filter(x => x.status === 'active').length; if (v.s !== 200 || seen.size !== vs.length || act > 1) { bad++; info('clave con problema', k, 'HTTP', v.s, 'versiones', vs.length, 'únicas', seen.size, 'activas', act) } }
  ck(`Versiones de ${n} guías: HTTP 200, versiones sin repetir y como máximo 1 activa por clave`, bad === 0 && n > 0, `con problema=${bad}`)
  console.log(f ? `\nFALLAS ${f}` : '\nTODO OK'); process.exit(f ? 1 : 0)
})().catch(e => { console.error('EXCEPCIÓN', e.message); process.exit(3) })
