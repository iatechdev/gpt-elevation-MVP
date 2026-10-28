// Almacén en memoria con transacciones por instantánea para las pruebas de ES-31. Aplica el `where`, las restricciones únicas (incluidas
// las parciales) y la reversión. NO reproduce los bloqueos de Postgres: la concurrencia real se prueba en test/integration/.
const { models, database } = require('./support.cjs');

const matches = (row, where = {}) => Object.entries(where).every(([key, value]) => {
  if (value === null) return row[key] == null;
  if (value instanceof Date) return row[key] instanceof Date && row[key].getTime() === value.getTime();
  return row[key] === value;
});

// { fields, where? }: where limita la restricción a las filas que lo cumplen (índice único parcial).
const UNIQUE = {
  RouteCatalog: [{ fields: ['version'] }, { fields: ['status'], where: { status: 'published' } }, { fields: ['status'], where: { status: 'draft' } }],
  RouteCatalogItem: [{ fields: ['catalogId', 'kind', 'itemKey'] }],
  Consent: [{ fields: ['UserId', 'purpose', 'scope'] }],
};

function install() {
  const state = { tables: Object.fromEntries(Object.keys(models).map((name) => [name, []])) };
  const ids = {};
  const table = (name, options = {}) => (options.transaction?.tables || state.tables)[name];
  const wrap = (raw) => raw && Object.assign(Object.create({
    async update(updates) { Object.assign(raw, updates, { updatedAt: new Date() }); Object.assign(this, raw); return this; },
  }), raw);
  const violates = (name, rows, values, ignore) => (UNIQUE[name] || []).some(({ fields, where }) => {
    if (where && !matches(values, where)) return false;
    return rows.some((row) => row !== ignore && (!where || matches(row, where)) && fields.every((f) => row[f] === values[f]));
  });

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
    model.destroy = async (options = {}) => {
      const rows = table(name, options);
      const targets = rows.filter((row) => matches(row, options.where));
      for (const row of targets) rows.splice(rows.indexOf(row), 1);
      return targets.length;
    };
    model.create = async (values, options = {}) => {
      const rows = table(name, options);
      if (violates(name, rows, values)) {
        const error = new Error('unique'); error.name = 'SequelizeUniqueConstraintError'; throw error;
      }
      ids[name] = (ids[name] || 0) + 1;
      const raw = { createdAt: new Date(), updatedAt: new Date(), ...values };
      raw.id ??= 1000 * name.length + ids[name];
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
