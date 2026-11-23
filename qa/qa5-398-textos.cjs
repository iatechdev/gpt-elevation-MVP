// [QA-Claude-5] #398: todo texto visible nuevo debe estar en la lista aprobada (13 de ES-110 12753 + el del tope 12793). Compara las claves de t() usadas por la pantalla nueva con los catálogos de main.
// Uso: node qa/qa5-398-textos.cjs <raíz del worktree del PR> <raíz de main>
const fs = require('fs'); const path = require('path'); const [pr, main] = process.argv.slice(2)
const read = (r, f) => fs.readFileSync(path.join(r, 'frontend/src', f), 'utf8')
const keysOf = (src) => new Set([...src.matchAll(/(?:^|[\s,{])([A-Za-z_.]+(?:\.[A-Za-z_]+)*|'[A-Za-z_.]+'):/gm)].map((m) => m[1].replace(/'/g, '')))
const copyPR = read(pr, 'context/resume/resumeCopy.ts') + read(pr, 'evidence/copy.ts') + read(pr, 'context/participantContext.ts').slice(0, 0)
const copyMain = read(main, 'context/resume/resumeCopy.ts') + read(main, 'evidence/copy.ts')
const added = [...keysOf(copyPR)].filter((k) => !keysOf(copyMain).has(k))
const APPROVED = ['resume_update', 'resume_update_help', 'resume_changes_title', 'resume_new_skills', 'resume_still_skills', 'resume_gone_skills', 'resume_link_version', 'resume_keep', 'resume_quit', 'resume_confirmed_same', 'resume_no_change', 'rs_origin_deleted', 'rs_origin_deleted_text', 'resume_overflow', 'resume_overflow_one']
const extra = added.filter((k) => !APPROVED.includes(k)); const missing = APPROVED.filter((k) => !added.includes(k))
console.log('claves nuevas en los catálogos:', added.join(', ')); console.log(extra.length ? 'NO APROBADAS: ' + extra.join(', ') : 'OK: ninguna clave nueva fuera de la lista aprobada'); if (missing.length) console.log('FALTAN de la lista:', missing.join(', '))
// claves que usa la pantalla nueva: deben existir (en main o entre las aprobadas)
const page = read(pr, 'context/resume/ResumeUpdatePage.tsx'); const used = [...new Set([...page.matchAll(/\bt\('([A-Za-z_.]+)'\)|\bt\(([a-z]+) \? '([A-Za-z_.]+)' : '([A-Za-z_.]+)'\)|\b(?:count|t)\('([a-z_.]+)'/g)].flatMap((m) => m.slice(1).filter(Boolean)))]
const known = new Set([...keysOf(copyMain), ...APPROVED]); const ctxCopy = (() => { try { return read(main, 'context/participantContext.ts') + read(main, 'context/copy.ts') } catch { return '' } })()
const unknown = used.filter((k) => !known.has(k) && !ctxCopy.includes(k)); console.log('claves usadas por la pantalla:', used.length, '· sin catálogo en resume/evidence (pueden vivir en otros catálogos):', unknown.join(', ') || 'ninguna')
process.exit(extra.length || missing.length ? 1 : 0)
