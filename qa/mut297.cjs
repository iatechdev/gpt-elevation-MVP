// QA-Claude-2 — ES-153 paso 3/3 (PR #297): mutaciones en MI clon (t2). Uso: node qa/mut297.cjs <clon>/frontend. Restaura con git checkout -- src.
const fs = require('fs'), path = require('path'), cp = require('child_process')
const FE = process.argv[2]; const sh = c => cp.spawnSync(c, { cwd: FE, shell: true, encoding: 'utf8' })
const R = (f, a, b) => () => { const p = path.join(FE, f); const s = fs.readFileSync(p, 'utf8'); if (!s.includes(a)) throw new Error('no encuentra: ' + a.slice(0, 60)); fs.writeFileSync(p, s.split(a).join(b)) }
const MUT = [
  ['M1 las heredadas ya no marcan aria-disabled', R('src/shell/Frame.tsx', 'aria-disabled={legacy || undefined}', '')],
  ['M2 las heredadas dejan de ser claras fijas (usan el tema elegido)', R('src/shell/frames.tsx', "theme={migrated ? theme : 'light'}", 'theme={theme}')],
  ['M3 la elección ya no se guarda', R('src/cartografia/themeState.ts', 'else localStorage.setItem(KEY, theme); return true', 'else void 0; return true')],
  ['M4 se quita el escuchador storage (entre pestañas)', R('src/cartografia/themeState.ts', "window.addEventListener('storage', onStorage)", 'void onStorage')],
  ['M5 el selector pierde aria-pressed', R('src/shell/Frame.tsx', 'aria-pressed={theme === option.id}', '')],
  ['M6 Auto deja de seguir al sistema (valor por defecto claro)', R('src/cartografia/themeState.ts', "value === 'light' || value === 'dark' ? value : 'system'", "value === 'light' || value === 'dark' ? value : 'light'")],
  ['M7 se invierte el orden de Tab (tema antes que idioma)', R('src/shell/Frame.tsx', '<LangSwitch /><ThemeSwitch legacy={legacy} />', '<ThemeSwitch legacy={legacy} /><LangSwitch />')],
  ['M8 el chat vuelve a la altura vieja (encabezado de 264 px)', R('src/space/space.css', 'calc(100dvh - 18.1rem)', 'calc(100dvh - 21rem)')],
  ['M9 el botón inactivo SÍ cambia el tema (se quita la guarda)', R('src/shell/Frame.tsx', 'onClick={() => { if (!legacy) setTheme(option.id) }}', 'onClick={() => { setTheme(option.id) }}')],
]
for (const [name, fn] of MUT) { sh('git checkout -- src'); try { fn() } catch (e) { console.log('ERROR ' + name + ' ' + e.message); continue }
  const r = sh('npm test 2>&1'); const fail = (r.stdout.match(/# fail (\d+)/) || [])[1]; const names = [...r.stdout.matchAll(/^not ok \d+ - (.{0,80})/gm)].map(m => m[1]).slice(0, 2)
  console.log((+fail > 0 ? 'DETECTADA ' : 'SOBREVIVE  ') + name + ' | fallan ' + fail + (names.length ? ' | ' + names.join(' ; ') : '')) }
sh('git checkout -- src'); console.log('restaurado')
