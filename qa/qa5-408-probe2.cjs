// [QA-Claude-5] #408 cabeza nueva: más emoji compuestos reales y bordes de la barrera (stripInvisible).
const { stripInvisible } = require(process.env.BACK + '/utils/promptSafety.js'); const J = '\u200D'
const keep = ['🧑🏽' + J + '🍼', '🏃🏽' + J + '♀\uFE0F', '👩🏽' + J + '❤\uFE0F' + J + '👨🏿', '👨' + J + '👩' + J + '👧' + J + '👦', '🏊🏿' + J + '♂\uFE0F', '🧑🏿' + J + '🤝' + J + '🧑🏻', '👩🏼' + J + '🦳', '👁\uFE0F' + J + '🗨\uFE0F', '🐻' + J + '❄\uFE0F', '🧑' + J + '🧑' + J + '🧒', '🏳\uFE0F' + J + '⚧\uFE0F']
const strip = [['👩🏽' + J + ' hola', '👩🏽 hola'], ['x' + J + J + 'y', 'xy'], ['🙂' + J + J + '🙂', '🙂🙂'], ['1' + J + '2', '12'], [J + '🙂', '🙂']]
let bad = 0; for (const k of keep) { const o = stripInvisible(k); if (o !== k) { bad++; console.log('DIFIERE conserva', JSON.stringify(k), '→', JSON.stringify(o)) } }
for (const [i, e] of strip) { const o = stripInvisible(i); if (o !== e) { bad++; console.log('DIFIERE quita', JSON.stringify(i), '→', JSON.stringify(o)) } }
console.log(bad ? 'DIFIEREN ' + bad : 'TODO COMO SE ESPERA (' + keep.length + ' conservados, ' + strip.length + ' quitados)')
