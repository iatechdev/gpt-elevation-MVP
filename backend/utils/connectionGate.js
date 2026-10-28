// QA-33-01: compuerta de concurrencia para operaciones que RETIENEN una conexión del pool mientras piden otras.
// Una escritura de ES-33 abre su transacción (1 conexión), a veces la del consentimiento (2) y, dentro, lee evidencia/ruta/contexto con conexiones
// propias (3). Con el pool lleno de escrituras que esperan una segunda conexión, ninguna avanza y todas terminan en 503 tras el tiempo de espera.
// La compuerta limita cuántas operaciones así corren a la vez en este proceso, de modo que siempre quede una conexión libre para las lecturas.
//
// Invariante: cada operación admitida retiene como máximo HELD conexiones y necesita 1 más para leer. Con `size` operaciones:
//   size * HELD + 1 <= pool.max   =>   size = floor((pool.max - 1) / HELD)   (mínimo 1)
// Alcance y límites: protege solo las operaciones que la usan y solo dentro de un proceso (una réplica). No arregla otros módulos que retengan
// una conexión y esperen otra. Con pool.max < 3 una sola operación ya no cabe en el peor caso: el mínimo de 1 no lo evita.
const { AsyncLocalStorage } = require('node:async_hooks');

const HELD = 2;
const DEFAULT_POOL_MAX = 5; // el valor por defecto de Sequelize y de backend/database.js

function slotsFor(poolMax) {
  const max = Number.isSafeInteger(poolMax) && poolMax > 0 ? poolMax : DEFAULT_POOL_MAX;
  return Math.max(1, Math.floor((max - 1) / HELD));
}

function createGate(size) {
  const inside = new AsyncLocalStorage();
  const waiting = [];
  let active = 0;
  const release = () => { const next = waiting.shift(); if (next) next(); else active -= 1; }; // el cupo pasa directo al siguiente en la cola
  // Reentrante: una operación que ya tiene cupo y entra en otra operación protegida no pide un segundo cupo (se bloquearía a sí misma).
  async function run(fn) {
    if (inside.getStore()) return fn();
    if (active < size) active += 1; else await new Promise(resolve => waiting.push(resolve));
    try { return await inside.run(true, fn); } finally { release(); }
  }
  return { run, size: () => size, active: () => active, waiting: () => waiting.length };
}

// Compuerta de este proceso, dimensionada con el pool real de Sequelize.
let shared;
function gate() {
  if (!shared) {
    const { sequelize } = require('../database');
    shared = createGate(slotsFor(sequelize?.config?.pool?.max));
  }
  return shared;
}

module.exports = { createGate, slotsFor, gate };
