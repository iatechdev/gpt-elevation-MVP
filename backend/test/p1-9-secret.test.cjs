const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const path = require('node:path');
const jwt = require('jsonwebtoken');
const { promptVault, startApp } = require('./support.cjs');

test('P1-9: production entrypoints, signer and verifier fail closed without JWT_SECRET', async t => {
  for (const relative of ['server.js', '../api/index.js', 'routes/auth.js', 'middlewares/auth.js']) {
    await t.test(relative, () => {
      for (const secret of [undefined, '', '   ']) {
        const env = { ...process.env, NODE_ENV: 'production' };
        if (secret === undefined) delete env.JWT_SECRET;
        else env.JWT_SECRET = secret;
        const target = path.resolve(__dirname, '..', relative);
        // Ignore local .env files so the child tests exactly the supplied environment.
        const source = `const id = require.resolve('dotenv');
          require.cache[id] = {id, filename:id, loaded:true, exports:{config(){}}};
          require(${JSON.stringify(target)});`;
        const result = spawnSync(process.execPath, ['-e', source], {
          env, cwd: path.resolve(__dirname, '..'), encoding: 'utf8', timeout: 10000,
        });
        assert.equal(result.error, undefined);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /JWT_SECRET must be configured/);
        assert.doesNotMatch(result.stdout, /PostgreSQL|puerto/);
      }
    });
  }
});

test('P1-9: configured production key works; foreign or missing tokens are denied', async t => {
  process.env.NODE_ENV = 'production';
  let proposed = false;
  promptVault.proposePrompt = async () => { proposed = true; };
  const request = await startApp(t);
  assert.equal((await request('POST', '/api/admin/prompt/propose', {
    role: 'admin', body: { key: 'synthetic', content: 'Synthetic prompt' },
  })).status, 200);
  assert.equal(proposed, true);
  assert.equal((await request('POST', '/api/admin/prompt/propose', { body: {} })).status, 403);
  const foreign = jwt.sign({ id: 101, role: 'superadmin' }, randomBytes(32).toString('hex'));
  assert.equal((await request('POST', '/api/admin/prompt/propose', {
    body: {}, headers: { Authorization: 'Bearer ' + foreign },
  })).status, 401);
  assert.equal((await request('POST', '/api/admin/prompt/propose', {
    role: 'user', body: {},
  })).status, 403);
});
