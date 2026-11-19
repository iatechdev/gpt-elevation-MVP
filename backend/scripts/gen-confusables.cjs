// ES-312 · Genera backend/utils/confusables-table.js a partir de la fuente VERSIONADA backend/data/unicode/confusables.txt (Unicode Security Mechanisms, UTS #39).
// El servidor NUNCA descarga nada en ejecución: este script solo lee el archivo del repositorio. Para actualizar la fuente se descarga a mano
// (https://www.unicode.org/Public/security/latest/confusables.txt), se sustituye el archivo, se corre este script y se revisa el diff en un PR.
//
// UTS #39 no dice «esta letra parece la a», dice «estas letras comparten el mismo esqueleto» (el destino es un prototipo, a veces ni siquiera ASCII: «ᴍ» → «ʍ»).
// Por eso se trabaja por CLASES: todas las entradas con el mismo destino forman una clase. La letra de la clase sale de, en este orden:
//   (a) el propio destino, si es una letra a-z (o A-Z, que se pasa a minúscula porque el detector trabaja en minúsculas);
//   (b) si no, la letra a la que la tabla MANUAL (revisada a mano en ES-304: cirílico/griego de uso común) manda a algún miembro de la clase. Si dos miembros piden letras distintas, la clase se descarta.
// Las CIFRAS nunca entran: la letra de una clase solo puede salir de un destino a-z/A-Z o de la tabla manual (letras), así que una clase cuyo destino es una cifra no tiene letra y se descarta entera
// (1/l/I, 0/O quedan fuera, cond. 2 de Infra); la prueba es-312 lo comprueba con una fuente sintética.
// Cada miembro de la clase entra en la tabla SOLO si:
//   1. es un único carácter y una LETRA (\p{L}) de una de estas escrituras: latina (fuera de ASCII y Latin-1), griega, cirílica, armenia, cherokee o lisu — nada de símbolos, CJK, emojis ni cifras de otras escrituras;
//   2. no es ASCII ni de Latin-1 ni lleva acento (los acentos ya se pliegan con NFD): ñ, á, ü… NUNCA se reasignan;
//   3. ya está en minúsculas y es estable bajo NFKC + minúsculas (si no, NFKC/minúsculas ya lo cubren o la clave nunca se usaría);
//   4. no está ya en la tabla MANUAL (que se conserva tal cual y manda).
// Quedan fuera los mapeos de varias letras («rn» → m) y todo lo que no cumpla lo anterior; el generador cuenta cada motivo.
// Uso: node scripts/gen-confusables.cjs [--check]   (--check no escribe: falla si el archivo generado difiere de lo que saldría de la fuente)
const fs = require('node:fs'); const path = require('node:path'); const crypto = require('node:crypto');
const MANUAL = require('../utils/homoglyphs-manual.js');

const SOURCE = path.join(__dirname, '..', 'data', 'unicode', 'confusables.txt');
const OUT = path.join(__dirname, '..', 'utils', 'confusables-table.js');
const SCRIPTS = /^[\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}\p{Script=Armenian}\p{Script=Cherokee}\p{Script=Lisu}]$/u;

// Versalitas latinas (nombre Unicode «LATIN LETTER SMALL CAPITAL X»): UTS #39 solo lista algunas (ᴍ, ʙ, ʜ, ɪ…), no ɴ ni ᴇ. Se completan aquí, a mano y SOLO estas 24, porque cada una es la letra
// en forma de versalita sin ambigüedad (QA E304-3 las probó: ᴍ ɴ ᴇ). Siguen las reglas de la tabla: una letra a-z, sin ASCII ni acentuadas.
const SMALL_CAPITALS = { 'ᴀ': 'a', 'ʙ': 'b', 'ᴄ': 'c', 'ᴅ': 'd', 'ᴇ': 'e', 'ꜰ': 'f', 'ɢ': 'g', 'ʜ': 'h', 'ɪ': 'i', 'ᴊ': 'j', 'ᴋ': 'k', 'ʟ': 'l', 'ᴍ': 'm', 'ɴ': 'n', 'ᴏ': 'o', 'ᴘ': 'p', 'ʀ': 'r', 'ꜱ': 's', 'ᴛ': 't', 'ᴜ': 'u', 'ᴠ': 'v', 'ᴡ': 'w', 'ʏ': 'y', 'ᴢ': 'z' };

function parse(text) {
  const entries = [];
  for (const line of text.split('\n')) {
    const data = line.replace(/^﻿/, '').split('#')[0]; const parts = data.split(';').map((p) => p.trim());
    if (parts.length < 3 || !/^[0-9A-F]/i.test(parts[0])) continue;
    const from = parts[0].split(/\s+/).map((h) => parseInt(h, 16)); const to = parts[1].split(/\s+/).map((h) => parseInt(h, 16));
    entries.push({ from, to });
  }
  return entries;
}

