// Mutaciones de #391 sobre tools/qa5/pr391/frontend/src/context/resume/resumeDiff.ts (solo local; se revierten con git checkout). Uso: node qa5-mut391.cjs D1..D10
const fs = require('fs'); const F = (process.env.QA_TOOLS || '.') + '/qa5/pr391/frontend/src/context/resume/resumeDiff.ts'
const muts = {
  D1: s => s.replace("return { add: [], link: [], remove: [] }", "return { add: diff.added.map(x => x.name), link: [], remove: [] }"),                  // nuevas marcadas por defecto
  D2: s => s.replace("return { add: [], link: [], remove: [] }", "return { add: [], link: [], remove: diff.gone.map(x => x.name) }"),                    // «quitar» por defecto
  D3: s => s.replace("const gone = mine.filter(skill => skill.resumeVersion !== null && ", "const gone = mine.filter(skill => "),                              // lo escrito a mano «desaparece»
  D4: s => s.replace("if (toRemove.has(key) && goneKeys.has(key)) continue", "if (toRemove.has(key)) continue"),                                          // quitar sin exigir «ya no aparece»
  D5: s => s.replace("if (item && toLink.has(key))", "if (toLink.has(key))").replace("support: item.suggested.support ?? skill.support", "support: item ? item.suggested.support ?? skill.support : skill.support"), // vincular fuera de «siguen»
  D6: s => s.replace("if (out.length >= MAX_DECLARED_SKILLS) { skipped += 1; continue }", ""),                                                              // sin tope de 40
  D7: s => s.replace(".normalize('NFD').replace(/[̀-ͯ]/g, '')", ""),                                                                                  // sin plegar acentos
  D8: s => s.replace("if (!key || seen.has(key)) continue; seen.add(key); out.push(skill) }", "if (!key) continue; out.push(skill) }"),                      // sin deduplicar lo sugerido/contexto
  D9: s => s.replace("out.push({ ...skill, resumeVersion: diff.version, support: item.suggested.support ?? skill.support })", "out.push({ ...skill, name: item.suggested.name, resumeVersion: diff.version, support: item.suggested.support ?? skill.support })"), // vincular cambia el nombre
  D10: s => s.replace("out.push({ ...skill })\n  }", "skill.resumeVersion = skill.resumeVersion; out.push(skill)\n  }"),                                                               // devuelve el MISMO objeto (alias): mutar la copia mutaría la entrada
  D11: s => s.replace("if (!toAdd.has(key) || seen.has(key)) continue", "if (!toAdd.has(key)) continue"),                                           // añadir duplicados
  D12: s => s.replace("room = Math.max(0, MAX_DECLARED_SKILLS - mine.length)", "room = MAX_DECLARED_SKILLS"),                                               // overflow mal calculado
  D13: s => s.replace("resumeVersion: diff.version, support: item.suggested.support ?? skill.support }); continue }", "support: item.suggested.support ?? skill.support }); continue }"), // vincular sin fijar la versión
}
const f = muts[process.argv[2]]; const a = fs.readFileSync(F, 'utf8'); const b = f(a); if (a === b) { console.log(process.argv[2], 'NO APLICA'); process.exit(3) } fs.writeFileSync(F, b)
