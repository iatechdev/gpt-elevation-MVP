// QA-Claude-2 — PR #378 (ES-349, seguimiento de #365): mutaciones sobre un clon en la cabeza del PR; cada una debe hacer fallar alguna prueba del frontend (suite de CI). Exige línea base verde.
// Uso: CLONE=<clon en la cabeza del PR> node qa/mut378.cjs   (restaura cada archivo)
const fs = require('fs'); const path = require('path'); const { spawnSync } = require('child_process'); const R = process.env.CLONE
const P = 'frontend/src/pages/board/BoardManifest.tsx', ES = 'frontend/src/i18n/es.ts', EN = 'frontend/src/i18n/en.ts'
const runTests = () => { const r = spawnSync('node', ['--test', ...fs.readdirSync(path.join(R, 'frontend', 'test')).filter((f) => f.endsWith('.test.mjs')).map((f) => 'test/' + f)], { cwd: path.join(R, 'frontend'), encoding: 'utf8', maxBuffer: 1 << 26 }); const m = /ℹ fail (\d+)/.exec(r.stdout); return m ? Number(m[1]) : -1 }
const M = [
  ['M1 la carga vuelve a mostrar el texto crudo del servidor', P, "if (!res.ok) throw new Error('load')", "if (!res.ok) throw new Error(data.error)"],
  ['M2 con la respuesta perdida se afirma éxito sin comparar', P, "if (fresh?.some(v => v.id === id && v.isActive))", "if (true)"],
  ['M3 con la respuesta perdida y sin cambio se muestra el mensaje genérico', P, "setError(t('board_error_unconfirmed'))", "setError(t('board_error_activate'))"],
  ['M4 el 500 al activar muestra el texto del servidor', P, "setError(t('board_error_activate')) // E365-2", "setError(await res.text()) // E365-2"],
  ['M5 las fechas vuelven a es-CO siempre', P, "toLocaleDateString(lang === 'en' ? 'en-US' : 'es-CO'", "toLocaleDateString('es-CO'"],
  ['M6 solo se deshabilita el botón de la versión que se activa', P, "disabled={activating !== null}", "disabled={activating === v.id}"],
  ['M7 el chip ACTIVO sale en todas las versiones', P, "{v.isActive && <Chip tone=\"ok\" symbol=\"●\">{t('board_active_badge')}</Chip>}", "{true && <Chip tone=\"ok\" symbol=\"●\">{t('board_active_badge')}</Chip>}"],
  ['M8 no se vuelve a leer el historial tras perder la respuesta', P, "const fresh = await readVersions()", "const fresh: ManifestVersion[] | null = null"],
  ['M9 el error de carga queda vacío', P, "setError(loadError) // ES-349 seguimiento", "setError('') // ES-349 seguimiento"],
  ['M10 el error al publicar muestra el texto crudo', P, "setError(t('board_error_upload'))\n    } finally {\n      setSubmitting(false)", "setError(String(err))\n    } finally {\n      setSubmitting(false)"],
  ['M11 texto ES del aviso incierto cambiado', ES, "No pudimos confirmar si la versión se reactivó. Revisa el estado y vuelve a intentarlo.", "No se pudo confirmar."],
  ['M12 falta el texto EN del aviso incierto', EN, "  board_error_unconfirmed: 'We couldn\\'t confirm whether the version was reactivated. Check its status and try again.',\n", ""],
  ['M13 tras activar bien no se relee el historial', P, "setSuccess(`${t('board_success_activate')} ${version}`)\n        await fetchVersions(t('board_error_load'))", "setSuccess(`${t('board_success_activate')} ${version}`)"],
]
{ const base = runTests(); console.log('línea base sin mutar: fallos =', base); if (base !== 0) { console.log('LA LÍNEA BASE NO ESTÁ VERDE: se detiene'); process.exit(2) } }
let det = 0; for (const [name, file, from, to] of M) { const f = path.join(R, file); const orig = fs.readFileSync(f, 'utf8'); const o = orig.split('\r\n').join('\n'); if (!o.includes(from)) { console.log('NO APLICA  ', name); continue }
  fs.writeFileSync(f, o.split(from).join(to)); const fails = runTests(); fs.writeFileSync(f, orig); const caught = fails !== 0; if (caught) det++; console.log(caught ? 'DETECTADA  ' : 'SOBREVIVE  ', name, `(fallos=${fails})`) }
console.log(`${det}/${M.length} detectadas`)
