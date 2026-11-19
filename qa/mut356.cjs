// QA-Claude-2 — PR #356 mutaciones del aria-label de LandingHeader: FRONTEND=<clon>/frontend node qa/mut356.cjs (prueba del PR: test/landing-header.test.mjs)
const fs = require('fs'), path = require('path'), { execSync } = require('child_process'); const FE = path.resolve(process.env.FRONTEND); const F = path.join(FE, 'src/components/landing/LandingHeader.tsx'); const orig = fs.readFileSync(F, 'utf8')
const fails = () => { try { execSync('node --test test/landing-header.test.mjs', { cwd: FE, stdio: 'pipe', timeout: 120000, shell: true }); return false } catch (e) { return true } }
const A = 'aria-label={`${text(`landing.header.${code}`)} — ${LANGUAGE_NAMES[code]}`}'; if (!orig.includes(A)) { console.log('SIN ANCLA'); process.exit(1) }
const M = (name, b) => { fs.writeFileSync(F, orig.replace(A, () => b)); console.log(`M ${name}: ${fails() ? 'DETECTADO' : 'SOBREVIVE'}`); fs.writeFileSync(F, orig) }
console.log('sin mutar:', fails() ? 'FALLA (mal)' : 'pasa')
M('se quita el prefijo (vuelve al nombre de main)', 'aria-label={LANGUAGE_NAMES[code]}')
M('el prefijo es el texto visible del OTRO idioma', 'aria-label={`${text(`landing.header.${code === "es" ? "en" : "es"}`)} — ${LANGUAGE_NAMES[code]}`}')
M('se quita el nombre del idioma en su propio idioma', 'aria-label={`${text(`landing.header.${code}`)}`}')
M('el nombre del idioma va primero (no empieza por el texto visible)', 'aria-label={`${LANGUAGE_NAMES[code]} — ${text(`landing.header.${code}`)}`}')
M('el prefijo es una cadena fija', 'aria-label={`ES — ${LANGUAGE_NAMES[code]}`}')
M('se pierde la separación (ESEspañol)', 'aria-label={`${text(`landing.header.${code}`)}${LANGUAGE_NAMES[code]}`}')
fs.writeFileSync(F, orig); console.log('clon restaurado')
