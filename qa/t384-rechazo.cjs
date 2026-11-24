// [QA-Claude-3] ES-383: tiempo real del rechazo que afirma es-384-barrera-seguimiento.test.cjs:130 (techo 1000 ms). Mide 12 veces sanitizeBody() sobre el cuerpo `deepShared` (2^40 caminos, tope de 100 000 nodos).
// Uso: BACKEND=<wt/backend> node qa/t384-rechazo.cjs   (para cargar la máquina: lanzar antes N procesos `node -e "const e=Date.now()+40000;while(Date.now()<e){}"`)
const { sanitizeBody, AiInputRejectedError } = require(require('path').join(process.env.BACKEND, 'utils/aiClient'))
let deep = { t: 'x' }; for (let i = 0; i < 40; i++) deep = { a: deep, b: deep }
const r = []; for (let i = 0; i < 12; i++) { const s = process.hrtime.bigint(); try { sanitizeBody({ m: [deep] }) } catch (e) { if (!(e instanceof AiInputRejectedError)) throw e } r.push(Math.round(Number(process.hrtime.bigint() - s) / 1e6)) }
console.log(JSON.stringify(r), 'mediana', r.slice().sort((a, b) => a - b)[6])
