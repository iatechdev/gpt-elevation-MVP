// ES-99 · Subida y descarga de documentos del alta del profesional (ES93-M4, S11) por HTTP REAL (multer real), JWT real y PostgreSQL REAL.
// Express real con el router real y los middlewares reales de rol; el almacenamiento (Google Cloud Storage ya no existe) es un doble controlable.
//   ES99_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54339/postgres node --test test/integration/es-99-postgres.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { once } = require('node:events');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { Client } = require('pg');
const { Sequelize } = require('sequelize');

const backend = path.resolve(__dirname, '..', '..');

test('ES-99 PostgreSQL + HTTP: errores controlados y contenido verificado en la subida de documentos', { timeout: 120000 }, async (t) => {
  assert.ok(process.env.ES99_TEST_DATABASE_URL, 'Se requiere ES99_TEST_DATABASE_URL (clúster desechable en loopback)');
  const target = new URL(process.env.ES99_TEST_DATABASE_URL);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo loopback');
  const dbName = `es99_test_${crypto.randomBytes(8).toString('hex')}`;
  const urlFor = (name) => { const u = new URL(target.toString()); u.pathname = `/${name}`; return u.toString(); };
  const admin = new Client({ connectionString: target.toString(), ssl: false }); await admin.connect();
  let created = false; let app; let server; let db;
  t.after(async () => {
    if (server) await new Promise((r) => { server.close(r); server.closeAllConnections?.(); });
    if (db) await db.end().catch(() => {});
    if (app) await app.close().catch(() => {});
    if (created) await admin.query(`DROP DATABASE "${dbName}" WITH (FORCE)`).catch(() => {});
    await admin.end().catch(() => {});
  });
  await admin.query(`CREATE DATABASE "${dbName}"`); created = true;
  const migrated = spawnSync('npx', ['sequelize-cli', 'db:migrate'], { cwd: backend, encoding: 'utf8', shell: process.platform === 'win32',
    env: { ...process.env, DATABASE_URL: urlFor(dbName), DB_SSL: 'false', NODE_ENV: 'test' } });
  assert.equal(migrated.status, 0, `Fallaron las migraciones: ${(migrated.stdout + migrated.stderr).slice(-600)}`);

  app = new Sequelize(urlFor(dbName), { logging: false, dialectOptions: { ssl: false }, pool: { max: 8, min: 0 } });
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
  process.env.DATA_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
  process.env.NODE_ENV = 'test';
  const dbModule = require.resolve('../../database');
  require.cache[dbModule] = { id: dbModule, filename: dbModule, loaded: true, exports: { sequelize: app } };
  // Almacenamiento: doble controlable (el módulo real exige credenciales de Google Cloud que ya no existen).
  const storage = { uploads: [], fail: null, signFail: null };
  const storageModule = require.resolve('../../utils/storage');
  require.cache[storageModule] = { id: storageModule, filename: storageModule, loaded: true, exports: {
    uploadFile: async (buffer, destination, mimeType) => {
      if (storage.fail) throw storage.fail;
      storage.uploads.push({ bytes: buffer.length, destination, mimeType });
      return destination;
    },
    getSignedUrl: async (filePath) => { if (storage.signFail) throw storage.signFail; return `https://storage.example.invalid/${encodeURIComponent(filePath)}`; },
  } };
  require('../../associations')();
  const { issueToken } = require('../../utils/sessions');
  const { verificarToken, verificarSuperAdmin } = require('../../middlewares/auth');
  const express = require('express');
  const api = express(); api.use(express.json());
  api.use('/api/therapist/validation', verificarToken, require('../../routes/validation'));
  api.use('/api/junta', verificarSuperAdmin, require('../../routes/validation'));
  server = api.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  db = new Client({ connectionString: urlFor(dbName), ssl: false }); await db.connect();
  const q = async (text, params) => (await db.query(text, params)).rows;

  const columns = await q(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='Users'
    AND is_nullable='NO' AND column_default IS NULL AND column_name <> 'id'`);
  let seq = 0;
  async function mkUser(role) {
    seq += 1; const names = []; const values = [];
    for (const c of columns) {
      let v;
      if (c.column_name === 'role') v = role;
      else if (c.data_type.includes('char') || c.data_type === 'text') v = c.column_name === 'email' ? `sintetico-${seq}-${dbName}@example.test` : `sintetico-${seq}-${c.column_name}`;
      else if (c.data_type === 'integer') v = 0; else if (c.data_type === 'boolean') v = true; else if (c.data_type.startsWith('timestamp')) v = new Date(); else v = '{}';
      names.push(`"${c.column_name}"`); values.push(v);
    }
    const id = (await q(`INSERT INTO "Users" (${names.join(',')}) VALUES (${values.map((_, i) => `$${i + 1}`).join(',')}) RETURNING id`, values))[0].id;
    await q('UPDATE "Users" SET role=$2, active=true WHERE id=$1', [id, role]);
    return { id, role, token: issueToken({ id, role }) };
  }
  const therapist = await mkUser('therapist'); const other = await mkUser('therapist');
  const participant = await mkUser('user'); const adminUser = await mkUser('admin'); const superadmin = await mkUser('superadmin');

  const PDF = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.from('contenido sintético'), Buffer.from('\n%%EOF')]);
  const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('sintético')]);
  const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('sintético')]);
  const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x10, 0, 0, 0]), Buffer.from('WEBPVP8 '), Buffer.from('sintético')]);
  const EXE = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(200, 0x90)]);

  const form = (parts) => { const f = new FormData(); for (const [name, value, type, filename] of parts) { if (type) f.append(name, new Blob([value], { type }), filename); else f.append(name, value); } return f; };
  const send = async (who, route, body, method = 'POST') => {
    const res = await fetch(`${base}${route}`, { method, headers: who ? { Authorization: `Bearer ${who.token}` } : {}, ...(body ? { body } : {}) });
    const text = await res.text(); let parsed = null; try { parsed = JSON.parse(text); } catch { /* no JSON */ }
    return { status: res.status, body: parsed, text, type: res.headers.get('content-type') || '' };
  };
  const upload = (who, parts) => send(who, '/api/therapist/validation/upload', form(parts));
  const rows = () => q('SELECT * FROM "TherapistValidations" ORDER BY id');
  const clean = (r) => {
    assert.match(r.type, /application\/json/, 'la respuesta siempre es JSON, nunca la página HTML de error');
    assert.ok(!/node_modules|gcs-credentials|\.js:\d+|at \w+\s\(|C:\\|\/home\/|stack|multer/i.test(r.text), `sin trazas ni rutas: ${r.text.slice(0, 120)}`);
    assert.match(r.body.error, / \/ /, 'mensaje bilingüe');
  };

  await t.test('subida válida: PDF, JPEG, PNG y WEBP con el contenido de su tipo; nombre y ruta saneados', async () => {
    for (const [value, type, name] of [[PDF, 'application/pdf', 'título.pdf'], [JPEG, 'image/jpeg', 'foto.jpg'], [PNG, 'image/png', 'sello.png'], [WEBP, 'image/webp', 'escaneo.webp']]) {
      const r = await upload(therapist, [['document', value, type, name], ['documentType', 'certificado']]);
      assert.equal(r.status, 201, name);
      assert.equal(r.body.validation.status, 'pending');
      assert.equal(r.body.validation.documentType, 'certificado');
    }
    assert.equal(storage.uploads.length, 4);
    assert.ok(storage.uploads.every((u) => u.destination.startsWith(`therapist-docs/${therapist.id}/`)));
    // Nombre con rutas y caracteres de control: ni «..» ni separadores, en la ruta y en el nombre que se muestra.
    const nasty = await upload(therapist, [['document', PDF, 'application/pdf', '..\\..\\carpeta/../../etc/passwd.pdf'], ['therapistId', String(other.id)]]);
    assert.equal(nasty.status, 201);
    const last = storage.uploads.at(-1).destination;
    assert.ok(!last.includes('..') && last.split('/').length === 3, last);
    assert.ok(!/[\\/\u0007]/.test(nasty.body.validation.documentName) && !nasty.body.validation.documentName.startsWith('.'), nasty.body.validation.documentName);
    // Un nombre con caracteres de control invalida la cabecera del formulario: se rechaza limpio, en JSON, sin trazas.
    const control = await upload(therapist, [['document', PDF, 'application/pdf', 'mal\u0007nombre.pdf']]);
    assert.ok([201, 400].includes(control.status));
    if (control.status === 400) clean(control); else assert.ok(!/\u0007/.test(control.body.validation.documentName));
    const stored = (await rows()).find((r) => r.documentPath === last);
    assert.equal(stored.therapistId, therapist.id, 'el dueño sale de la sesión, no del cuerpo');
    assert.equal(stored.documentPath, last);
  });

  await t.test('rechazos: tipo no permitido, contenido que no corresponde, vacío, grande, campo equivocado y sin archivo; JSON bilingüe, sin trazas, sin efectos', async () => {
    const before = [storage.uploads.length, (await rows()).length];
    const cases = [
      ['tipo .exe', [['document', EXE, 'application/x-msdownload', 'virus.exe']], 400, 'unsupported_file_type'],
      ['texto plano', [['document', 'hola', 'text/plain', 'a.txt']], 400, 'unsupported_file_type'],
      ['.exe disfrazado de imagen', [['document', EXE, 'image/png', 'foto.png']], 400, 'file_content_mismatch'],
      ['texto disfrazado de PDF', [['document', 'no soy un pdf', 'application/pdf', 'a.pdf']], 400, 'file_content_mismatch'],
      ['PNG declarado como PDF', [['document', PNG, 'application/pdf', 'a.pdf']], 400, 'file_content_mismatch'],
      ['vacío', [['document', Buffer.alloc(0), 'application/pdf', 'vacio.pdf']], 400, 'empty_file'],
      ['11 MB', [['document', Buffer.concat([Buffer.from('%PDF-'), Buffer.alloc(11 * 1024 * 1024)]), 'application/pdf', 'grande.pdf']], 413, 'file_too_large'],
      ['campo equivocado', [['file', PDF, 'application/pdf', 'a.pdf']], 400, 'invalid_upload'],
      ['dos archivos', [['document', PDF, 'application/pdf', 'a.pdf'], ['document', PDF, 'application/pdf', 'b.pdf']], 400, 'invalid_upload'],
      ['sin archivo', [['documentType', 'titulo']], 400, 'no_file'],
    ];
    for (const [name, parts, status, code] of cases) {
      const r = await upload(therapist, parts);
      assert.equal(r.status, status, `${name} -> ${r.status} ${r.text.slice(0, 80)}`);
      assert.equal(r.body.code, code, name);
      clean(r);
    }
    assert.deepEqual([storage.uploads.length, (await rows()).length], before, 'nada se guardó');
  });

  await t.test('quién puede subir: el rol se comprueba ANTES de leer el archivo (un participante con 11 MB recibe 403, no 413)', async () => {
    const big = [['document', Buffer.concat([Buffer.from('%PDF-'), Buffer.alloc(11 * 1024 * 1024)]), 'application/pdf', 'grande.pdf']];
    for (const who of [participant, adminUser, superadmin]) assert.equal((await upload(who, big)).status, 403, who.role);
    assert.ok([401, 403].includes((await upload(null, big)).status));
    assert.equal((await send({ token: 'invalido' }, '/api/therapist/validation/upload', form([['document', PDF, 'application/pdf', 'a.pdf']]))).status, 401);
  });

  await t.test('almacenamiento no disponible: 503 genérico, sin la ruta de las credenciales ni el mensaje interno, y sin fila en la base', async () => {
    const before = (await rows()).length;
    storage.fail = Object.assign(new Error('ENOENT: no such file or directory, open \'C:\\Users\\x\\backend\\gcs-credentials.json\''), { code: 'ENOENT' });
    try {
      const r = await upload(therapist, [['document', PDF, 'application/pdf', 'a.pdf']]);
      assert.deepEqual([r.status, r.body.code], [503, 'storage_unavailable']);
      clean(r);
      assert.equal((await rows()).length, before);
    } finally { storage.fail = null; }
  });

  await t.test('estado y descarga: cada terapeuta ve lo suyo; la descarga es solo del superadmin; ids malformados = 404; almacenamiento caído = 503', async () => {
    const mine = await send(therapist, '/api/therapist/validation/status', null, 'GET');
    assert.equal(mine.status, 200);
    assert.ok(mine.body.length >= 5 && !mine.text.includes('documentPath'));
    assert.deepEqual((await send(other, '/api/therapist/validation/status', null, 'GET')).body, []);
    const id = (await rows())[0].id;
    for (const who of [therapist, participant, adminUser]) assert.equal((await send(who, `/api/junta/${id}/download`, null, 'GET')).status, 403, who.role);
    const ok = await send(superadmin, `/api/junta/${id}/download`, null, 'GET');
    assert.equal(ok.status, 200);
    assert.match(ok.body.url, /^https:\/\/storage\.example\.invalid\//);
    for (const bad of ['abc', '-1', '0', '99999999999', '1.5']) {
      const r = await send(superadmin, `/api/junta/${bad}/download`, null, 'GET');
      assert.deepEqual([r.status, r.body.code], [404, 'not_found'], bad);
    }
    assert.equal((await send(superadmin, '/api/junta/2147000000/download', null, 'GET')).status, 404);
    storage.signFail = Object.assign(new Error('credenciales en C:\\x\\gcs-credentials.json'), { code: 'ENOENT' });
    try {
      const r = await send(superadmin, `/api/junta/${id}/download`, null, 'GET');
      assert.deepEqual([r.status, r.body.code], [503, 'storage_unavailable']);
      clean(r);
    } finally { storage.signFail = null; }
  });
});
