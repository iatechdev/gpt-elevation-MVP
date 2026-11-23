// Mutaciones de #388 sobre la copia tools/qa5/mut (solo local). Uso: node qa5-mut388.cjs K1..K7
const fs = require('fs'); const F = (process.env.QA_TOOLS || '.') + '/qa5/mut/backend/routes/landingContent.js'
const CHECK = "if (!publishableKeys.has(key))"
const muts = {
  K1: s => s.replace(CHECK, "if (key.startsWith('landing.') && !approvedKeys.has(key))"),                         // el comportamiento anterior
  K2: s => s.replace("new Set([...approvedKeys, ...Object.keys(LANDING_DEFAULTS.es)])", "new Set([...approvedKeys])"),  // sin las 5 clásicas
  K3: s => s.replace(CHECK, "if (key.startsWith('landing.') ? !approvedKeys.has(key) : key.length > 255)"),             // prefijo en vez de lista
  K4: s => s.replace("error: lang === 'en' ? 'Unknown landing key.' : 'Clave landing desconocida.' });\n    if (key.length", "error: 'Clave landing desconocida.' });\n    if (key.length"), // sin la versión EN
  K5: s => s.replace("return res.status(400).json({ code: 'unknown_key', ", "return res.status(400).json({ "),
  K6: s => s.replace(CHECK, "if (!publishableKeys.has(key.trim()))"),                                                   // tolera espacios
  K7: s => s.replace(CHECK, "if (false)").replace("const expected = parseExpected(req.body.expectedUpdatedAt);", "const expected = parseExpected(req.body.expectedUpdatedAt);\n    res.on('finish', () => {});"),   // sin validación de clave
}
const f = muts[process.argv[2]]; const a = fs.readFileSync(F, 'utf8'); const b = f(a); if (a === b) { console.log(process.argv[2], 'NO APLICA'); process.exit(3) } fs.writeFileSync(F, b)
