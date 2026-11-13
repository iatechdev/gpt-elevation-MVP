// [QA-Claude] aplica UNA mutación exacta (falla si el texto original no existe, para no dar por «detectada» una mutación que no se aplicó)
const fs = require('fs');
const [file, oldText, newText] = process.argv.slice(2);
const src = fs.readFileSync(file, 'utf8');
const count = src.split(oldText).length - 1;
if (count !== 1) { console.error(`MUTACION NO APLICADA (${count} coincidencias) en ${file}`); process.exit(2); }
fs.writeFileSync(file, src.replace(oldText, () => newText));
console.log('aplicada en ' + file);
