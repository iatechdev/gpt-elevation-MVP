// M5: aceptar cualquier cadena de hasta 40 caracteres que Date sepa leer (quita la comprobación del formato exacto)
const fs = require('fs'); const F = 'C:/Users/Usuario/Documents/qa-pr-221/backend/routes/landingContent.js';
const s = fs.readFileSync(F, 'utf8');
const re = /(raw\.length > 40) \|\| !\/\^[^\n]*?\/\.test\(raw\)\)/;
if (!re.test(s)) throw new Error('M5 no encontrada');
fs.writeFileSync(F, s.replace(re, '$1)'));
console.log('M apl M5');
