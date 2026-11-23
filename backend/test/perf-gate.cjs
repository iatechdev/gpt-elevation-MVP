// ES-383: separa CORRECCIÓN de RENDIMIENTO en las pruebas.
//  · Las pruebas de corrección (npm test y los scripts :pg) NO tienen techo de reloj: un runner cargado no las pone en rojo.
//  · El rendimiento se afirma con perfAssert: en modo normal solo INFORMA («# PERF …»); con PERF_STRICT=1 (npm run test:perf) falla.
//  · El techo no es un número de milisegundos de una máquina: se expresa en milisegundos de una máquina de REFERENCIA y se escala por la velocidad que esta corrida mide ahora (línea base de la misma corrida).
const assert = require('node:assert/strict');

const STRICT = process.env.PERF_STRICT === '1';
const REFERENCE_BASELINE_MS = 14; // tiempo de la línea base en la máquina de referencia sin carga (mediana de 3 corridas al crear ES-383: 13,8–14,4 ms); si cambia baselineMs(), recalibrar con `node -e "console.log(require('./test/perf-gate.cjs').baselineMs())"`

// Carga de CPU fija y determinista (hashing numérico + cadenas + JSON): se mide justo antes de cada afirmación y se toma el MÍNIMO de varias repeticiones.
function baselineMs(reps = 5) {
  let best = Infinity;
  for (let r = 0; r < reps; r += 1) {
    const t0 = process.hrtime.bigint(); let acc = 0;
    for (let i = 0; i < 400000; i += 1) acc = (acc * 31 + Math.sqrt(i)) % 1000003;
    const text = JSON.stringify(Array.from({ length: 2000 }, (_, i) => ({ i, s: 'x'.repeat(i % 17) }))); acc += JSON.parse(text).length + text.split('x').length;
    const ms = Number(process.hrtime.bigint() - t0) / 1e6; if (ms < best) best = ms;
    if (acc === -1) throw new Error('inalcanzable'); // evita que el motor elimine el cálculo
  }
  return best;
}

// Mínimo de ms de `fn` en `reps` repeticiones (el mínimo filtra la carga puntual; la mediana no).
function bestOf(fn, reps = 3) {
  let best = Infinity;
  for (let i = 0; i < reps; i += 1) { const t0 = process.hrtime.bigint(); fn(); const ms = Number(process.hrtime.bigint() - t0) / 1e6; if (ms < best) best = ms; }
  return best;
}

// Techo escalado: referenceBudgetMs son los ms de la máquina de referencia; se multiplican por (línea base de ahora / línea base de referencia), nunca por menos de 1.
function scaledBudget(referenceBudgetMs) { return referenceBudgetMs * Math.max(1, baselineMs() / REFERENCE_BASELINE_MS); }

// Afirma rendimiento. Modo normal: solo informa. Modo estricto (test:perf): falla si `ms` supera el techo escalado.
function perfAssert(label, ms, referenceBudgetMs) {
  const budget = scaledBudget(referenceBudgetMs); const ok = ms <= budget;
  console.log(`# PERF ${ok ? 'OK ' : 'LENTO'} ${label}: ${ms.toFixed(1)} ms (techo escalado ${budget.toFixed(0)} ms = ${referenceBudgetMs} ms de referencia × velocidad de esta corrida)`);
  if (!ok && STRICT) assert.fail(`${label}: ${ms.toFixed(1)} ms > ${budget.toFixed(0)} ms`);
  return ok;
}

// Igual que perfAssert para una condición ya calculada con tiempos (p. ej. razón frío/caliente).
function perfCheck(label, condition, detail) {
  console.log(`# PERF ${condition ? 'OK ' : 'LENTO'} ${label}: ${detail}`);
  if (!condition && STRICT) assert.fail(`${label}: ${detail}`);
  return Boolean(condition);
}

module.exports = { STRICT, baselineMs, bestOf, scaledBudget, perfAssert, perfCheck, REFERENCE_BASELINE_MS };
