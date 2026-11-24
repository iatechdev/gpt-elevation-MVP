// QA-Claude-2 — PR #361: las mutaciones que sobreviven a la suite de CI, ahora contra mi E2E en navegador real (qa/e361-real.cjs). Cada una: se aplica en el clon, se construye, se sirve en :4363 y se corre el E2E; se compara con la línea base (fallos del PR sin mutar).
// Uso: CLONE=<clon en la cabeza del PR> BASELINE=<n fallos del PR sin mutar> + las variables de e361-real.cjs (PLAYWRIGHT_MODULE, TOKENS, OUT) node qa/mut361-e2e.cjs
const fs = require('fs'); const path = require('path'); const { spawnSync } = require('child_process'); const R = process.env.CLONE; const BASE_FAILS = Number(process.env.BASELINE ?? 1); const DIST = 'C:/Users/Usuario/tools/qa2/b361mut'
const P = 'frontend/src/skill-catalog/SkillCatalogPages.tsx'
const M = [
  ['M3 se quita el diálogo de «Quitar»', P, "onClick={() => setConfirmRemove(true)}>{t('skcat.remove')}", "onClick={() => void run('remove')}>{t('skcat.remove')}"],
  ['M5 el 409 de edición concurrente ya no se maneja', P, "e.code === 'skill_changed'", "e.code === 'skill_changed_x'"],
  ['M7 se pierde la guarda de enlaces con cambios sin guardar', P, "document.addEventListener('click', links, true)", "void links"],
  ['M8 «Crear borrador» sin motivo asociado', P, "aria-describedby={draft ? 'skcat-create-reason' : undefined}", ""],
  ['M10 «Obligatorio para publicar» deja de mostrarse', P, "const req = (value: string) => missing(value) ? t('skcat.required_publish') : undefined", "const req = (value: string) => undefined"],
  ['M12 la lista de versiones no abre el borrador', P, "go(`/admin/skill-catalog/${row.id}`)}>{row.status === 'draft' ? t('skcat.open_draft') : t('skcat.view')}", "go(`/admin/skill-catalog`)}>{row.status === 'draft' ? t('skcat.open_draft') : t('skcat.view')}"],
]
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null
let det = 0; for (const [name, file, from, to] of M) { if (ONLY && !ONLY.some((k) => name.startsWith(k + ' '))) continue; const f = path.join(R, file); const orig = fs.readFileSync(f, 'utf8'); const o = orig.split('\r\n').join('\n'); if (!o.includes(from)) { console.log('NO APLICA  ', name); continue }
  fs.writeFileSync(f, o.split(from).join(to)); let fails = -1, out = ''
  try { const b = spawnSync('npx', ['vite', 'build', '--outDir', DIST, '--emptyOutDir'], { cwd: path.join(R, 'frontend'), encoding: 'utf8', shell: true }); if (b.status !== 0) { console.log('NO COMPILA ', name, (b.stdout + b.stderr).slice(-200)); continue }
    const r = spawnSync('node', [path.join(__dirname, 'e361-real.cjs')], { encoding: 'utf8', env: { ...process.env, BASE: 'http://localhost:4363', LABEL: 'pr' }, maxBuffer: 1 << 26 }); out = r.stdout; const m = /(\d+) comprobaciones correctas, (\d+) fallos/.exec(out); fails = m ? Number(m[2]) : -1 } finally { fs.writeFileSync(f, orig) }
  const caught = fails > BASE_FAILS || fails === -1; if (caught) det++; console.log(caught ? 'DETECTADA  ' : 'SOBREVIVE  ', name, `(fallos ${fails} vs línea base ${BASE_FAILS})`, (out.match(/FALLA \[mut\] [^\n]{0,90}/g) || []).filter((l) => !/mientras guarda/.test(l)).slice(0, 2).join(' || ')) }
console.log(`${det}/${M.length} detectadas por el E2E real`)
