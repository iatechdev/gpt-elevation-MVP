const fs = require('fs');
const [file, from, to] = process.argv.slice(2);
const s = fs.readFileSync(file, 'utf8');
if (s.split(from).length !== 2) { console.error('no unico/no encontrado: ' + from.slice(0, 60)); process.exit(3); }
fs.writeFileSync(file, s.replace(from, () => to));
console.log('M aplicada');
