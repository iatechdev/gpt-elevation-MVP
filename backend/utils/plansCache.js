// ES-130 · Microcaché en memoria de la lista pública de planes (GET /api/plans).
// Solo guarda la respuesta del servidor durante unos segundos; la respuesta HTTP sigue siendo no-store,
// así que ningún navegador ni intermediario la conserva. Se invalida al escribir un plan (hooks de PricingPlan),
// de modo que un cambio de precio es visible de inmediato en la misma instancia. Con varias instancias,
// las demás pueden mostrar el valor anterior hasta TTL (10 s por defecto; PLANS_CACHE_TTL_MS=0 lo desactiva).
// En NODE_ENV=test el caché está desactivado salvo que se fije PLANS_CACHE_TTL_MS.
const DEFAULT_TTL_MS = 10_000;
let entry = null;   // { value, expires }
let inflight = null;
let generation = 0;

function ttlMs() {
  const raw = process.env.PLANS_CACHE_TTL_MS;
  if (raw !== undefined && raw !== '') {
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? Math.min(n, 60_000) : DEFAULT_TTL_MS;
  }
  return process.env.NODE_ENV === 'test' ? 0 : DEFAULT_TTL_MS;
}

function invalidate() {
  entry = null;
  generation += 1;   // una lectura en curso no debe repoblar el caché con datos previos a la escritura
}

// load() devuelve el valor fresco; las lecturas simultáneas comparten una sola consulta.
async function getCachedPlans(load) {
  const ttl = ttlMs();
  if (ttl === 0) return load();
  const now = Date.now();
  if (entry && entry.expires > now) return entry.value;
  if (inflight) return inflight;
  const started = generation;
  inflight = (async () => {
    try {
      const value = await load();
      if (started === generation) entry = { value, expires: Date.now() + ttl };
      return value;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

module.exports = { getCachedPlans, invalidate };
