// QA-Claude-2 — PR #378: las mutaciones que sobreviven a la suite de CI, contra mi E2E en navegador real (qa/e378-real.cjs). Cada una: se aplica en el clon, se construye, se sirve en :4363 y se corre el E2E; se compara con la línea base.
// Uso: CLONE=<clon en la cabeza del PR> BASELINE=0 [ONLY=M7,M9] + variables de e378-real.cjs (PLAYWRIGHT_MODULE, TOKENS, OUT) node qa/mut378-e2e.cjs   (necesita un servidor estático con proxy /api en :4363 sirviendo b361mut)
const fs = require('fs'); const path = require('path'); const { spawnSync } = require('child_process'); const R = process.env.CLONE; const BASE_FAILS = Number(process.env.BASELINE ?? 0); const DIST = 'C:/Users/Usuario/tools/qa2/b361mut'
const P = 'frontend/src/pages/board/BoardManifest.tsx', ES = 'frontend/src/i18n/es.ts'
const M = [
  ['M7 el chip ACTIVO sale en todas las versiones', P, "{v.isActive && <Chip tone=\"ok\" symbol=\"●\">{t('board_active_badge')}</Chip>}", "{true && <Chip tone=\"ok\" symbol=\"●\">{t('board_active_badge')}</Chip>}"],
  ['M9 el error de carga queda vacío', P, "setError(loadError) // ES-349 seguimiento", "setError('') // ES-349 seguimiento"],
  ['M10 el error al publicar muestra el texto crudo', P, "setError(t('board_error_upload'))\n    } finally {\n      setSubmitting(false)", "setError(String(err))\n    } finally {\n      setSubmitting(false)"],
  ['M11 texto ES del aviso incierto cambiado', ES, "No pudimos confirmar si la versión se reactivó. Revisa el estado y vuelve a intentarlo.", "No se pudo confirmar."],
  ['M13 tras activar bien no se relee el historial', P, "setSuccess(`${t('board_success_activate')} ${version}`)\n        await fetchVersions(t('board_error_load'))", "setSuccess(`${t('board_success_activate')} ${version}`)"],
]
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null
let det = 0, n = 0; for (const [name, file, from, to] of M) { if (ONLY && !ONLY.some((k) => name.startsWith(k + ' '))) continue; n++; const f = path.join(R, file); const orig = fs.readFileSync(f, 'utf8'); const o = orig.split('\r\n').join('\n'); if (!o.includes(from)) { console.log('NO APLICA  ', name); continue }
  fs.writeFileSync(f, o.split(from).join(to)); let fails = -1, out = ''
  try { const b = spawnSync('npx', ['vite', 'build', '--outDir', DIST, '--emptyOutDir'], { cwd: path.join(R, 'frontend'), encoding: 'utf8', shell: true }); if (b.status !== 0) { console.log('NO COMPILA ', name, (b.stdout + b.stderr).slice(-200)); continue }
    const r = spawnSync('node', [path.join(__dirname, 'e378-real.cjs')], { encoding: 'utf8', env: { ...process.env, BASE: 'http://localhost:4363', LABEL: 'pr' }, maxBuffer: 1 << 26 }); out = r.stdout + ' ' + (r.stderr || '').split(String.fromCharCode(10)).filter((l) => /Error|Timeout|waiting/.test(l)).slice(0, 1).join(' '); const m = /(\d+) comprobaciones correctas, (\d+) fallos/.exec(out); fails = m ? Number(m[2]) : -1 } finally { fs.writeFileSync(f, orig) }
  const caught = fails > BASE_FAILS || fails === -1; if (caught) det++; console.log(caught ? 'DETECTADA  ' : 'SOBREVIVE  ', name, `(fallos ${fails} vs línea base ${BASE_FAILS})`, (out.match(/FALLA \[pr\] [^\n]{0,80}|Timeout[^\n]{0,60}/g) || []).slice(0, 2).join(' || ')) }
console.log(`${det}/${n} detectadas por el E2E real`)
