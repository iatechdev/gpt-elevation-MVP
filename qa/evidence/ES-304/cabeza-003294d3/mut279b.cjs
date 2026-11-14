// [QA-Claude] Mutaciones ES-304 (PR #279 cabeza 003294d3, detector optimizado). Árbol: C:/Users/Usuario/Documents/qa-pr-253
const fs = require('fs'); const p = 'C:/Users/Usuario/Documents/qa-pr-253/backend/utils/safety.js'; const m = process.argv[2];
const edit = (a, b) => { const s = fs.readFileSync(p, 'utf8'); if (s.split(a).length !== 2) throw new Error('no único/no encontrado ' + m + ': ' + a.slice(0, 80)); fs.writeFileSync(p, s.replace(a, () => b)); };
const FL = (c) => ['[\\u3164\\u2800\\u115F\\u1160\\uFFA0\\u180E\\u061C\\u034F]', '[' + '\\u3164\\u2800\\u115F\\u1160\\uFFA0\\u180E\\u061C\\u034F'.replace(c, '') + ']'];
const M = {
  // ── pasos de normalización (líneas sin cambios del código) ──
  Z1: () => edit(".replace(FILLERS, filler).replace(FORMAT_AND_MARKS, '')", ".replace(FORMAT_AND_MARKS, '')"),
  Z2: () => edit(".replace(FORMAT_AND_MARKS, '').replace(/[^", ".replace(/[^"),
  Z3: () => edit("String(text).normalize('NFKC').toLowerCase().replace(FILLERS", "String(text).toLowerCase().replace(FILLERS"),
  Z4: () => edit(".replace(/[^\\u0000-\\u007F\\u00A0-\\u024F]/g, (c) => HOMOGLYPHS[c] || c);", ";"),
  Z18: () => edit(FL('\\u2800')[0], FL('\\u2800')[1]), Z19: () => edit(FL('\\u115F')[0], FL('\\u115F')[1]), Z20: () => edit(FL('\\u1160')[0], FL('\\u1160')[1]),
  Z25: () => edit("/[\\u{E0020}-\\u{E007E}]/gu", "/[\\u{E0021}-\\u{E007E}]/gu"), Z26: () => edit("m[0].codePointAt(0) - 0xE0000", "m[0].codePointAt(0) - 0xE0001"),
  Z27: () => edit("[ ._\\-*,]){3,}[a-z\\u00e0-\\u00ff0-9@$](?![a-z0-9@$])/gi, (m) =>", "[ ._\\-*,]){7,}[a-z\\u00e0-\\u00ff0-9@$](?![a-z0-9@$])/gi, (m) =>"),
  Z28: () => edit("(!SPELLED_RUN.test(text) ? text :", "(true ? text :"),
  Z29: () => edit("'@': 'a', $: 's' }", "'@': 'a' }"), Z30: () => edit("5: 's', 7: 't'", "5: 's'"), Z42: () => edit("const unleet = (text) => text.replace(/[43105@$7]/g, (c) => LEET[c] || c);", "const unleet = (text) => text.replace(/[4310@$7]/g, (c) => LEET[c] || c);"),
  Z31: () => edit("'\\u043e': 'o', ", ""), Z32: () => edit("'\\u0456': 'i', ", ""), Z33: () => edit("'\\u03bf': 'o', ", ""), Z34: () => edit("'\\u0435': 'e', ", ""),
  Z35: () => edit(".replace(/(.)\\1{2,}/g, '$1')", ".replace(/(.)\\1{3,}/g, '$1')"), Z36: () => edit(".replace(/[^a-z\\u00e0-\\u00ff0-9']+/gi, ' ');", ".replace(/[^a-z\\u00e0-\\u00ff0-9']+/gi, '');"),
  Z37: () => edit("[\\p{Cf}\\p{Mn}\\p{Me}\\uE000-\\uF8FF]", "[\\p{Mn}\\p{Me}\\uE000-\\uF8FF]"), Z38: () => edit("[\\p{Cf}\\p{Mn}\\p{Me}\\uE000-\\uF8FF]", "[\\p{Cf}\\p{Me}\\uE000-\\uF8FF]"), Z39: () => edit("[\\p{Cf}\\p{Mn}\\p{Me}\\uE000-\\uF8FF]", "[\\p{Cf}\\p{Mn}\\p{Me}]"),
  Z40: () => edit("normalize('NFKC').toLowerCase().replace(FILLERS", "normalize('NFKC').replace(FILLERS"),
  Z14: () => edit("if (hit.level === 'high') return hit;", "return hit;"), Z41: () => edit("if (hit.level === 'medium' && best.level !== 'medium') best = hit;", "if (false) best = hit;"),
  Z43: () => edit("const halve = (text) => text.replace(/(.)\\1/g, '$1');", "const halve = (text) => text;"),
  // ── código NUEVO (generador perezoso, memoria, unión de reglas) ──
  N1: () => edit("const first = flat(raw); if (fresh(first)) yield first;", "const first = flat(raw);"), // sin la forma de siempre como forma propia
  N2: () => edit("const plain = PLAIN.test(raw);", "const plain = true;"), // todo es «llano»: se saltan los pasos de Unicode
  N3: () => edit("const plain = PLAIN.test(raw);", "const plain = false;"), // nada es llano (equivalente, más lento)
  N4: () => edit("const joined = joinSpelled(open); const spelled = joined === open ? base : flat(joined);", "const joined = open; const spelled = base;"), // sin letras separadas
  N5: () => edit("const split = spellWords(open); const words = split === open ? base : flat(split);", "const split = open; const words = base;"), // sin palabras separadas
  N6: () => edit("() => tidy(unleet(spelled)), ", ""), N7: () => edit("() => tidy(halve(spelled)), () => tidy(halve(words)), ", ""), N8: () => edit("() => tidy(squeeze(unleet(spelled))), ", ""),
  N9: () => edit("() => tidy(spaceOut(base)), () => tidy(spaceOut(spelled))]", "]"), N10: () => edit("if (!plain && FILLER_TEST.test(raw.normalize('NFKC'))) {", "if (false) {"),
  N11: () => edit("const decoded = plain ? '' : decodeTags(raw); if (decoded) {", "const decoded = ''; if (decoded) {"),
  N12: () => edit("if (!UNITED[level].test(normalized)) continue;", "if (false) continue;"), // equivalente
  N13: () => edit("rules.map((rule) => '(?:' + rule.re.source + ')').join('|')", "rules.map((rule) => '(?:' + rule.re.source + ')').slice(0, 5).join('|')"), // la unión pierde reglas
  N14: () => edit("raw.length > 64 ? createHash('sha256').update(raw).digest('hex') : raw", "raw.length > 64 ? raw.slice(0, 64) : raw"), // colisión de la clave de memoria
  N15: () => edit("if (cached) return { level: cached.level, lang: cached.lang };", "if (cached) return cached;"), // devuelve el objeto de la memoria
  N16: () => edit("if (memo.size >= MEMO_MAX) memo.delete(memo.keys().next().value);", ""), // memoria sin tope
  N17: () => edit("const tidy = (text) => text.replace(/\\s+/g, ' ');", "const tidy = (text) => text;"),
  N18: () => edit("const open = plain ? raw.toLowerCase() : unmask(raw);", "const open = plain ? raw : unmask(raw);"), // sin minúsculas en el camino llano
  N19: () => edit("if (seen.has(form)) return false; seen.add(form); return true;", "return true;"), // sin dedupe (equivalente)
  N20: () => edit("const key = raw.length > 64 ? createHash('sha256').update(raw).digest('hex') : raw;", "const key = 'k';"), // una sola clave: toda entrada devuelve el primer resultado
  N21: () => edit("const PLAIN = /^[\\x20-\\x7e\\n\\r\\t\\u00a1-\\u00ff]*$/;", "const PLAIN = /^[\\x20-\\x7e\\n\\r\\t\\u00c0-\\u00d6\\u00d8-\\u00f6\\u00f8-\\u00ff\\u00a1\\u00bf\\u00ab\\u00bb]*$/;"), // corrección sugerida para Latin-1 (no es mutante: control positivo del hallazgo)
};
if (!M[m]) throw new Error('mutación desconocida ' + m); M[m](); console.log('M apl ' + m);
