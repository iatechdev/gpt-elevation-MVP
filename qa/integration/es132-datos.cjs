// [QA-Claude] ES-132 · PR #128 (head a835c834): derechos de datos con una recuperación pendiente. Servidor local A + Postgres real; datos SINTÉTICOS; 0 tokens de IA.
// Uso: A=http://127.0.0.1:8128 MAILDIR=<carpeta> node qa/integration/es132-datos.cjs   (no imprime enlaces ni contraseñas)
const fs = require('fs'); const path = require('path'); const E = process.env; const S = 'C:/Users/Usuario/Documents/qa13';
Object.assign(process.env, { DATABASE_URL: 'postgres://elevation:elevation_local@127.0.0.1:54459/es132test', DB_SSL: 'false', JWT_SECRET: fs.readFileSync(S + '/jwt', 'utf8').trim(), DATA_ENCRYPTION_KEY: fs.readFileSync(S + '/dek', 'utf8').trim(), PROMPT_ENCRYPTION_KEY: fs.readFileSync(S + '/pek', 'utf8').trim() });
const BACK = 'C:/Users/Usuario/Documents/qa-pr-test/backend'; const { Client } = require(BACK + '/node_modules/pg');
const out = []; const R = (id, ok, d = '') => { out.push({ id, ok: !!ok, detail: String(d).slice(0, 300) }); console.log(JSON.stringify({ id, ok: !!ok, detail: String(d).slice(0, 260) })); };
const A = E.A; const sleep = ms => new Promise(r => setTimeout(r, ms));
const j = async (m, p, t, b) => { const r = await fetch(A + p, { method: m, headers: { ...(t ? { Authorization: 'Bearer ' + t } : {}), ...(b !== undefined ? { 'content-type': 'application/json' } : {}) }, body: b !== undefined ? JSON.stringify(b) : undefined }); let body = null; try { body = await r.json(); } catch { /* */ } return { s: r.status, j: body }; };
const persona = async tag => { const stamp = Date.now() + Math.floor(Math.random() * 1000); const email = `qa132d-${tag}-${stamp}@example.test`, password = 'Qa132d-' + stamp + 'aA!x'; await j('POST', '/api/register', null, { name: 'QA ' + tag, email, password }); const l = await j('POST', '/api/login', null, { email, password }); return { email, token: l.j?.token, id: l.j?.user?.id ?? l.j?.id }; };
(async () => {
  const db = new Client({ connectionString: process.env.DATABASE_URL, ssl: false }); await db.connect();
  const U = await persona('a'), V = await persona('b'); if (!U.token || !V.token) { console.log('ERROR sin sesión'); process.exit(1); }
  const uid = (await db.query('SELECT id FROM "Users" WHERE email=$1', [U.email])).rows[0].id, vid = (await db.query('SELECT id FROM "Users" WHERE email=$1', [V.email])).rows[0].id;
  for (const x of [U, V]) { const r = await j('POST', '/api/password-reset/request', null, { email: x.email }); R('D1 solicitud de recuperación ' + (x === U ? 'A' : 'B'), r.s === 200 || r.s === 202, 'http=' + r.s); await sleep(300); }
  const n0 = (await db.query('SELECT count(*)::int n FROM "PasswordResets" WHERE "UserId"=$1', [uid])).rows[0].n, nv0 = (await db.query('SELECT count(*)::int n FROM "PasswordResets" WHERE "UserId"=$1', [vid])).rows[0].n;
  R('D2 hay una recuperación pendiente para A y otra para B', n0 === 1 && nv0 === 1, `A=${n0} B=${nv0}`);
  const pv = await j('POST', '/api/exports/preview', U.token, { type: 'personal', locale: 'es' }); const exp = JSON.stringify(pv.j?.data ?? {}); const rows = pv.j?.data?.passwordResets ?? pv.j?.data?.data?.passwordResets;
  R('D3 la exportación personal incluye passwordResets (id y fechas) y NUNCA tokenHash ni valores de hash', pv.s < 300 && Array.isArray(rows) && rows.length === 1 && !/tokenHash/i.test(exp) && !/"[0-9a-f]{64}"/.test(exp), `http=${pv.s} filas=${rows?.length} claves=${rows?.[0] ? Object.keys(rows[0]).join(',') : '-'}`);
  const pvb = await j('POST', '/api/exports/preview', V.token, { type: 'personal', locale: 'es' }); const idsA = (rows ?? []).map(r => r.id); const rowsB = pvb.j?.data?.passwordResets ?? pvb.j?.data?.data?.passwordResets ?? [];
  R('D4 aislamiento: la exportación de B no contiene la recuperación de A', rowsB.length === 1 && !rowsB.some(r => idsA.includes(r.id)), `B=${rowsB.length}`);
  const dr = await j('POST', '/api/account/deletion-requests', U.token, { confirm: true }); R('D5 solicitar el borrado de A con la recuperación pendiente: 202', dr.s === 202 || dr.s === 200, `http=${dr.s} claves=${Object.keys(dr.j || {}).join(',')}`);
  const reqId = dr.j?.id ?? dr.j?.requestId; let purged = false;
  if (reqId) { const { processDeletion } = require(BACK + '/utils/deletionProcessor'); try { await processDeletion(reqId, { quiescent: true }); purged = true; } catch (e) { R('D6 procesar el borrado', false, String(e.message).slice(0, 150)); } }
  const n1 = (await db.query('SELECT count(*)::int n FROM "PasswordResets" WHERE "UserId"=$1', [uid])).rows[0].n, nv1 = (await db.query('SELECT count(*)::int n FROM "PasswordResets" WHERE "UserId"=$1', [vid])).rows[0].n;
  R('D6 tras procesar el borrado, A queda sin recuperaciones y B intacta', purged && n1 === 0 && nv1 === 1, `procesado=${purged} A=${n1} B=${nv1}`);
  const enlace = await j('POST', '/api/password-reset/confirm', null, { token: 'x'.repeat(40), password: 'Zzz-' + Date.now() + 'aA!x' }); R('D7 un token inventado no sirve (4xx, nunca 500)', enlace.s >= 400 && enlace.s < 500, `http=${enlace.s}`);
  console.log('RESUMEN-ES132-DATOS ' + JSON.stringify({ total: out.length, fallos: out.filter(o => !o.ok).length })); fs.writeFileSync(path.join(__dirname, '..', 'evidence', 'ES-132-pr128-v3-datos.json'), JSON.stringify(out, null, 1)); await db.end(); process.exit(0);
})().catch(e => { console.log('ERROR ' + String(e.stack).slice(0, 600)); process.exit(1); });
