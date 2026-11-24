const { stripInvisible } = require((process.env.QA_TOOLS || '.') + '/qa5/pr402/backend/utils/promptSafety.js'); const { nameProblem } = require((process.env.QA_TOOLS || '.') + '/qa5/pr402/backend/utils/invisibleText.js')
const J='\u200D', N='\u200C'
const keep = { 'tono de piel + ZWJ': '👩🏽'+J+'💻', 'pareja con tono': '🧑🏿'+J+'🤝'+J+'🧑🏻', 'corazón en llamas': '❤\uFE0F'+J+'🔥', 'ojo en burbuja': '👁\uFE0F'+J+'🗨\uFE0F', 'bandera arcoíris': '🏳\uFE0F'+J+'🌈', 'bandera pirata': '🏴'+J+'☠\uFE0F', 'gato negro': '🐈'+J+'⬛', 'persona con bastón': '🧑'+J+'🦯', 'hombre barba pelirroja': '👨🏻'+J+'🦰', 'persa': 'می'+N+'خواهم', 'persa 2': 'نمی'+N+'دانم', 'malayalam chillu': 'ക്'+J+'ഷ', 'sinhala': 'ශ්'+J+'රී', 'khmer': 'ក្'+N+'ន', 'árabe ZWJ': 'ب'+J+'ا', 'hindi': 'क्'+J+'ष', 'bengalí': 'র্'+J+'য', 'devanagari ZWNJ': 'क्'+N+'ष', 'kannada': 'ಕ್'+J+'ಷ' }
let bad = 0
for (const [k, v] of Object.entries(keep)) { const out = stripInvisible(v); const ok = out === v; if (!ok) bad++; console.log((ok ? 'OK    ' : 'DIFIERE ') + 'conserva ' + k + (ok ? '' : ' → ' + JSON.stringify(out) + ' (esperado ' + JSON.stringify(v) + ')')) }
const strip = { 'mensaje en bits (ZWNJ/ZWJ alternos)': ['a'+N+J+N+'b', 'ab'], 'tres': ['x'+J+J+J+'y','xy'], 'junto a dígito': ['1'+J+'2','12'], 'junto a emoji y espacio': ['🙂'+J+' ok','🙂 ok'], 'tras signo': ['¡'+J+'hola','¡hola'], 'letra-joiner-espacio': ['a'+N+' b','a b'] }
for (const [k, [i, e]] of Object.entries(strip)) { const out = stripInvisible(i); const ok = out === e; if (!ok) bad++; console.log((ok ? 'OK    ' : 'DIFIERE ') + 'quita ' + k + (ok ? '' : ' → ' + JSON.stringify(out))) }
// canal residual: un joiner entre letras se conserva (1 bit por hueco)
const enc = [...'hola mundo'].map((ch, i) => ch + (i % 2 ? J : '')).join('')
console.log('INFO  canal residual: joiners legítimos entre letras se conservan →', stripInvisible('a'+J+'b') === 'a'+J+'b', '| texto con 5 joiners entre letras sobrevive con', (stripInvisible(enc).match(/\u200D/g)||[]).length, 'de', (enc.match(/\u200D/g)||[]).length)
// nombres con CGJ/ALM legítimos
for (const [k, v] of Object.entries({ 'hebreo con CGJ': 'שָׁ\u034Fלוֹם', 'árabe con ALM': 'محمد\u061C', 'jemer vocal inherente': 'ខ្ម\u17B4រ' })) console.log('INFO  nombre «' + k + '» → ' + nameProblem(v))
console.log(bad ? 'DIFIEREN ' + bad : 'TODO COMO SE ESPERA'); 
