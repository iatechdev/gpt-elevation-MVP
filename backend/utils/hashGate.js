// ES-221 (E305-1): semáforo con cola ACOTADA para el hash de contraseñas del registro.
// El hash de contraseñas es JavaScript puro (sin código nativo): 30 hashes simultáneos (costo 10) ocupan el bucle de eventos y /api/health tardaba ~3 s (QA, R8). Con pocos hashes a la vez,
// el resto espera en una cola en memoria y el servidor sigue atendiendo lo demás. La cola tiene tope: pasado el tope se rechaza con 503 (`server_busy`) en vez de crecer sin límite.
// El hash sigue calculándose SIEMPRE y ANTES de consultar el correo (el tiempo de «ya registrado» y de «nuevo» sigue siendo el mismo, ES-221); el rechazo por cola llena
// ocurre antes de saber nada del correo, así que tampoco revela si existe. Alcance: un proceso (una réplica), igual que los demás contadores en memoria.
const DEFAULT_MAX = 2;
const DEFAULT_QUEUE = 20; // E305-6: fallar rápido (503) en vez de hacer esperar ~25 s a la persona en una tormenta

class ServerBusyError extends Error {
  constructor() { super('Servidor ocupado. Inténtalo de nuevo en un momento. / Server busy. Please try again in a moment.'); this.code = 'server_busy'; this.status = 503; }
}

function createHashGate({ max = DEFAULT_MAX, maxQueue = DEFAULT_QUEUE } = {}) {
  const size = Number.isSafeInteger(max) && max > 0 ? max : DEFAULT_MAX;
  const limit = Number.isSafeInteger(maxQueue) && maxQueue >= 0 ? maxQueue : DEFAULT_QUEUE;
  const waiting = [];
  let active = 0;
  const release = () => { const next = waiting.shift(); if (next) next(); else active -= 1; }; // el cupo pasa directo al siguiente de la cola
  async function run(fn) {
    if (active < size) active += 1;
    else if (waiting.length >= limit) throw new ServerBusyError();
    else await new Promise(resolve => waiting.push(resolve));
    try { return await fn(); } finally { release(); }
  }
  return { run, stats: () => ({ active, queued: waiting.length, size, maxQueue: limit }) };
}

module.exports = { createHashGate, ServerBusyError, DEFAULT_MAX, DEFAULT_QUEUE };
