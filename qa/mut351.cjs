// QA-Claude-2 — PR #351 (ES-308 / E340-1) mutaciones: FRONTEND=<clon>/frontend node qa/mut351.cjs (prueba: test/es-308-brujula.test.mjs; debe fallar la prueba NUEVA E340-1)
const fs = require('fs'), path = require('path'), { execSync } = require('child_process'); const FE = path.resolve(process.env.FRONTEND); const PG = path.join(FE, 'src/compass/CompassPage.tsx'), CP = path.join(FE, 'src/compass/copy.ts')
const oP = fs.readFileSync(PG, 'utf8'), oC = fs.readFileSync(CP, 'utf8'); const restore = () => { fs.writeFileSync(PG, oP); fs.writeFileSync(CP, oC) }
const out = () => { try { execSync('node --test test/es-308-brujula.test.mjs', { cwd: FE, stdio: 'pipe', timeout: 120000, shell: true }); return '' } catch (e) { return String(e.stdout) } }
const M = (name, file, a, b) => { restore(); const s = fs.readFileSync(file, 'utf8'); if (!s.includes(a)) { console.log(`M ${name}: SIN ANCLA`); return }
  fs.writeFileSync(file, s.replace(a, () => b)); const o = out(); const nueva = (o.match(/E340-1/g) || []).length >= 2 && /fail 1\b/.test(o)
  console.log(`M ${name}: ${o === '' ? 'SOBREVIVE' : nueva ? 'DETECTADO por la prueba NUEVA E340-1' : 'DETECTADO por otra prueba (la nueva no falla)'}`); restore() }
console.log('sin mutar:', out() === '' ? 'pasa' : 'FALLA (mal)')
const TAG = "{context.active && <Banner title={tr('replaces')} />}"
M('a se quita el aviso', PG, TAG, '')
M('b el aviso se muestra sin la condición context.active', PG, TAG, "<Banner title={tr('replaces')} />")
M('c el aviso se duplica', PG, TAG, TAG + TAG)
M('d el aviso va antes del límite', PG, "<h2 id=\"new-heading\">{tr('new')}</h2><p>{tr('limit')}</p>" + TAG, "<h2 id=\"new-heading\">{tr('new')}</h2>" + TAG + "<p>{tr('limit')}</p>")
M('e el texto ES cambia', CP, 'Esta autorización reemplaza la versión activa completa.', 'Esta autorización agrega a la versión activa.')
M('f el texto EN cambia', CP, 'This authorization replaces the entire active version.', 'This authorization adds to the active version.')
M('g el Banner de Cartografía se sustituye por un <p>', PG, TAG, "{context.active && <p>{tr('replaces')}</p>}")
M('h el aviso condicionado por otra bandera (context.version)', PG, TAG, "{context.version && <Banner title={tr('replaces')} />}")
M('i el texto promete conservar lo no seleccionado (ES)', CP, 'Los campos no seleccionados no estarán en la nueva versión.', 'Los campos no seleccionados se conservan.')
restore(); console.log('clon restaurado')
