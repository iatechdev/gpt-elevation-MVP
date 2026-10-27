// Almacén en memoria con transacciones por instantánea para las pruebas de ES-25. Aplica el `where`, las restricciones únicas
// de las tablas nuevas y la reversión. NO reproduce los bloqueos de Postgres: la concurrencia real se prueba en test-db/.
const { models, database } = require('./support.cjs');

const matches = (row, where = {}) => Object.entries(where).every(([key, value]) => {
  if (value === null) return row[key] == null;
  if (value instanceof Date) return row[key] instanceof Date && row[key].getTime() === value.getTime();
  return row[key] === value;
});

const UNIQUE = {
  CareerContextVersion: [['UserId', 'version'], ['UserId', 'requestId']],
  Consent: [['UserId', 'purpose', 'scope']],
};

function install() {
  const state = { tables: Object.fromEntries(Object.keys(models).map((name) => [name, []])) };
  const ids = {};
  const table = (name, options = {}) => (options.transaction?.tables || state.tables)[name];
  const wrap = (raw) => raw && Object.assign(Object.create({
    async update(updates) { Object.assign(raw, updates, { updatedAt: new Date() }); Object.assign(this, raw); return this; },
  }), raw);

  database.sequelize.transaction = async () => ({
    tables: structuredClone(state.tables),
    async commit() { state.tables = this.tables; },
    async rollback() {},
  });

  for (const [name, model] of Object.entries(models)) {
    model.findAll = async (options = {}) => {
      let rows = table(name, options).filter((row) => matches(row, options.where));
      for (const [field, direction] of options.order || []) {
        rows = [...rows].sort((a, b) => (a[field] < b[field] ? -1 : a[field] > b[field] ? 1 : 0) * (direction === 'DESC' ? -1 : 1));
      }
      return rows.map(wrap);
    };
    model.findOne = async (options = {}) => wrap(table(name, options).find((row) => matches(row, options.where))) || null;
    model.findByPk = async (id, options = {}) => wrap(table(name, options).find((row) => row.id === id)) || null;
    model.create = async (values, options = {}) => {
      const rows = table(name, options);
      for (const fields of UNIQUE[name] || []) {
        if (rows.some((row) => fields.every((f) => row[f] === values[f]))) {
          const error = new Error('unique'); error.name = 'SequelizeUniqueConstraintError'; throw error;
        }
      }
      if (name === 'CareerContextVersion' && values.status === 'active' && rows.some((r) => r.UserId === values.UserId && r.status === 'active')) {
        const error = new Error('unique'); error.name = 'SequelizeUniqueConstraintError'; throw error;
      }
      ids[name] = (ids[name] || 0) + 1;
      const raw = { createdAt: new Date(), updatedAt: new Date(), ...values };
      raw.id ??= 1000 * (name.length) + ids[name];
      rows.push(raw);
      return wrap(raw);
    };
  }
  const add = (name, row) => {
    ids[name] = (ids[name] || 0) + 1;
    state.tables[name].push({ createdAt: new Date('2026-10-01T10:00:00Z'), updatedAt: new Date('2026-10-01T10:00:00Z'), id: ids[name], ...row });
    return state.tables[name].at(-1);
  };
  return { state, add };
}

module.exports = { install };
