// [QA-Claude] ES-342 · PR #394 · M10 mutaciones sobre el frontend de la cabeza fusionada (worktree qa-pr-test). Cada mutación (cadena EXACTA única) → `node --test test/es-342b-chat-menu.test.mjs es-123 es-206` (pruebas del PR) → restaura con git checkout.
//   QA_SUT=<repo> node qa/e2e/es342b-mutaciones.cjs
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process')
const REPO = process.env.QA_SUT || 'C:/Users/Usuario/Documents/qa-pr-test'; const F = path.join(REPO, 'frontend'); const S = (p) => path.join(F, 'src', p)
const restore = () => spawnSync('git', ['-C', REPO, 'checkout', '-q', '--', 'frontend'])
const patch = (f, a, b) => { const t = fs.readFileSync(f, 'utf8'); const n = t.split(a).length - 1; if (n !== 1) throw new Error(`no única (${n}): ${a.slice(0, 50)}`); fs.writeFileSync(f, t.replace(a, () => b)) }
const run = () => { const r = spawnSync(process.execPath, ['--test', 'test/es-342b-chat-menu.test.mjs', 'test/es-123-chat-layout.test.mjs', 'test/es-206-pulido.test.mjs'], { cwd: F, encoding: 'utf8', timeout: 240000 }); return `${(r.stdout.match(/^# pass (\d+)/m) || [])[1]}/${(r.stdout.match(/^# fail (\d+)/m) || [])[1]}` }
const M = [
  ['m1 despliegue sin hidden (siempre abierto)', S('space/ChatMenu.tsx'), 'hidden={!more}', 'hidden={false}'],
  ['m2 «Mi progreso» duplicado (sin filtrar la lista de usuario)', S('space/ChatMenu.tsx'), ".filter(item => item.label !== 'progress')", ''],
  ['m3 sin aria-expanded en el despliegue', S('space/ChatMenu.tsx'), 'aria-expanded={more} ', ''],
  ['m4 sin «Cerrar» arriba (headerAction)', S('space/ChatMenu.tsx'), 'headerAction={<Button variant="ghost" onClick={onClose}>{c.close}</Button>}', ''],
  ['m5 pie «Cerrar sesión» sin variante de peligro', S('space/ChatMenu.tsx'), '<Button variant="danger" onClick', '<Button variant="ghost" onClick'],
  ['m6 ☰ sin nombre accesible «Menú»', S('pages/ChatPage.tsx'), ' aria-label={copy[lang].menu} aria-haspopup="dialog"', ' aria-haspopup="dialog"'],
  ['m7 título h1 → h2', S('space/ChatBar.tsx'), '<h1>{c.conversation}</h1>', '<h2>{c.conversation}</h2>'],
  ['m8 «Pausar» sin ghost', S('space/ChatBar.tsx'), 'cg-btn cg-btn--ghost chat-pause', 'chat-pause'],
  ['m9 barra de uso sin --cg-mark', S('space/space.css'), '.chat-shell .space-meter:not(.space-meter-full) i { background: var(--cg-mark); }', ''],
  ['m10 Dialog sin data-fixed (cabecera/pie no fijos)', S('cartografia/interactive.tsx'), "data-fixed={headerAction ? '' : undefined} ", ''],
  ['m11 idioma/tema vuelven a PreferencesBar suelta', S('space/ChatMenu.tsx'), '<div className="chat-menu-pref"><span>{shell.language}</span><LangSwitch /></div>', '<div className="chat-menu-pref"><LangSwitch /></div>'],
  ['m12 el h1 oculto original vuelve (dos h1)', S('pages/ChatPage.tsx'), '<div className="chat-shell">', '<div className="chat-shell"><h1 className="sr-only">x</h1>'],
]
restore(); console.log('BASE pruebas del PR (pasan/fallan):', run()); let surv = 0
for (const [name, file, a, b] of M) { restore(); try { patch(file, a, b) } catch (e) { console.log(`${name}: NO APLICA ${e.message}`); continue } const r = run(); const det = !/\/0$/.test(r); if (!det) surv++; console.log(`${name}: ${r} → ${det ? 'DETECTADA' : 'SOBREVIVE'}`) }
restore(); console.log(`SOBREVIVEN ${surv} de ${M.length}`)