function build(text) {
  const header = text.split('\n').slice(0, 12).join('\n');
  const version = (header.match(/# Version: ([\d.]+)/) || [])[1] || 'desconocida'; const date = (header.match(/# Date: ([^\n]+)/) || [])[1] || 'desconocida';
  const excluded = { multiChar: 0, classNoLetter: 0, classAmbiguous: 0, notLetterOrScript: 0, asciiOrLatin1: 0, accented: 0, unstable: 0, manual: 0 };
  const classes = new Map(); // destino (cadena) → miembros (caracteres)
  for (const { from, to } of parse(text)) {
    if (from.length !== 1 || to.length !== 1) { excluded.multiChar++; continue; }
    const key = String.fromCodePoint(to[0]); if (!classes.has(key)) classes.set(key, new Set());
    classes.get(key).add(String.fromCodePoint(from[0]));
  }
  const table = {}; const ambiguous = [];
  for (const [target, members] of classes) {
    // el destino es también un miembro de su clase (p. ej. «ʍ», «ĸ»)
    const all = new Set([target, ...members]);
    let letter = /^[a-zA-Z]$/.test(target) ? target.toLowerCase() : null;
    if (letter === null) {
      const wanted = new Set([...all].filter((c) => MANUAL[c]).map((c) => MANUAL[c]));
      if (wanted.size === 0) { excluded.classNoLetter += members.size; continue; }
      if (wanted.size > 1) { excluded.classAmbiguous += members.size; ambiguous.push([target, [...wanted]]); continue; }
      letter = [...wanted][0];
    }
    for (const source of all) {
      const cp = source.codePointAt(0);
      if (cp <= 0xFF) { excluded.asciiOrLatin1++; continue; }
      if (!/^\p{L}$/u.test(source) || !SCRIPTS.test(source)) { excluded.notLetterOrScript++; continue; }
      if (source.normalize('NFD') !== source) { excluded.accented++; continue; }
      if (source.normalize('NFKC').toLowerCase() !== source) { excluded.unstable++; continue; }
      if (MANUAL[source]) { excluded.manual++; continue; }
      if (table[source] !== undefined && table[source] !== letter) throw new Error('destino ambiguo para U+' + cp.toString(16));
      table[source] = letter;
    }
  }
  for (const [source, letter] of Object.entries(SMALL_CAPITALS)) {
    if (MANUAL[source]) continue;
    if (table[source] !== undefined && table[source] !== letter) throw new Error('versalita en conflicto con UTS #39: U+' + source.codePointAt(0).toString(16));
    table[source] = letter;
  }
  return { table, version, date, excluded, ambiguous };
}

function render(result, sha) {
  const keys = Object.keys(result.table).sort((a, b) => a.codePointAt(0) - b.codePointAt(0));
  const body = keys.map((k) => `  '\\u{${k.codePointAt(0).toString(16)}}': '${result.table[k]}',`).join('\n');
  return `// GENERADO por backend/scripts/gen-confusables.cjs — NO editar a mano (la prueba es-312 regenera la tabla y la compara byte a byte).
// Fuente: backend/data/unicode/confusables.txt (Unicode Security Mechanisms UTS #39, versión ${result.version}, fecha ${result.date}), sha256 ${sha}.
// ${keys.length} entradas: una letra de latín extendido/IPA/versalitas, griego, cirílico, armenio, cherokee o lisu (sin ASCII, Latin-1 ni acentuadas) → UNA letra a-z. Se SUMAN a la tabla manual de homoglifos.
// Es una AYUDA para el detector de crisis, no una protección completa: lo que no está aquí (CJK, símbolos, emojis, cifras, mapeos de varias letras, otros alfabetos) NO se cubre.
module.exports = Object.freeze({
${body}
});
`;
}

if (require.main === module) {
  const buffer = fs.readFileSync(SOURCE); const sha = crypto.createHash('sha256').update(buffer).digest('hex');
  const result = build(buffer.toString('utf8')); const out = render(result, sha);
  if (process.argv.includes('--check')) {
    if (fs.readFileSync(OUT, 'utf8') !== out) { console.error('confusables-table.js NO coincide con lo que genera la fuente: regenera con `node scripts/gen-confusables.cjs`'); process.exit(1); }
    console.log('confusables-table.js coincide con la fuente (' + Object.keys(result.table).length + ' entradas)');
  } else {
    fs.writeFileSync(OUT, out); console.log(`escrito ${path.relative(process.cwd(), OUT)}: ${Object.keys(result.table).length} entradas (UTS #39 ${result.version}); excluidos:`, JSON.stringify(result.excluded), 'clases ambiguas:', JSON.stringify(result.ambiguous));
  }
}
module.exports = { SMALL_CAPITALS, build, render, parse, SOURCE, OUT, SCRIPTS };
