const fs = require('fs'); const F = 'C:/Users/Usuario/Documents/qa-pr-221/backend/utils/skillMap.js'; const m = process.argv[2];
const edit = (a, b) => { const s = fs.readFileSync(F, 'utf8'); if (s.split(a).length !== 2) throw new Error('no único/no encontrado ' + m + ': ' + a.slice(0, 60)); fs.writeFileSync(F, s.replace(a, () => b)); };
if (m === 'M1') { edit('return serialize(userId, async () => { for (let attempt = 1; ; attempt++) {', 'return (async () => { for (let attempt = 1; ; attempt++) {'); edit('  } });\n}\n\n// El mapa', '  } })();\n}\n\n// El mapa'); }
if (m === 'M2') { edit('const previous = ownerQueues.get(userId) || Promise.resolve();', "const previous = ownerQueues.get('g') || Promise.resolve();"); edit('ownerQueues.set(userId, tail);', "ownerQueues.set('g', tail);"); edit('if (ownerQueues.get(userId) === tail) ownerQueues.delete(userId);', "if (ownerQueues.get('g') === tail) ownerQueues.delete('g');"); }
if (m === 'M3') edit('return serialize(userId, async () => {', 'return serialize(input.skillKey, async () => {');
if (m === 'M4') edit('  tail.then(() => { if (ownerQueues.get(userId) === tail) ownerQueues.delete(userId); });\n', '');
if (m === 'M5') edit("if (error && error.name === 'SequelizeUniqueConstraintError') throw new SkillMapError(409, 'conflict'", "if (false) throw new SkillMapError(409, 'conflict'");
if (m === 'M6') edit('  return run;\n}\n\nasync function ownTransaction', '  return tail;\n}\n\nasync function ownTransaction');
console.log('M apl ' + m);
