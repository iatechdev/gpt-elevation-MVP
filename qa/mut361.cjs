// QA-Claude-2 — PR #361 (ES-349 parte 1), caso A6: mutaciones sobre un clon en la cabeza del PR; cada una debe hacer fallar alguna prueba del frontend (es-116, es-310-marco o el resto de la suite).
// Uso: CLONE=<clon en la cabeza del PR> node qa/mut361.cjs   (después se restaura cada archivo)
const fs = require('fs'); const path = require('path'); const { spawnSync } = require('child_process'); const R = process.env.CLONE
const P = 'frontend/src/skill-catalog/SkillCatalogPages.tsx', A = 'frontend/src/App.tsx', S = 'frontend/src/shell/adminLayoutState.ts', C = 'frontend/src/cartografia/interactive.tsx'
const runTests = () => { const r = spawnSync('node', ['--test', ...fs.readdirSync(path.join(R, 'frontend', 'test')).filter((f) => f.endsWith('.test.mjs')).map((f) => 'test/' + f)], { cwd: path.join(R, 'frontend'), encoding: 'utf8', maxBuffer: 1 << 26 }); const m = /ℹ fail (\d+)/.exec(r.stdout); return m ? Number(m[1]) : -1 }
const M = [
  ['M1 se quita la ruta de MIGRATED_ADMIN_PATHS', S, ", '/admin/skill-catalog']", ']'],
  ['M2 las rutas vuelven fuera del marco de Administración', A, '<Route path="skill-catalog" element={<SkillCatalogManager />} />', '<Route path="skill-catalogx" element={<SkillCatalogManager />} />'],
  ['M3 se quita el diálogo de «Quitar» (se quita directo)', P, "onClick={() => setConfirmRemove(true)}>{t('skcat.remove')}", "onClick={() => void run('remove')}>{t('skcat.remove')}"],
  ['M4 el 409 draft_exists ya no lleva al borrador existente', P, "e.code === 'draft_exists' && e.draftId && current()", "e.code === 'draft_exists_x' && e.draftId && current()"],
  ['M5 el 409 de edición concurrente ya no se maneja', P, "e.code === 'skill_changed'", "e.code === 'skill_changed_x'"],
  ['M6 el diálogo no devuelve el foco', C, "if (target.isConnected) target.focus()", "if (target.isConnected) void 0"],
  ['M7 se pierde la guarda de enlaces con cambios sin guardar', P, "document.addEventListener('click', links, true)", "void links"],
  ['M8 el botón «Crear borrador» deja de explicar por qué está deshabilitado', P, "aria-describedby={draft ? 'skcat-create-reason' : undefined}", ""],
  ['M9 la rúbrica pierde su nota «no decide el nivel»', P, "<p className=\"cg-hint\">{t('skcat.rubric_note')}</p>", ""],
  ['M10 «Obligatorio para publicar» deja de mostrarse', P, "const req = (value: string) => missing(value) ? t('skcat.required_publish') : undefined", "const req = (value: string) => undefined"],
  ['M11 el cuadro de diálogo de quitar usa Esc sin onClose (no cierra)', C, "event.preventDefault(); onClose() }", "event.preventDefault() }"],
]
{ const base = runTests(); console.log('línea base sin mutar: fallos =', base); if (base !== 0) { console.log('LA LÍNEA BASE NO ESTÁ VERDE: se detiene'); process.exit(2) } }
let det = 0; for (const [name, file, from, to] of M) { const f = path.join(R, file); const orig = fs.readFileSync(f, 'utf8'); const o = orig.split('\r\n').join('\n'); if (!o.includes(from)) { console.log('NO APLICA  ', name); continue }
  fs.writeFileSync(f, o.split(from).join(to)); const fails = runTests(); fs.writeFileSync(f, orig); const caught = fails !== 0; if (caught) det++; console.log(caught ? 'DETECTADA  ' : 'SOBREVIVE  ', name, `(fallos=${fails})`) }
console.log(`${det}/${M.length} detectadas`)
