// [QA-Claude-3] PR #450 (cabeza d7be537d): batería de función para normalizeForRisk + mutantes propios. Uso: node qa/e450-mut-nfr.cjs <dir con backend/utils/safety.js> <backend/utils/promptSafety.js>
const path = require('path'); const fs = require('fs'); const [DIR, PS] = process.argv.slice(2); const S = require(path.resolve(DIR, 'backend/utils/safety.js')); const { normalizeText } = require(path.resolve(PS))
const Z = '\u200B', N = '\u0000', rk = t => ({ high: 2, medium: 1 })[S.detectRisk(t).level] || 0; let f = []; const t = (n, ok) => { if (!ok) f.push(n) }
const nfr = x => S.normalizeForRisk(x, normalizeText)
t('crisis ZWSP entre palabras → alto', rk(nfr(`quiero${Z}morir`)) === 2); t('crisis NUL entre palabras → alto', rk(nfr(`no${N}quiero${N}seguir${N}viviendo`)) === 2); t('EN ZWSP → alto', rk(nfr(`i${Z}want${Z}to${Z}die`)) === 2)
t('medio→alto elige espaciada', rk(nfr(`no aguanto más. me${Z}quiero${Z}matar`)) === 2 && nfr(`no aguanto más. me${Z}quiero${Z}matar`).includes('me quiero matar'))
t('empate alto/alto guarda la de siempre', nfr(`no${Z} quiero${Z} morir`) === normalizeText(`no${Z} quiero${Z} morir`)); t('empate medio/medio guarda la de siempre', nfr(`no aguanto${Z} más`) === normalizeText(`no aguanto${Z} más`))
t('sin invisibles idéntico', nfr('Hola, qué tal') === normalizeText('Hola, qué tal')); t('persa ZWNJ idéntico', nfr('می\u200Cخواهم') === normalizeText('می\u200Cخواهم')); t('emoji ZWJ idéntico', nfr('👩\u200D💻') === normalizeText('👩\u200D💻'))
t('benigna con ZWSP idéntica', nfr(`Voy al cine${Z}esta noche`) === normalizeText(`Voy al cine${Z}esta noche`)); t('sobre el tope usa la de siempre', nfr(`quiero${Z}morir`.repeat(1) + 'x'.repeat(200001)) === normalizeText(`quiero${Z}morir` + 'x'.repeat(200001)))
t('nunca baja el nivel', rk(nfr(`quiero morir${Z}`)) >= rk(normalizeText(`quiero morir${Z}`))); t('detectRisk idempotente sobre lo guardado', rk(nfr(nfr(`quiero${Z}morir`))) === 2)
console.log(f.length ? 'FALLAN: ' + f.join(' | ') : 'OK todas'); process.exit(f.length ? 1 : 0)
