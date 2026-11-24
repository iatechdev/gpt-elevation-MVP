// QA-Claude-2 — PR #354 (ES-347) mutaciones M4/M5: FRONTEND=<clon>/frontend node qa/mut354.cjs (prueba: test/es-329-marco-persona.test.mjs). Muestra QUÉ prueba falla.
const fs = require('fs'), path = require('path'), { execSync } = require('child_process'); const FE = path.resolve(process.env.FRONTEND); const P = (f) => path.join(FE, f)
const files = ['src/routeCatalog/PersonCatalog.tsx', 'src/space/PersonScreen.tsx', 'src/progress/progress.css', 'src/pages/UserProgress.tsx']; const orig = Object.fromEntries(files.map((f) => [f, fs.readFileSync(P(f), 'utf8')])); const restore = () => files.forEach((f) => fs.writeFileSync(P(f), orig[f]))
const out = () => { try { execSync('node --test test/es-329-marco-persona.test.mjs', { cwd: FE, stdio: 'pipe', timeout: 120000, shell: true }); return '' } catch (e) { return String(e.stdout) } }
const failing = (o) => [...o.matchAll(/✖ (ES-\d+[^\n(]*)/g)].map((m) => m[1].trim().slice(0, 60))
const M = (name, file, a, b) => { restore(); const s = fs.readFileSync(P(file), 'utf8'); if (!s.includes(a)) { console.log(`M ${name}: SIN ANCLA «${a.slice(0, 40)}»`); return } fs.writeFileSync(P(file), s.replace(a, () => b)); const o = out(); console.log(`M ${name}: ${o === '' ? 'SOBREVIVE' : 'DETECTADO → ' + [...new Set(failing(o))].join(' | ')}`); restore() }
console.log('sin mutar:', out() === '' ? 'pasa' : 'FALLA (mal)')
const PC = files[0], PS = files[1], CSS = files[2], UP = files[3]
M('M4a se quita el efecto de foco del rol', PC, 'useEffect(() => { if (role) titleRef.current?.focus() }, [role?.roleKey])', '')
M('M4b dependencias [] en vez de [role?.roleKey]', PC, '}, [role?.roleKey]) // eslint-disable-line', '}, []) // eslint-disable-line')
M('M4c el foco va a otro elemento (document.body)', PC, 'if (role) titleRef.current?.focus() }', 'if (role) document.body.focus() }')
M('M4d no se pasa titleRef a Screen', PC, 'titleRef={titleRef}>', '>')
const TAIL = (name, add) => { restore(); fs.writeFileSync(P(PC), orig[PC] + add); const o = out(); console.log(`M ${name}: ${o === '' ? 'SOBREVIVE' : 'DETECTADO → ' + [...new Set(failing(o))].join(' | ')}`); restore() }
TAIL('M4e RoleDetail con otro h1 (añadido tras RoleDetail, dentro de lo que la prueba revisa)', '\nexport const ExtraH1 = () => <h1>otro</h1>\n')
TAIL('M4e2 vuelve el aria-labelledby role-title', '\nexport const ExtraId = () => <section aria-labelledby="role-title" />\n')
M('M4f el h1 de PersonScreen pierde la referencia', PS, 'ref={titleRef} tabIndex={titleRef ? -1 : undefined}>', '>')
M('M4g el h1 pierde tabIndex -1 (no enfocable por programa)', PS, 'tabIndex={titleRef ? -1 : undefined}', '')
M('M5a .prg recupera min-height', CSS, '.prg { min-width: 0; }', '.prg { min-width: 0; min-height: 100vh; }')
M('M5b .prg-main recupera relleno', CSS, '.prg-main { display: grid;', '.prg-main { padding: 24px; display: grid;')
M('M5c .prg-main recupera ancho máximo', CSS, '.prg-main { display: grid;', '.prg-main { max-width: 640px; margin: 0 auto; display: grid;')
M('M5d .prg recupera alto fijo', CSS, '.prg { min-width: 0; }', '.prg { min-width: 0; height: 800px; }')
M('M5e UserProgress vuelve a cg-page', UP, '<div className="prg prg-main">', '<div className="cg-page prg prg-main">')
M('M5f UserProgress con style en línea de alto', UP, '<div className="prg prg-main">', '<div className="prg prg-main" style={{ minHeight: "100dvh" }}>')
restore(); console.log('clon restaurado')
