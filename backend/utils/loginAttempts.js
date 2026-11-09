// ES-220 (ES-155 tramo A): intentos fallidos de login para correos SIN cuenta activa (inexistentes o inactivos), con el mismo umbral y la misma duración
// que el bloqueo de una cuenta real. Así el bloqueo (423) no revela si el correo existe: un correo inexistente se bloquea igual que uno existente.
// Es memoria del proceso (Map acotado), no base de datos: no guarda nada personal (la clave es un hash del correo normalizado) y se pierde al reiniciar.
// Límite conocido: con varias réplicas cada una lleva su cuenta; el despliegue actual es de una sola.
const crypto = require('crypto');

const MAX_ATTEMPTS = 3;                 // mismo umbral que el bloqueo por cuenta (no se cambia en ES-220)
const LOCK_MS = 15 * 60 * 1000;         // misma duración
const MAX_ENTRIES = 10000;              // cota de memoria: se purgan primero las entradas vencidas y luego las más antiguas

const store = new Map();                // clave -> { attempts, lockedUntil (ms), touched (ms) }
const keyOf = (email) => crypto.createHash('sha256').update(String(email ?? '').trim().toLowerCase()).digest('hex');

function prune(now) {
  for (const [key, entry] of store) {
    if (entry.lockedUntil <= now && now - entry.touched > LOCK_MS) store.delete(key);
  }
  while (store.size >= MAX_ENTRIES) store.delete(store.keys().next().value); // Map conserva el orden de inserción
}

/** Fin del bloqueo vigente (Date) o null. */
function lockedUntil(email, now = Date.now()) {
  const entry = store.get(keyOf(email));
  return entry && entry.lockedUntil > now ? new Date(entry.lockedUntil) : null;
}

/** Cuenta un intento fallido; devuelve { locked, until } (until es un Date solo si quedó bloqueado). */
function recordFailure(email, now = Date.now()) {
  const key = keyOf(email);
  let entry = store.get(key);
  if (!entry) { prune(now); entry = { attempts: 0, lockedUntil: 0, touched: now }; store.set(key, entry); }
  if (entry.lockedUntil <= now && entry.attempts >= MAX_ATTEMPTS) entry.attempts = 0; // el bloqueo anterior ya venció
  entry.attempts += 1; entry.touched = now;
  if (entry.attempts >= MAX_ATTEMPTS) { entry.lockedUntil = now + LOCK_MS; return { locked: true, until: new Date(entry.lockedUntil) }; }
  return { locked: false, until: null };
}

const clear = (email) => { store.delete(keyOf(email)); };
const reset = () => { store.clear(); };

module.exports = { MAX_ATTEMPTS, LOCK_MS, MAX_ENTRIES, lockedUntil, recordFailure, clear, reset, size: () => store.size };
