// Explicit loopback-only browser harness: production app/auth, real disposable Postgres.
// LLM/storage are replaced with rejecting doubles; no external providers or .env files.
const { randomBytes } = require('node:crypto');
const { Sequelize } = require('sequelize');
const express = require('express');
const bcrypt = require('bcryptjs');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const source = new URL(process.env.ES74_TEST_DATABASE_URL);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(source.hostname)) throw new Error('Only loopback DB allowed');
  const name = 'es74_browser_' + randomBytes(8).toString('hex');
  if (!/^es74_browser_[a-f0-9]{16}$/.test(name)) throw new Error('Invalid temporary DB');
  const admin = new Sequelize(source.toString(), { logging: false, dialectOptions: { ssl: false } });
  await admin.query(`CREATE DATABASE "${name}"`);
  source.pathname = '/' + name;
  const sequelize = new Sequelize(source.toString(), { logging: false, dialectOptions: { ssl: false } });
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString('hex');
  process.env.ADMIN_EMAILS = '';
  const replace = (relative, exports) => {
    const id = require.resolve(path.resolve(__dirname, '../..', relative));
    require.cache[id] = { id, filename: id, loaded: true, exports };
  };
  replace('database.js', { sequelize, connectDB: async () => sequelize.authenticate() });
  const rejectProvider = async () => { throw new Error('External providers disabled in ES-74 harness'); };
  replace('utils/anthropic.js', { messages: { create: rejectProvider } });
  replace('utils/storage.js', { uploadFile: rejectProvider, getSignedUrl: rejectProvider });
  const dotenvId = require.resolve('dotenv');
  require.cache[dotenvId] = { id: dotenvId, filename: dotenvId, loaded: true, exports: { config() {} } };
  let readyResolve, readyReject;
  const ready = new Promise((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
  const sync = sequelize.sync.bind(sequelize);
  sequelize.sync = (...args) => {
    const result = sync(...args);
    result.then(readyResolve, readyReject);
    return result;
  };
  const app = require('../../server');
  await ready;
  const User = require('../../User');
  const { issueToken } = require('../../utils/sessions');
  const { catalog } = require('../../content/landingDefaults');
  const actors = new Map();
  const password = await bcrypt.hash('ES74-only-for-local-tests', 4); // synthetic fixture, never a real credential
  for (const [key, role, done] of [['user-new', 'user', false], ['user-legacy', 'user', true], ['user-done', 'user', true], ['admin', 'admin', true], ['superadmin', 'superadmin', true], ['therapist', 'therapist', true], ['board', 'board', true]]) {
    actors.set(key, await User.create({ name: 'Synthetic', email: `${key}@example.invalid`, password, role, active: true, onboardingCompleted: done }));
  }
  const { encriptarV2 } = require('../../utils/crypto');
  await require('../../ParticipantContext').create({ UserId: actors.get('user-done').id, version: 1, completedAt: new Date(), content: encriptarV2(JSON.stringify({
    preferredLanguage: 'es', residenceCountry: null, targetMarket: null, timeZone: null, profession: null,
    interests: null, availabilityMinutesPerWeek: null, careerGoal: null, careerConstraints: null,
  })) });
  const wrapper = express();
  // Bootstrap a pre-existing synthetic session for the "with session" journeys, without exposing token values in logs.
  wrapper.get('/__es74/start', (req, res) => {
    const actor = actors.get(req.query.actor);
    const lang = req.query.lang === 'en' ? 'en' : 'es';
    const role = req.query.spoof === 'true' ? 'admin' : actor?.role;
    const values = { elv_lang: lang, ...(actor ? { elevation_token: issueToken(actor), elevation_role: role, elevation_name: 'Synthetic' } : {}) };
    const target = req.query.target === 'register' ? '/login?mode=register' : req.query.target === 'login' ? '/login' : '/';
    res.type('html').send(`<script>for(const k of ['elevation_token','elevation_role','elevation_name','elevation_onboarding'])localStorage.removeItem(k);for(const [k,v]of Object.entries(${JSON.stringify(values)}))localStorage.setItem(k,v);location.replace(${JSON.stringify(target)})</script>`);
  });
  // Test-only CMS failures/edits, selected explicitly by a cookie. Normal requests use the real API/DB.
  wrapper.get('/__es74/cms/:scenario', (req, res) => {
    const allowed = ['offline', 'empty', 'partial', 'long'];
    if (!allowed.includes(req.params.scenario)) return res.status(400).end();
    res.setHeader('Set-Cookie', `es74cms=${req.params.scenario}; SameSite=Strict; Path=/`);
    res.redirect('/');
  });
  wrapper.get('/api/landing-content', (req, res, next) => {
    const mode = req.headers.cookie?.match(/(?:^|; )es74cms=(\w+)/)?.[1];
    if (!mode) return next();
    const lang = req.query.lang === 'en' ? 'en' : 'es';
    if (mode === 'offline') return res.status(503).json({});
    if (mode === 'empty') return res.json({});
    const values = Object.fromEntries(catalog.map(entry => [entry.key, entry[lang]]));
    values['landing.join.title'] = mode === 'long' ? 'SyntheticLongWord'.repeat(15) : lang === 'es' ? 'Título de prueba' : 'Synthetic heading';
    if (mode === 'long') values['landing.join.professional_body'] = '<img src=x onerror="alert(1)">';
    res.json(values);
  });
  wrapper.get('/__es74/dark', (req, res) => {
    const html = fs.readFileSync(path.resolve(__dirname, '../../../frontend/dist/index.html'), 'utf8');
    res.type('html').send(html.replace('</head>', `<script>const mm=window.matchMedia.bind(window);window.matchMedia=q=>q==='(prefers-color-scheme: dark)'?{matches:true,media:q,addEventListener(){},removeEventListener(){}}:mm(q);history.replaceState(null,'','/');</script></head>`));
  });
  // The isolated worktree lives inside .codex: sendFile otherwise ignores that
  // dot-directory on direct SPA URLs. This harness-only override allows it.
  wrapper.get(/^\/(login|app|admin|therapist|board)(\/.*)?$/, (req, res) => {
    res.sendFile(path.resolve(__dirname, '../../../frontend/dist/index.html'), { dotfiles: 'allow' });
  });
  wrapper.post('/__es74/stop', (_req, res) => { res.end(); void stop(); });
  wrapper.use(app);
  const server = wrapper.listen(0, '127.0.0.1', () => console.log('ES-74 real DB/auth browser harness: http://127.0.0.1:' + server.address().port));
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    await sequelize.close();
    await admin.query(`DROP DATABASE "${name}"`); // own random DB only
    await admin.close();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
})().catch(() => { console.error('ES-74 browser harness startup failed.'); process.exit(1); });
