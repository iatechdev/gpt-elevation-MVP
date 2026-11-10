// [QA-Claude] ES-186A · control: ids malformados en aprobar/rechazar plan y confirmar (se ejecuta contra main y contra main+#203)
const { createRequire } = require('node:module'); const path = require('node:path'); const fs = require('node:fs'); const { randomBytes } = require('node:crypto');
const E = process.env; const req = createRequire(path.join(E.QA_SUT, 'backend', 'package.json')); const jwt = req('jsonwebtoken'); const { Client } = req('pg'); const API = E.QA_API;
(async () => {
  const db = new Client({ connectionString: E.DATABASE_URL, ssl: false }); await db.connect(); const email = `qa186c-${Date.now()}@example.test`;
  await fetch(API + '/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'QA186C', email, password: randomBytes(12).toString('base64url') + 'aA1!' }) });
  await db.query('update "Users" set role=$1 where email=$2', ['admin', email]); const u = (await db.query('select id,name from "Users" where email=$1', [email])).rows[0];
  const token = jwt.sign({ id: u.id, name: u.name, role: 'admin', iatMs: Date.now() }, E.QA_JWT_SECRET, { expiresIn: '1h', jwtid: randomBytes(8).toString('hex') }); const out = {};
  for (const id of ['abc', '99999999999999999999', '1;drop', '%00', '999999999', '1234567890']) {
    for (const [n, m, p, b] of [['confirm', 'POST', `/api/admin/matching/${id}/confirm`, {}], ['approve', 'PUT', `/api/admin/plan-requests/admin/${id}/approve`, { adminNote: 'x' }], ['reject', 'PUT', `/api/admin/plan-requests/admin/${id}/reject`, { adminNote: 'x' }]]) {
      const r = await fetch(API + p, { method: m, headers: { Authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: JSON.stringify(b) }); out[`${n}:${id}`] = r.status;
    }
  }
  console.log(JSON.stringify(out)); const idle = (await db.query(`select count(*)::int n from pg_stat_activity where datname=current_database() and state like 'idle in transaction%'`)).rows[0].n; console.log('idle in tx=' + idle); await db.end();
})();
