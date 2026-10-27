// Transactional memory double. Does NOT establish PostgreSQL locking semantics.
const { models, database } = require('./support.cjs');
const { Op } = require('sequelize');
const matches = (row, where = {}) => Reflect.ownKeys(where).every(key => {
  if (key === Op.or) return where[key].some(branch => matches(row, branch));
  if (where[key] && typeof where[key] === 'object' && Op.lt in where[key]) return row[key] < where[key][Op.lt];
  return where[key] === null ? row[key] == null : row[key] === where[key];
});

function install() {
  const state = { tables: Object.fromEntries(Object.keys(models).map(name => [name, []])), fail: null, failCommit: false };
  const table = (name, options = {}) => (options.transaction?.tables || state.tables)[name];
  const wrap = value => value && ({ ...value,
    async update(updates) { Object.assign(value, updates); Object.assign(this, updates); return this; },
    toJSON() { return { ...value }; },
  });
  const maybeFail = (name, operation) => {
    if (state.fail === `${name}.${operation}`) { state.fail = null; throw new Error('synthetic database failure'); }
  };
  database.sequelize.transaction = async () => ({
    tables: structuredClone(state.tables),
    async commit() {
      if (state.failCommit) { state.failCommit = false; throw new Error('synthetic commit failure'); }
      state.tables = this.tables;
    },
    async rollback() {},
  });
  for (const [name, model] of Object.entries(models)) {
    model.findAll = async (options = {}) => {
      maybeFail(name, 'findAll');
      return table(name, options).filter(row => matches(row, options.where)).sort((a, b) => a.id - b.id).slice(0, options.limit).map(wrap);
    };
    model.findOne = async (options = {}) => {
      maybeFail(name, 'findOne');
      return wrap(table(name, options).find(row => matches(row, options.where))) || null;
    };
    model.findByPk = async (id, options = {}) => wrap(table(name, options).find(row => row.id === id)) || null;
    model.create = async (values, options = {}) => {
      maybeFail(name, 'create');
      const rows = table(name, options);
      const raw = { createdAt: new Date(), updatedAt: new Date(), ...values };
      raw.id ??= rows.length + 1;
      rows.push(raw);
      return wrap(raw);
    };
    model.destroy = async (options = {}) => {
      maybeFail(name, 'destroy');
      const rows = table(name, options);
      const targets = rows.filter(row => matches(row, options.where));
      for (const row of targets) rows.splice(rows.indexOf(row), 1);
      return targets.length;
    };
  }
  // Existing session helpers use these two method names.
  models.RevokedToken.findByPk = async () => null;
  models.AuthRevocation.findByPk = async () => null;
  const add = (name, row) => state.tables[name].push({ createdAt: new Date('2026-10-01'), updatedAt: new Date('2026-10-01'), ...row });
  for (const id of [101, 202, 303]) add('User', {
    id, name: `Synthetic ${id}`, email: `${id}@example.invalid`, password: 'NEVER_EXPORT_PASSWORD', active: true,
    role: id === 303 ? 'superadmin' : 'user', therapistId: null,
  });
  add('message', { id: 1, UserId: 101, role: 'user', content: 'A private message', secretColumn: 'NEVER_EXPORT_EXTRA' });
  add('message', { id: 2, UserId: 202, role: 'user', content: 'B PRIVATE CANARY' });
  add('DiaryEntry', { id: 1, UserId: 101, entryDate: '2026-10-01', content: 'A diary', deletedAt: null });
  add('DiaryEntry', { id: 2, UserId: 101, entryDate: '2026-10-01', content: 'DELETED CANARY', deletedAt: new Date() });
  add('ChatTurn', { id: 1, UserId: 101, requestId: 'turn-a', status: 'completed', userContent: 'original', replyContent: 'reply' });
  for (const purpose of ['necessary', 'professional_bridge', 'facilitator_sharing']) add('Consent', {
    id: state.tables.Consent.length + 1, UserId: 101, purpose, scope: 'default', status: 'granted', version: 1,
  });
  return { state, add };
}

module.exports = { install };
