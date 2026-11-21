// QA-Claude-2 — ES-301 (PR #295): mutaciones en MI clon (t2). Uso: node qa/mut295.cjs <clon>/frontend. Restaura con git checkout -- src.
const fs = require('fs'), path = require('path'), cp = require('child_process')
const FE = process.argv[2]; const sh = c => cp.spawnSync(c, { cwd: FE, shell: true, encoding: 'utf8' })
const R = (f, a, b) => () => { const p = path.join(FE, f); const s = fs.readFileSync(p, 'utf8'); if (!s.includes(a)) throw new Error('no encuentra: ' + a.slice(0, 50)); fs.writeFileSync(p, s.split(a).join(b)) }
const MUT = [
  ['M1 el registro ya no exige la casilla', R('src/access/fieldErrors.ts', "if (mode === 'register' && values.terms !== true) errors.terms = 'terms'", '')],
  ['M2 no se envían acceptedTerms ni termsVersion', R('src/pages/LoginPage.tsx', '{ name, email, password, acceptedTerms: true, termsVersion: TERMS_VERSION }', '{ name, email, password }')],
  ['M3 sin noindex mientras hay marcadores', R('src/legal/LegalPage.tsx', 'if (!markers) return', 'return')],
  ['M4 los marcadores dejan de verse', R('src/legal/markup.tsx', '<mark key={index} className="lg-todo">{`[${part.slice(2, -2)}]`}</mark>', '<Fragment key={index} />')],
  ['M5 TERMS_VERSION distinta de la del servidor', R('src/legal/version.ts', "'2026-11-v1'", "'2026-11-v2'")],
  ['M6 los enlaces de la casilla ya no abren pestaña nueva', R('src/access/AccessCard.tsx', ' target="_blank" rel="noopener noreferrer"', '')],
  ['M7 la casilla pierde aria-invalid', R('src/access/AccessCard.tsx', 'aria-invalid={error ? true : undefined}', '')],
  ['M8 la nota del registro dice «consentimiento»', R('src/access/accessCopy.ts', "'access.privacy_note': 'Tus conversaciones y tu diario son privados: solo tú los ves.", "'access.privacy_note': 'Das tu consentimiento. Tus conversaciones y tu diario son privados: solo tú los ves.")],
  ['M9 el error de la casilla pierde el foco', R('src/pages/LoginPage.tsx', 'termsInput.current?.focus()', 'void 0')],
]
for (const [name, fn] of MUT) { sh('git checkout -- src'); try { fn() } catch (e) { console.log('ERROR ' + name + ' ' + e.message); continue }
  const r = sh('npm test 2>&1'); const fail = (r.stdout.match(/# fail (\d+)/) || [])[1]; const names = [...r.stdout.matchAll(/^not ok \d+ - (.{0,80})/gm)].map(m => m[1]).slice(0, 2)
  console.log((+fail > 0 ? 'DETECTADA ' : 'SOBREVIVE  ') + name + ' | fallan ' + fail + (names.length ? ' | ' + names.join(' ; ') : '')) }
sh('git checkout -- src'); console.log('restaurado')
