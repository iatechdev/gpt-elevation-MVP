// Real Express app, HTTP and JWTs; persistence/crypto/provider boundaries are mocked.
// Never load .env files, connect to a database or call external providers in this suite.
const { randomBytes } = require('node:crypto');
const { once } = require('node:events');
const path = require('node:path');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = randomBytes(32).toString('hex');
process.env.ADMIN_EMAILS = '';

function replaceModule(relativePath, exports) {
  const id = require.resolve(path.resolve(__dirname, '..', relativePath));
  require.cache[id] = { id, filename: id, loaded: true, exports };
}

const models = {};
for (const name of [
  'User', 'ParticipantContext', 'message', 'MoodLog', 'SessionRating', 'ClinicalNote',
  'WellnessRecommendation', 'TherapistProfile', 'MatchingRequest',
  'TherapySession', 'SessionNote', 'EthicManifest', 'PricingPlan',
  'PlanRequest', 'TherapistValidation', 'LandingContent', 'RevokedToken', 'AuthRevocation', 'Consent', 'ConsentEvent', 'ChatTurn', 'DiaryEntry', 'DerivedInvalidation', 'AiBudgetCounter', 'AiUsage', 'ExportRequest', 'DeletionRequest',
]) {
  models[name] = {};
  replaceModule(name + '.js', models[name]);
}

// ES-18: sesiones sin revocar por defecto; las pruebas de sesión sobrescriben estos dobles.
models.RevokedToken.findByPk = async () => null;
models.RevokedToken.upsert = async () => {};
models.RevokedToken.destroy = async () => 0;
models.AuthRevocation.findByPk = async () => null;
models.AuthRevocation.upsert = async () => {};
models.DeletionRequest.findOne = async () => null;

// ES-22: presupuesto de IA holgado por defecto y contadores en memoria; las pruebas de presupuesto lo sobrescriben.
process.env.AI_BUDGET_TOKENS_PER_USER = '1000000000';
process.env.AI_BUDGET_TOKENS_COHORT = '1000000000';
process.env.AI_BUDGET_PERIOD = 'month';
const defaultCounters = new Map();
models.AiBudgetCounter.findOne = async ({ where }) => defaultCounters.get(`${where.UserId}|${where.periodKey}`) ?? null;
models.AiBudgetCounter.create = async values => {
  const row = { ...values, async update(updates) { Object.assign(this, updates); return this; } };
  defaultCounters.set(`${values.UserId}|${values.periodKey}`, row);
  return row;
};
models.AiUsage.create = async values => ({ ...values, async update(updates) { Object.assign(this, updates); return this; } });
models.AiUsage.findAll = async () => [];

const unexpected = async () => { throw new Error('Unexpected mocked provider call'); };
const transaction = { commit: async () => {}, rollback: async () => {} };
const database = {
  connectDB: async () => {},
  sequelize: { sync: async () => {}, transaction: async () => transaction },
};
const storage = { uploadFile: unexpected, getSignedUrl: unexpected };
const anthropic = { messages: { create: unexpected } };
const promptVault = {
  PromptVault: {}, getActivePrompt: unexpected, savePrompt: unexpected,
  proposePrompt: unexpected, approvePrompt: unexpected,
  rejectPrompt: unexpected, rollbackPrompt: unexpected,
};

replaceModule('database.js', database);
replaceModule('associations.js', () => {});
replaceModule('utils/crypto.js', { encriptar: value => value, encriptarV2: value => value, desencriptar: value => value });
replaceModule('utils/storage.js', storage);
replaceModule('utils/anthropic.js', anthropic);
replaceModule('promptVault.js', promptVault);
const dotenvId = require.resolve('dotenv');
require.cache[dotenvId] = { id: dotenvId, filename: dotenvId, loaded: true, exports: { config() {} } };

function record(values) {
  return Object.assign({}, values, {
    async update(updates) { Object.assign(this, updates); return this; },
    async save() { return this; },
    toJSON() { return { ...this }; },
  });
}

async function startApp(t) {
  // Import the production mounts, not a test reconstruction of the router tree.
  const app = require('../server');
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  return async function request(method, url, { role, id = 101, body, headers = {} } = {}) {
    if (role) headers = { ...headers, Authorization: 'Bearer ' + jwt.sign(
      { id, role, name: 'Synthetic actor' }, process.env.JWT_SECRET, { expiresIn: '1m', jwtid: randomBytes(8).toString('hex') },
    ) };
    const options = { method, headers };
    if (body !== undefined) {
      if (body instanceof FormData) options.body = body;
      else {
        options.headers = { ...headers, 'Content-Type': 'application/json' };
        options.body = JSON.stringify(body);
      }
    }
    const response = await fetch(`http://127.0.0.1:${server.address().port}${url}`, options);
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null, headers: response.headers };
  };
}

module.exports = { models, database, transaction, storage, anthropic, promptVault, record, startApp };
