// QA-Claude-2 — PR #365: las mutaciones que sobreviven a la suite de CI, contra mi E2E en navegador real (qa/e365-real.cjs). Cada una: se aplica en el clon, se construye, se sirve en :4363 y se corre el E2E; se compara con la línea base.
// Uso: CLONE=<clon en la cabeza del PR> BASELINE=<fallos del PR sin mutar> ONLY=M3,M11 + variables de e365-real.cjs node qa/mut365-e2e.cjs
const fs = require('fs'); const path = require('path'); const { spawnSync } = require('child_process'); const R = process.env.CLONE; const BASE_FAILS = Number(process.env.BASELINE ?? 1); const DIST = 'C:/Users/Usuario/tools/qa2/b361mut'
const P = 'frontend/src/pages/board/BoardManifest.tsx'
const M = [
  ['M3 «Reactivar» activa directo, sin diálogo', P, "onClick={() => setConfirming(v)}", "onClick={() => void handleActivate(v.id, v.version)}"],
  ['M11 se puede pulsar «Reactivar» otra vez mientras se activa', P, "disabled={activating === v.id}", "disabled={false}"],
  ['M12 el diálogo no se cierra al confirmar', P, "setConfirming(null)\n    setActivating(id)", "setActivating(id)"],
  ['M14 la versión activa deja de decir ACTIVO en el historial', P, "{v.isActive && <Chip tone=\"ok\" symbol=\"●\">{t('board_active_badge')}</Chip>}", ""],
]
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null
let det = 0; for (const [name, file, from, to] of M) { if (ONLY && !ONLY.some((k) => name.startsWith(k + ' '))) continue; const f = path.join(R, file); const orig = fs.readFileSync(f, 'utf8'); const o = orig.split('\r\n').join('\n'); if (!o.includes(from)) { console.log('NO APLICA  ', name); continue }
  fs.writeFileSync(f, o.split(from).join(to)); let fails = -1, out = ''
  try { const b = spawnSync('npx', ['vite', 'build', '--outDir', DIST, '--emptyOutDir'], { cwd: path.join(R, 'frontend'), encoding: 'utf8', shell: true }); if (b.status !== 0) { console.log('NO COMPILA ', name, (b.stdout + b.stderr).slice(-200)); continue }
    const r = spawnSync('node', [path.join(__dirname, 'e365-real.cjs')], { encoding: 'utf8', env: { ...process.env, BASE: 'http://localhost:4363', LABEL: 'pr' }, maxBuffer: 1 << 26 }); out = r.stdout + ' ' + (r.stderr || '').split(String.fromCharCode(10)).filter((l) => /Error|Timeout|waiting/.test(l)).slice(0, 1).join(' '); const m = /(\d+) comprobaciones correctas, (\d+) fallos/.exec(out); fails = m ? Number(m[2]) : -1 } finally { fs.writeFileSync(f, orig) }
  const caught = fails > BASE_FAILS || fails === -1; if (caught) det++; console.log(caught ? 'DETECTADA  ' : 'SOBREVIVE  ', name, `(fallos ${fails} vs línea base ${BASE_FAILS})`, (out.match(/FALLA \[mut\] [^\n]{0,90}/g) || []).filter((l) => !/mientras guarda/.test(l)).slice(0, 2).join(' || ')) }
console.log(`${det}/${M.length} detectadas por el E2E real`)
