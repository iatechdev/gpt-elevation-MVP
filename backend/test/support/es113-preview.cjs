// Local QA preview: built real UI + diary router/JWT/ORM/crypto on disposable PostgreSQL.
// No .env or external providers. /__es113/* are TEST-ONLY controls, never mounted by server.js.
const fs = require('node:fs'); const path = require('node:path'); const net = require('node:net');
const { randomBytes } = require('node:crypto'); const { once } = require('node:events');
(async () => {
  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  const root = path.resolve(__dirname, '../../.pgdata');
  const directory = path.join(root, 'es113-preview-' + randomBytes(8).toString('hex'));
  if (path.dirname(directory) !== root || !/^es113-preview-[a-f0-9]{16}$/.test(path.basename(directory))) throw new Error('Invalid test directory');
  fs.mkdirSync(root, { recursive: true });
  const probe = net.createServer();
  const pgPort = await new Promise(resolve => probe.listen(0, '127.0.0.1', () => { const port = probe.address().port; probe.close(() => resolve(port)); }));
  const password = randomBytes(24).toString('hex');
  const pg = new EmbeddedPostgres({ databaseDir: directory, user: 'es113_preview', password, port: pgPort, persistent: true,
    initdbFlags: ['--encoding=UTF8', '--locale=C'], postgresFlags: ['-h', '127.0.0.1'], onLog() {}, onError() {} });
  const servers = []; let sequelize; let started = false; let stopping = false;
  const stop = async () => {
    if (stopping) return; stopping = true;
    for (const server of servers) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    if (sequelize) await sequelize.close();
    if (started) {
      await pg.stop();
      if (path.dirname(directory) !== root || !/^es113-preview-[a-f0-9]{16}$/.test(path.basename(directory))) throw new Error('Invalid cleanup directory');
      await fs.promises.rm(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    }
  };
  process.on('SIGINT', () => void stop().then(() => process.exit()));
  process.on('SIGTERM', () => void stop().then(() => process.exit()));
  try {
    await pg.initialise(); await pg.start(); started = true;
    const { Sequelize } = require('sequelize');
    sequelize = new Sequelize(`postgres://es113_preview:${password}@127.0.0.1:${pgPort}/postgres`, { logging: false, dialectOptions: { ssl: false } });
    process.env.JWT_SECRET = randomBytes(32).toString('hex'); process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString('hex');
    const db = require.resolve('../../database'); require.cache[db] = { id: db, filename: db, loaded: true, exports: { sequelize } };
    require('../../PricingPlan'); const User = require('../../User'); const Diary = require('../../DiaryEntry');
    const sessions = require('../../utils/sessions'); const { verificarToken } = require('../../middlewares/auth');
    const { encriptarV2 } = require('../../utils/crypto'); const diaryRouter = require('../../routes/diary');
    await sequelize.sync();
    const tokens = new Map();
    for (const id of [101, 202]) {
      const user = await User.create({ id, role: 'user', name: 'Synthetic diary preview', email: `es113-${id}@example.invalid`, password: 'synthetic-no-login' });
      tokens.set(String(id), sessions.issueToken(user));
      await Diary.create({ UserId: id, entryDate: '2026-10-29', content: encriptarV2(id === 101 ? 'Entrada ficticia para revisar el diario.\n\nUna pausa para ordenar mis ideas.\n\nSynthetic example, not pilot data.' : 'Synthetic B private entry') });
    }
    const express = require('express');
    async function serve(dist, port) {
      if (!fs.existsSync(path.join(dist, 'index.html'))) throw new Error('Build frontend first');
      const app = express(); app.use(express.json()); const fired = new Set();
      app.get('/__es113/session/:id', (req, res) => {
        const token = tokens.get(req.params.id); if (!token) return res.status(404).end();
        const lang = req.query.lang === 'en' ? 'en' : 'es';
        res.type('html').send(`<script>localStorage.clear();sessionStorage.clear();for(const [k,v]of Object.entries(${JSON.stringify({ elevation_token: token, elevation_role: 'user', elv_lang: lang })}))localStorage.setItem(k,v);location.replace('/app/diary')</script>`);
      });
      app.get('/__es113/scenario/:mode', (req, res) => {
        if (!['normal', 'list-error', 'read-error', 'create-error', 'create-ack', 'edit-ack', 'delete-ack'].includes(req.params.mode)) return res.status(400).end();
        fired.delete(req.params.mode);
        res.setHeader('Set-Cookie', `es113fault=${req.params.mode}; SameSite=Strict; Path=/`); res.redirect('/app/diary');
      });
      app.get('/__es113/change-seed', async (_req, res) => {
        const row = await Diary.findOne({ where: { UserId: 101 }, order: [['id', 'ASC']] });
        await row.update({ content: encriptarV2('Synthetic update from another session') }); res.send('Synthetic saved version changed');
      });
      app.get('/__es113/revoke/:id', async (req, res) => {
        const token = tokens.get(req.params.id); if (!token) return res.status(404).end();
        await sessions.revokeToken(require('jsonwebtoken').decode(token)); res.send('Synthetic session revoked');
      });
      app.get('/__es113/stop', (_req, res) => { res.send('Stopping disposable preview'); setImmediate(() => void stop()); });
      app.use('/api/diary', (req, res, next) => {
        const mode = req.headers.cookie?.match(/(?:^|; )es113fault=([\w-]+)/)?.[1];
        if (!mode || fired.has(mode)) return next();
        if ((mode === 'list-error' && req.method === 'GET' && req.path === '/') || (mode === 'read-error' && req.method === 'GET' && /^\/\d+$/.test(req.path)) || (mode === 'create-error' && req.method === 'POST')) {
          fired.add(mode); return res.status(503).json({ error: 'Synthetic network failure' });
        }
        if ((mode === 'create-ack' && req.method === 'POST') || (mode === 'edit-ack' && req.method === 'PUT') || (mode === 'delete-ack' && req.method === 'DELETE')) {
          // A complete HTTP response with an unreadable ACK avoids the browser's
          // transport-level retry of a closed socket, while the DB commit is real.
          const json = res.json.bind(res); res.json = data => { if (res.statusCode < 300) { fired.add(mode); res.status(200).type('json').end('{'); return res; } return json(data); };
        }
        next();
      }, verificarToken, diaryRouter);
      app.use('/api', (_req, res) => res.status(404).json({ error: 'Not part of diary preview' }));
      app.use(express.static(dist, { dotfiles: 'allow' }));
      app.get('/{*path}', (_req, res) => res.sendFile(path.join(dist, 'index.html'), { dotfiles: 'allow' }));
      const server = app.listen(port, '127.0.0.1'); servers.push(server); await once(server, 'listening');
      console.log(`ES-113 real diary preview: http://127.0.0.1:${port}/__es113/session/101`);
    }
    await serve(path.resolve(__dirname, '../../../frontend/dist'), 43114);
    if (process.env.ES113_BASELINE_DIST) await serve(path.resolve(process.env.ES113_BASELINE_DIST), 43115);
  } catch (error) { console.error('ES-113 preview failed:', error.name); await stop(); process.exitCode = 1; }
})().catch(error => { console.error('ES-113 preview failed:', error.name); process.exitCode = 1; });
