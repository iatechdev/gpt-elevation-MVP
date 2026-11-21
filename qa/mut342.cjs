// QA-Claude-2 — PR #337 (ES-342 A) mutaciones sobre el clon: node qa/mut342.cjs <clon>/frontend. Primero es-342; si sobrevive, la suite completa.
const fs = require('fs'), path = require('path'), { execSync } = require('child_process'); const FE = process.argv[2]; const P = f => path.join(FE, f)
const sh = cmd => { try { execSync(cmd, { cwd: FE, stdio: 'pipe', timeout: 600000, shell: true, maxBuffer: 1e8 }); return false } catch (e) { return true } }
const files = ['src/space/ChatBar.tsx', 'src/space/space.css']; const orig = Object.fromEntries(files.map(f => [f, fs.readFileSync(P(f), 'utf8')])); const restore = () => files.forEach(f => fs.writeFileSync(P(f), orig[f]))
const M = (name, file, a, b) => { restore(); const s = fs.readFileSync(P(file), 'utf8'); if (!s.includes(a)) { console.log(`M ${name}: SIN ANCLA «${a.slice(0, 50)}»`); return } fs.writeFileSync(P(file), s.replace(a, () => b)); let r = sh('node --test test/es-342-chat-defectos.test.mjs 2>&1'); let how = 'por es-342'; if (!r) { r = sh('node --test test/*.test.mjs 2>&1'); how = 'por la suite completa' } console.log(`M ${name}: ${r ? 'DETECTADO ' + how : 'SOBREVIVE a las pruebas'}`); restore() }
const CSS = 'src/space/space.css', TSX = 'src/space/ChatBar.tsx'
M('a se quita overflow-wrap: anywhere de los globos', CSS, '.chat-msg-body, .chat-msg-text, .chat-msg-wait { overflow-wrap: anywhere; min-width: 0; }', '.chat-msg-body, .chat-msg-text, .chat-msg-wait { min-width: 0; }')
M('b se quita el scrollIntoView del aviso de pausa', TSX, 'if (paused) pausedNote.current?.scrollIntoView({ block: \'nearest\' })', 'if (paused) void pausedNote.current')
M('c se quita el scrollIntoView del aviso de límite', TSX, 'if (exhausted) exhaustedNote.current?.scrollIntoView({ block: \'nearest\' })', 'if (exhausted) void exhaustedNote.current')
M('d «Enviar» deshabilitado vuelve a la opacidad', CSS, 'disabled { opacity: 1;', 'disabled { opacity: 0.6;')
M('e «Enviar» deshabilitado vuelve al terracota fijo', CSS, 'background: var(--cg-panel); color: var(--cg-muted); border-color: var(--cg-muted); }', 'background: #8f5a33; color: #e7ece8; border-color: #8f5a33; }')
M('f A4 se aplica también a 601–900 px de ancho', CSS, '@media (min-width: 901px) and (max-height: 800px)', '@media (min-width: 601px) and (max-height: 800px)')
M('g A4 se aplica también a alturas de 900 px', CSS, '@media (min-width: 901px) and (max-height: 800px)', '@media (min-width: 901px) and (max-height: 950px)')
M('h se quita el min-width: 0 del globo (.chat-msg)', CSS, '.chat-msg { min-width: 0; }', '')
M('i se quita el margen de respiro del aviso', CSS, '.chat-transcript .space-callout { scroll-margin-block-end: 12px; }', '')
restore(); console.log('clon restaurado')
