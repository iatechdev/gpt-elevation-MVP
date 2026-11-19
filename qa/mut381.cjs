// QA-Claude-2 — PR #381 (ES-182, decisión 12079): mutaciones sobre un clon en la cabeza del PR; cada una debe hacer fallar alguna prueba (unitarias del backend que toca el PR y del frontend). Exige línea base verde.
// Uso: CLONE=<clon en la cabeza del PR> node qa/mut381.cjs   (restaura cada archivo)
const fs = require('fs'); const path = require('path'); const { spawnSync } = require('child_process'); const R = process.env.CLONE
const A = 'backend/middlewares/auth.js', B = 'backend/routes/board.js', P = 'frontend/src/pages/board/BoardManifest.tsx'
const BACK = ['test/es-182-roles.test.cjs', 'test/p1-3-manifest.test.cjs', 'test/qa-9-02.test.cjs']; const FRONT = ['test/es-182-manifiesto-cartografia.test.mjs', 'test/es-310-marco-admin.test.mjs']
const one = (cwd, files) => { const r = spawnSync('node', ['--test', ...files], { cwd: path.join(R, cwd), encoding: 'utf8', maxBuffer: 1 << 26 }); const m = /ℹ fail ([0-9]+)/.exec(r.stdout); return m ? Number(m[1]) : -1 }
const runTests = () => { const b = one('backend', BACK), f = one('frontend', FRONT); return b < 0 || f < 0 ? -1 : b + f }
const M = [
  ['M1 publicar vuelve a usar la guarda de administración (admin publica)', B, "router.post('/manifest', verificarPublicadorManifiesto,", "router.post('/manifest', verificarEditorManifiesto,"],
  ['M2 reactivar vuelve a usar la guarda de administración (admin reactiva)', B, "router.put('/manifest/:id/activate', verificarPublicadorManifiesto,", "router.put('/manifest/:id/activate', verificarEditorManifiesto,"],
  ['M3 la guarda nueva deja pasar a admin', A, "if (req.user.role !== 'superadmin') {\n      return res.status(403).json({ error: 'Acceso denegado. Solo superadministración", "if (!['admin', 'superadmin'].includes(req.user.role)) {\n      return res.status(403).json({ error: 'Acceso denegado. Solo superadministración"],
  ['M4 la guarda nueva deja pasar a cualquier sesión', A, "if (req.user.role !== 'superadmin') {\n      return res.status(403).json({ error: 'Acceso denegado. Solo superadministración", "if (false) {\n      return res.status(403).json({ error: 'Acceso denegado. Solo superadministración"],
  ['M5 el historial pasa a ser solo de superadmin (admin ya no lee)', B, "router.get('/manifest', verificarEditorManifiesto,", "router.get('/manifest', verificarPublicadorManifiesto,"],
  ['M6 el mensaje 403 ya no dice «superadministración»', A, "Solo superadministración puede publicar o reactivar versiones del manifiesto.", "Acceso denegado."],
  ['M7 la lectura pública exige sesión de edición', B, "router.get('/active', async", "router.get('/active', verificarEditorManifiesto, async"],
  ['M8 la pantalla pinta los controles para todos', P, "const canPublish = (localStorage.getItem('elevation_role') ?? '') === 'superadmin'", "const canPublish = true"],
  ['M9 la pantalla pinta los controles también a admin', P, "const canPublish = (localStorage.getItem('elevation_role') ?? '') === 'superadmin'", "const canPublish = ['admin', 'superadmin'].includes(localStorage.getItem('elevation_role') ?? '')"],
  ['M10 «Reactivar» se pinta a admin', P, "{canPublish && !v.isActive && (", "{!v.isActive && ("],
  ['M11 el formulario se puede abrir sin permiso', P, "{canPublish && showForm && (", "{showForm && ("],
  ['M12 el enlace público solo lo ve superadmin', P, "<Link to=\"/manifiesto\" className=\"bm-public\">{t('manifest_view_public')}</Link>", "{canPublish && <Link to=\"/manifiesto\" className=\"bm-public\">{t('manifest_view_public')}</Link>}"],
  ['M13 se pierde la exportación de la guarda nueva', A, "module.exports = { verificarPublicadorManifiesto, verificarEditorManifiesto,", "module.exports = { verificarEditorManifiesto,"],
]
{ const base = runTests(); console.log('línea base sin mutar: fallos =', base); if (base !== 0) { console.log('LA LÍNEA BASE NO ESTÁ VERDE: se detiene'); process.exit(2) } }
let det = 0; for (const [name, file, from, to] of M) { const f = path.join(R, file); const orig = fs.readFileSync(f, 'utf8'); const o = orig.split('\r\n').join('\n'); if (!o.includes(from)) { console.log('NO APLICA  ', name); continue }
  fs.writeFileSync(f, o.split(from).join(to)); let fails; try { fails = runTests() } finally { fs.writeFileSync(f, orig) } const caught = fails !== 0; if (caught) det++; console.log(caught ? 'DETECTADA  ' : 'SOBREVIVE  ', name, `(fallos=${fails})`) }
console.log(`${det}/${M.length} detectadas`)
