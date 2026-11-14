// [QA-Claude] Mutaciones ES-304 (PR #279 cabeza 68e8f1fb): las que dependen del código que cambió (PLAIN y la clave de la memoria) más controles. Árbol: C:/Users/Usuario/Documents/qa-pr-253
const fs = require('fs'); const p = 'C:/Users/Usuario/Documents/qa-pr-253/backend/utils/safety.js'; const m = process.argv[2];
const edit = (a, b) => { const s = fs.readFileSync(p, 'utf8'); if (s.split(a).length !== 2) throw new Error('no único/no encontrado ' + m + ': ' + a.slice(0, 80)); fs.writeFileSync(p, s.replace(a, () => b)); };
const NEWPLAIN = 'const PLAIN = /^[\\x20-\\x7e\\n\\r\\t\\u00c0-\\u00d6\\u00d8-\\u00f6\\u00f8-\\u00ff\\u00a1\\u00bf\\u00ab\\u00bb]*$/;';
const OLDPLAIN = 'const PLAIN = /^[\\x20-\\x7e\\n\\r\\t\\u00a1-\\u00ff]*$/;';
const KEY = "const key = createHash('sha256').update(raw).digest('hex');";
const M = {
  N2: () => edit('const plain = PLAIN.test(raw);', 'const plain = true;'), // todo llano
  N3: () => edit('const plain = PLAIN.test(raw);', 'const plain = false;'), // nada llano (equivalente, más lento)
  N14: () => edit(KEY, "const key = createHash('sha256').update(raw.slice(0, 64)).digest('hex');"), // la huella usa solo 64 caracteres
  N20: () => edit(KEY, "const key = 'k';"), // una sola clave
  N21: () => edit(NEWPLAIN, OLDPLAIN), // el PLAIN antiguo (reintroduce E304-8)
  N22: () => edit(KEY, 'const key = raw;'), // la clave es el texto
  N23: () => edit('\\u00a1\\u00bf\\u00ab\\u00bb]*$/;', '\\u00a1\\u00bf\\u00ab\\u00bb\\u00aa\\u00ba]*$/;'), // PLAIN con ª y º
  N24: () => edit('\\u00a1\\u00bf\\u00ab\\u00bb]*$/;', '\\u00a1\\u00bf\\u00ab\\u00bb\\u00a8\\u00af\\u00b4\\u00b8\\u00b9]*$/;'), // PLAIN con ¨ ¯ ´ ¸ ¹
  N25: () => edit(KEY, "const key = createHash('sha256').update(raw).digest('hex').slice(0, 8);"), // huella de 8 caracteres
  N26: () => edit('const cached = memo.get(key); if (cached) return { level: cached.level, lang: cached.lang };', 'const cached = memo.get(key); if (cached) return cached;'), // devuelve el objeto de la memoria
  N27: () => edit('if (memo.size >= MEMO_MAX) memo.delete(memo.keys().next().value);', ''), // sin tope
  Z3: () => edit("String(text).normalize('NFKC').toLowerCase().replace(FILLERS", "String(text).toLowerCase().replace(FILLERS"),
  Z19: () => edit('[\\u3164\\u2800\\u115F\\u1160\\uFFA0\\u180E\\u061C\\u034F]', '[\\u3164\\u2800\\u1160\\uFFA0\\u180E\\u061C\\u034F]'),
  Z40: () => edit("normalize('NFKC').toLowerCase().replace(FILLERS", "normalize('NFKC').replace(FILLERS"),
};
if (!M[m]) throw new Error('mutación desconocida ' + m); M[m](); console.log('M apl ' + m);
