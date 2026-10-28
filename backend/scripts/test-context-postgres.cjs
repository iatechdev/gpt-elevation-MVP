const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const net = require('node:net');
const { randomBytes } = require('node:crypto');
const { spawn } = require('node:child_process');

(async () => {
  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  const parent = path.resolve(os.tmpdir());
  const directory = fs.mkdtempSync(path.join(parent, 'es14-pg-'));
  if (path.dirname(path.resolve(directory)) !== parent || !path.basename(directory).startsWith('es14-pg-')) throw new Error('Unsafe test directory');
  const password = randomBytes(24).toString('hex');
  const probe = net.createServer();
  const port = await new Promise((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => { const selected = probe.address().port; probe.close(() => resolve(selected)); });
  });
  const pg = new EmbeddedPostgres({ databaseDir: directory, user: 'es14_test', password, port,
    persistent: false, initdbFlags: ['--encoding=UTF8', '--locale=C'], postgresFlags: ['-h', '127.0.0.1'], onLog() {}, onError() {} });
  let started = false; let resultCode = 1;
  try {
    await pg.initialise(); await pg.start(); started = true;
    console.log('Disposable loopback PostgreSQL; generated credentials are not printed.');
    resultCode = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['--test', 'test/integration/es-14-postgres.cjs'], {
        cwd: path.resolve(__dirname, '..'), windowsHide: true, stdio: 'inherit',
        env: { ...process.env, ES14_TEST_DATABASE_URL: `postgres://es14_test:${password}@127.0.0.1:${port}/postgres` },
      });
      child.once('error', reject); child.once('exit', code => resolve(code ?? 1));
    });
  } finally {
    if (started) await pg.stop(); // The library cleans only the generated test directory.
  }
  process.exitCode = resultCode;
})().catch(error => { console.error('Local PostgreSQL verification failed:', error.code ?? error.name); process.exitCode = 1; });
