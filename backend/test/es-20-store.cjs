// Almacenes en memoria para las pruebas de ES-20: aplican el `where` de la ruta, soportan transacciones con
// confirmación/reversión y la restricción única de ChatTurn. No sustituyen a Postgres real.
const { models, database } = require('./support.cjs');

const sameValue = (actual, expected) => {
  if (expected instanceof Date) return actual instanceof Date && actual.getTime() === expected.getTime();
  if (Array.isArray(expected)) return expected.includes(actual);
  if (expected === null) return actual === null || actual === undefined;
  return actual === expected;
};
const matches = (row, where = {}) => Object.entries(where).every(([key, value]) => sameValue(row[key], value));
const sortBy = (rows, order = []) => [...rows].sort((a, b) => {
  for (const [field, direction] of order) {
    const x = a[field] instanceof Date ? a[field].getTime() : a[field];
    const y = b[field] instanceof Date ? b[field].getTime() : b[field];
    if (x < y) return direction === 'DESC' ? 1 : -1;
    if (x > y) return direction === 'DESC' ? -1 : 1;
  }
  return 0;
});

function install() {
  const tick = () => new Date(); // hora real: la lógica de turnos vencidos compara con Date.now()
  const state = { messages: [], turns: [], entries: [], invalidations: [] };
  const ids = { message: 1, turn: 1, entry: 1, invalidation: 1 };

  database.sequelize.transaction = async () => ({
    pending: [],
    defer(fn) { this.pending.push(fn); },
    async commit() { this.pending.forEach(fn => fn()); this.pending = []; },
    async rollback() { this.pending = []; },
  });

  // Fila con update() que respeta la transacción: dentro de una transacción el cambio se aplica al confirmar.
  const row = (values, bucket, extra = {}) => {
    const created = tick();
    const instance = {
      createdAt: created, updatedAt: created, ...values, ...extra,
      async update(updates, options = {}) {
        const apply = () => Object.assign(this, updates, { updatedAt: tick() });
        if (options.transaction) options.transaction.defer(apply); else apply();
        return this;
      },
      toJSON() { return { ...this }; },
    };
    if (bucket) {
      const push = () => bucket.push(instance);
      return { instance, push };
    }
    return { instance };
  };
  const create = (bucket, idKey, check) => async (values, options = {}) => {
    if (check) check(values);
    const { instance, push } = row({ id: ids[idKey]++, ...values }, bucket);
    if (options.transaction) options.transaction.defer(push); else push();
    return instance;
  };

  models.message.create = create(state.messages, 'message');
  models.message.findAll = async ({ where, order, limit } = {}) =>
    sortBy(state.messages.filter(r => matches(r, where)), order).slice(0, limit ?? Infinity);

  models.ChatTurn.create = create(state.turns, 'turn', values => {
    if (state.turns.some(t => t.UserId === values.UserId && t.requestId === values.requestId)) {
      const error = new Error('duplicado');
      error.name = 'SequelizeUniqueConstraintError';
      throw error;
    }
  });
  models.ChatTurn.findOne = async ({ where }) => state.turns.find(r => matches(r, where)) ?? null;
  models.ChatTurn.update = async (updates, { where }) => {
    const targets = state.turns.filter(r => matches(r, where));
    for (const target of targets) await target.update(updates);
    return [targets.length];
  };

  models.DiaryEntry.create = create(state.entries, 'entry');
  models.DiaryEntry.findOne = async ({ where }) => state.entries.find(r => matches(r, where)) ?? null;
  models.DiaryEntry.findAll = async ({ where, order, limit } = {}) =>
    sortBy(state.entries.filter(r => matches(r, where)), order).slice(0, limit ?? Infinity);
  models.DerivedInvalidation.create = create(state.invalidations, 'invalidation');

  return state;
}

module.exports = { install };
