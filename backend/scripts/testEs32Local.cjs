// PostgreSQL efímero propio. No carga .env, no usa DATABASE_URL ni un servidor externo.
const { randomBytes } = require('node:crypto');
const { mkdtemp, rm } = require('node:fs/promises');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
async function main() {
  const directory = await mkdtemp(path.join(__dirname, '../node_modules/.es32-pg-'));
  let pg; let failed = false;
  try {
    const server = net.createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const port = server.address().port; await new Promise(resolve => server.close(resolve));
    const { default: EmbeddedPostgres } = await import('embedded-postgres');
    const password = randomBytes(32).toString('hex');
    pg = new EmbeddedPostgres({ databaseDir: directory, user: 'es32', password, port, persistent: false, initdbFlags: ['--encoding=UTF8', '--locale=C'], onLog: () => {}, onError: () => {} });
    await pg.initialise(); await pg.start();
    const source = `postgres://es32:${password}@127.0.0.1:${port}/postgres`;
    const child = spawn(process.execPath, ['--test', 'test/integration/es-32-postgres.cjs', 'test/integration/es-23-postgres.cjs'], {
      cwd: path.join(__dirname, '..'), stdio: 'inherit', env: { ...process.env, ES32_TEST_DATABASE_URL: source, ES23_TEST_DATABASE_URL: source },
    });
    const code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('exit', resolve); });
    if (code !== 0) failed = true;
  } catch (error) { failed = true; console.error('ES-32 local failed:', error.name); }
  finally {
    if (pg) await pg.stop();
    const parent = path.resolve(__dirname, '../node_modules');
    if (path.dirname(path.resolve(directory)) !== parent || !path.basename(directory).startsWith('.es32-pg-')) throw new Error('Unexpected temporary directory');
    await rm(directory, { recursive: true, force: true });
  }
  // embedded-postgres puede programar salida 0 durante cleanup: el fallo debe prevalecer.
  if (failed) process.exit(1);
}
main().catch(error => { console.error(error.name); process.exit(1); });
