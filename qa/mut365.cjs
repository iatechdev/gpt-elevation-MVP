// QA-Claude-2 — PR #365 (ES-349, /admin/manifest), caso B5: mutaciones sobre un clon en la cabeza del PR; cada una debe hacer fallar alguna prueba del frontend. Primero exige línea base verde.
// Uso: CLONE=<clon en la cabeza del PR> node qa/mut365.cjs   (restaura cada archivo)
const fs = require('fs'); const path = require('path'); const { spawnSync } = require('child_process'); const R = process.env.CLONE
const P = 'frontend/src/pages/board/BoardManifest.tsx', S = 'frontend/src/shell/adminLayoutState.ts', ES = 'frontend/src/i18n/es.ts', EN = 'frontend/src/i18n/en.ts'
const runTests = () => { const r = spawnSync('node', ['--test', ...fs.readdirSync(path.join(R, 'frontend', 'test')).filter((f) => f.endsWith('.test.mjs')).map((f) => 'test/' + f)], { cwd: path.join(R, 'frontend'), encoding: 'utf8', maxBuffer: 1 << 26 }); const m = /ℹ fail (\d+)/.exec(r.stdout); return m ? Number(m[1]) : -1 }
const M = [
  ['M1 se quita la ruta migrada de MIGRATED_ADMIN_PATHS', S, ", '/admin/manifest']", ']'],
  ['M2 «Reactivar» vuelve a window.confirm', P, "const handleActivate = async (id: number, version: string) => {\n    setConfirming(null)", "const handleActivate = async (id: number, version: string) => {\n    if (!window.confirm('?')) return\n    setConfirming(null)"],
  ['M3 «Reactivar» activa directo, sin diálogo', P, "onClick={() => setConfirming(v)}", "onClick={() => void handleActivate(v.id, v.version)}"],
  ['M4 vuelve el emoji en «Versión reactivada» (ES)', ES, "board_success_activate: 'Versión reactivada:'", "board_success_activate: '✅ Versión reactivada:'"],
  ['M5 vuelve el emoji en «Manifiesto publicado» (EN)', EN, "board_success_upload: 'Manifest published and activated:'", "board_success_upload: '✅ Manifest published and activated:'"],
  ['M6 el historial pierde aria-expanded', P, "aria-expanded={expandedId === v.id} aria-controls", "aria-controls"],
  ['M7 Reactivar va antes que Cancelar (el foco entraría en la acción)', P, "<Button variant=\"ghost\" onClick={() => setConfirming(null)}>{t('board_cancel')}</Button>\n          <Button onClick={() => { if (confirming) void handleActivate(confirming.id, confirming.version) }}>{t('board_rollback')}</Button>", "<Button onClick={() => { if (confirming) void handleActivate(confirming.id, confirming.version) }}>{t('board_rollback')}</Button>\n          <Button variant=\"ghost\" onClick={() => setConfirming(null)}>{t('board_cancel')}</Button>"],
  ['M8 el mínimo baja de 50 a 40 caracteres', P, "newContent.trim().length < 50", "newContent.trim().length < 40"],
  ['M9 el foco no pasa al aviso de resultado', P, "if (success) statusRef.current?.focus()", "if (success) void 0"],
  ['M10 el error de mínimo no se asocia al campo', P, "error={fieldError ?? undefined}", "error={undefined}"],
  ['M11 se puede pulsar «Reactivar» otra vez mientras se activa', P, "disabled={activating === v.id}", "disabled={false}"],
  ['M12 el diálogo no se cierra al confirmar', P, "setConfirming(null)\n    setActivating(id)", "setActivating(id)"],
  ['M13 el enlace a la página pública desaparece', P, "<Link to=\"/manifiesto\" className=\"bm-public\">{t('manifest_view_public')}</Link>", ""],
  ['M14 la versión activa deja de decir ACTIVO', P, "{v.isActive && <Chip tone=\"ok\" symbol=\"●\">{t('board_active_badge')}</Chip>}", ""],
]
{ const base = runTests(); console.log('línea base sin mutar: fallos =', base); if (base !== 0) { console.log('LA LÍNEA BASE NO ESTÁ VERDE: se detiene'); process.exit(2) } }
let det = 0; for (const [name, file, from, to] of M) { const f = path.join(R, file); const orig = fs.readFileSync(f, 'utf8'); const o = orig.split('\r\n').join('\n'); if (!o.includes(from)) { console.log('NO APLICA  ', name); continue }
  fs.writeFileSync(f, o.split(from).join(to)); const fails = runTests(); fs.writeFileSync(f, orig); const caught = fails !== 0; if (caught) det++; console.log(caught ? 'DETECTADA  ' : 'SOBREVIVE  ', name, `(fallos=${fails})`) }
console.log(`${det}/${M.length} detectadas`)
