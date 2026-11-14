// [QA-Claude] Mutaciones ES-304 (PR #279). Árbol: C:/Users/Usuario/Documents/qa-pr-253
const fs = require('fs'); const p = 'C:/Users/Usuario/Documents/qa-pr-253/backend/utils/safety.js'; const m = process.argv[2];
const edit = (a, b) => { const s = fs.readFileSync(p, 'utf8'); if (s.split(a).length !== 2) throw new Error('no único/no encontrado ' + m + ': ' + a.slice(0, 80)); fs.writeFileSync(p, s.replace(a, () => b)); };
const FL = (c) => ['[\\u3164\\u2800\\u115F\\u1160\\uFFA0\\u180E\\u061C\\u034F]', '[' + '\\u3164\\u2800\\u115F\\u1160\\uFFA0\\u180E\\u061C\\u034F'.replace(c, '') + ']'];
const M = {
  Z1: () => edit(".replace(FILLERS, filler).replace(FORMAT_AND_MARKS, '')", ".replace(FORMAT_AND_MARKS, '')"), // sin quitar rellenos
  Z2: () => edit(".replace(FORMAT_AND_MARKS, '').replace(/[^", ".replace(/[^"), // sin quitar marcas/formato
  Z3: () => edit("String(text).normalize('NFKC').toLowerCase().replace(FILLERS", "String(text).toLowerCase().replace(FILLERS"), // sin NFKC
  Z4: () => edit(".replace(/[^\\u0000-\\u007F\\u00A0-\\u024F]/g, (c) => HOMOGLYPHS[c] || c);", ";"), // sin homoglifos
  Z5: () => edit("if (decoded) forms.push(flat(unmask(decoded)));", ""), // sin decodificar etiquetas
  Z6: () => edit("flat(base), flat(spelled), flat(words)", "flat(base), flat(words)"), // sin letras separadas (palabra)
  Z7: () => edit("flat(spelled), flat(words), ", "flat(spelled), "), // sin letras separadas con palabras
  Z8: () => edit("flat(unleet(spelled)), ", ""), // sin leet
  Z9: () => edit("flat(halve(spelled)), flat(halve(words)), ", ""), // sin duplicadas
  Z10: () => edit("flat(squeeze(unleet(spelled))), ", ""), // sin alargadas
  Z11: () => edit("flat(spaceOut(base)), flat(spaceOut(spelled))];", "];"), // sin signos entre palabras
  Z12: () => edit("if (FILLER_TEST.test(raw.normalize('NFKC'))) {", "if (false) {"), // sin relleno-como-espacio
  Z13: () => edit("const forms = [flat(raw), flat(base)", "const forms = [flat(base)"), // sin la forma de siempre
  Z14: () => edit("if (hit.level === 'high') return hit;", "return hit;"), // el primero gana (medio antes que alto)
  Z15: () => edit("return [...new Set(forms)];", "return forms;"), // sin dedupe (equivalente)
  Z16: () => edit("new RegExp(FILLERS.source)", "FILLERS"), // bandera /g con estado
  Z17: () => edit(FL('\\u3164')[0], FL('\\u3164')[1]), Z18: () => edit(FL('\\u2800')[0], FL('\\u2800')[1]), Z19: () => edit(FL('\\u115F')[0], FL('\\u115F')[1]), Z20: () => edit(FL('\\u1160')[0], FL('\\u1160')[1]),
  Z21: () => edit(FL('\\uFFA0')[0], FL('\\uFFA0')[1]), Z22: () => edit(FL('\\u034F')[0], FL('\\u034F')[1]), Z23: () => edit(FL('\\u180E')[0], FL('\\u180E')[1]), Z24: () => edit(FL('\\u061C')[0], FL('\\u061C')[1]),
  Z25: () => edit("/[\\u{E0020}-\\u{E007E}]/gu", "/[\\u{E0021}-\\u{E007E}]/gu"), // etiquetas sin el espacio
  Z26: () => edit("m[0].codePointAt(0) - 0xE0000", "m[0].codePointAt(0) - 0xE0001"), // decodificación desfasada
  Z27: () => edit("[ ._\\-*,]){3,}[a-z\\u00e0-\\u00ff0-9@$](?![a-z0-9@$])/gi, (m) =>", "[ ._\\-*,]){7,}[a-z\\u00e0-\\u00ff0-9@$](?![a-z0-9@$])/gi, (m) =>"), // exige 8+ letras
  Z28: () => edit("(!SPELLED_RUN.test(text) ? text :", "(true ? text :"), // sin separar palabras
  Z29: () => edit("'@': 'a', $: 's' }", "'@': 'a' }"), // leet sin $
  Z30: () => edit("5: 's', 7: 't'", "5: 's'"), // leet sin 7
  Z31: () => edit("'\\u043e': 'o', ", ""), // cirílica о
  Z32: () => edit("'\\u0456': 'i', ", ""), // cirílica і
  Z33: () => edit("'\\u03bf': 'o', ", ""), // griega ο
  Z34: () => edit("'\\u0435': 'e', ", ""), // cirílica е
  Z35: () => edit(".replace(/(.)\\1{2,}/g, '$1')", ".replace(/(.)\\1{3,}/g, '$1')"), // alargadas de 4+
  Z36: () => edit(".replace(/[^a-z\\u00e0-\\u00ff0-9']+/gi, ' ');", ".replace(/[^a-z\\u00e0-\\u00ff0-9']+/gi, '');"), // signos unidos sin espacio
  Z37: () => edit("[\\p{Cf}\\p{Mn}\\p{Me}\\uE000-\\uF8FF]", "[\\p{Mn}\\p{Me}\\uE000-\\uF8FF]"), // sin \p{Cf}
  Z38: () => edit("[\\p{Cf}\\p{Mn}\\p{Me}\\uE000-\\uF8FF]", "[\\p{Cf}\\p{Me}\\uE000-\\uF8FF]"), // sin \p{Mn}
  Z39: () => edit("[\\p{Cf}\\p{Mn}\\p{Me}\\uE000-\\uF8FF]", "[\\p{Cf}\\p{Mn}\\p{Me}]"), // sin uso privado
  Z40: () => edit("normalize('NFKC').toLowerCase().replace(FILLERS", "normalize('NFKC').replace(FILLERS"), // sin minúsculas antes de plegar
  Z41: () => edit("if (hit.level === 'medium' && best.level !== 'medium') best = hit;", "if (false) best = hit;"), // medio solo por la forma de siempre
  Z42: () => edit("const unleet = (text) => text.replace(/[43105@$7]/g, (c) => LEET[c] || c);", "const unleet = (text) => text.replace(/[4310@$7]/g, (c) => LEET[c] || c);"), // leet sin 5
  Z43: () => edit("const halve = (text) => text.replace(/(.)\\1/g, '$1');", "const halve = (text) => text;"), // halve vacío
  Z44: () => edit("flat(spaced), flat(joinSpelled(spaced)), flat(spaceOut(spaced))", "flat(spaced)"), // relleno-espacio sin combinaciones
  Z45: () => edit("(?<![a-z0-9@$])(?:[a-z\\u00e0-\\u00ff0-9@$][ ._\\-*,]){3,}[a-z\\u00e0-\\u00ff0-9@$](?![a-z0-9@$])/gi", "(?<![a-z0-9@$])(?:[a-z\\u00e0-\\u00ff0-9@$][ ._\\-*,]){3,}[a-z\\u00e0-\\u00ff0-9@$](?![a-z0-9@$])/g"), // sin /i (las mayúsculas ya son minúsculas: equivalente)
  Z46: () => edit("const SPELLED_RUN = /(?<![a-z0-9@$])(?:[a-z\\u00e0-\\u00ff0-9@$'][ ._\\-*,]){3,}", "const SPELLED_RUN = /(?<![a-z0-9@$])(?:[a-z\\u00e0-\\u00ff0-9@$'][ ._\\-*,]){4,}"), // spellWords exige 5+
  Z47: () => edit("word.trim().length > 1 && SPELLED_WORD.test(word.trim())", "SPELLED_WORD.test(word.trim())"), // palabras de 1 letra también se unen
  Z48: () => edit(".split(/\\s{2,}|[._\\-*,] [._\\-*,]/)", ".split(/\\s{2,}/)"), // sin «. .» entre palabras
};
if (!M[m]) throw new Error('mutación desconocida ' + m); M[m](); console.log('M apl ' + m);
