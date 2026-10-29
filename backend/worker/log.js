// backend/worker/log.js
// Registro del worker (ES-87): una línea JSON por evento, SOLO con campos de una lista cerrada y valores escalares cortos.
// Nunca texto de personas, prompts, respuestas, claves ni identificadores de personas: aunque alguien pase un campo de más, no sale.
const ALLOWED = new Set(['jobId', 'fence', 'attempt', 'status', 'reason', 'code', 'errorCode', 'retryable', 'candidates', 'discarded', 'ms', 'waitMs',
  'pollMs', 'leaseSeconds', 'maxAttempts', 'owner', 'signal', 'pending']);

function createLogger(write = (line) => process.stdout.write(`${line}\n`), now = () => new Date()) {
  return (event, fields = {}) => {
    const entry = { t: now().toISOString(), event: String(event).slice(0, 40) };
    for (const [key, value] of Object.entries(fields)) {
      if (!ALLOWED.has(key)) continue;
      if (typeof value === 'number' || typeof value === 'boolean') entry[key] = value;
      else if (typeof value === 'string') entry[key] = value.slice(0, 64).replace(/[^A-Za-z0-9_.:-]/g, '_');
    }
    write(JSON.stringify(entry));
  };
}

// Código seguro de un error: nunca su mensaje (podría llevar texto del proveedor, SQL con datos o rutas).
const codeOf = (error) => {
  const code = (error && (error.code || (error.parent && error.parent.code) || error.errorCode || error.name)) || 'unknown';
  return String(code).slice(0, 40);
};

module.exports = { createLogger, codeOf };
