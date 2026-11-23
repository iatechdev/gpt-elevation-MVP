// Mutaciones de #384 sobre tools/qa5/m384/backend/utils. Uso: node qa5-mut384.cjs P1..P9
const fs = require('fs'); const U = (process.env.QA_TOOLS || '.') + '/qa5/m384/backend/utils/'; const A = U + 'aiClient.js', S = U + 'promptSafety.js'
const muts = {
  P1: [S, s => s.replace("const TAGS = /[\\u{E0000}-\\u{E007F}]/gu;", "const TAGS = /[\\u{E0001}-\\u{E007F}]/gu;")],
  P2: [S, s => s.replace("const TAGS = /[\\u{E0000}-\\u{E007F}]/gu;", "const TAGS = /[\\u{E0000}-\\u{E007E}]/gu;")],
  P3: [S, s => s.replace("const TAGS = /[\\u{E0000}-\\u{E007F}]/gu;", "const TAGS = /[\\u{E0000}-\\u{E0070}]/gu;")],
  P4: [S, s => s.replace("const TAGS = /[\\u{E0000}-\\u{E007F}]/gu;", "const TAGS = /[\\u{E0000}-\\u{E007F}]/g;")],
  P5: [S, s => s.replace(".replace(INVISIBLE, '').replace(TAGS, '')", ".replace(TAGS, '')")],                                       // deja de quitar invisibles clásicos
  P6: [A, s => s.replace("const body = sanitizeBody(rawBody);", "const body = rawBody;")],                                           // sin barrera en la puerta
  P7: [A, s => s.replace("if (typeof out.system === 'string') out.system = stripInvisible(out.system);\n  else if (Array.isArray(out.system)) out.system = cleanContent(out.system);", "")], // system sin limpiar
  P8: [A, s => s.replace("if (Array.isArray(content)) return content.map((block) => (block && typeof block.text === 'string' ? { ...block, text: stripInvisible(block.text) } : block));", "")], // bloques de texto sin limpiar
  P9: [S, s => s.replace("const clean = stripInvisible(text);", "const clean = text;")],                                          // fenceUntrusted sin limpiar
  P10: [A, s => s.replace("const out = { ...body };", "const out = body;")],                                                         // muta el objeto del llamador
}
const [f, fn] = muts[process.argv[2]]; const a = fs.readFileSync(f, 'utf8').split('\r\n').join('\n'); const b = fn(a); if (a === b) { console.log(process.argv[2], 'NO APLICA'); process.exit(3) } fs.writeFileSync(f, b)
