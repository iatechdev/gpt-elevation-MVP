// ES-268 · utils/storage.js con Supabase Storage: contrato (subir, firmar, borrar), variables, TTL acotado, errores genéricos sin fugas, borrado por prefijo y claves de objeto
// sin nombre original. Cliente de Supabase SIMULADO (la prueba real contra el bucket de staging la corre Infra con scripts/smoke-storage.cjs).
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const storage = require('../utils/storage');
const { extensionFor, ALLOWED_TYPES } = require('../utils/uploadSafety');

const URL_SECRET = 'https://proyectosecreto123.supabase.co'; const KEY_SECRET = 'service-role-key-SECRETA-abcdef'; const BUCKET = 'bucket-de-prueba';
const PDF = Buffer.from('%PDF-1.4 sintetico');
let calls; let store; let behavior;

function fakeClientFactory() {
  return (url, key, options) => {
    calls.created.push({ url, key, options });
    return { storage: { from: (bucket) => {
      calls.buckets.push(bucket);
      return {
        upload: async (path, body, opts) => { calls.upload.push({ path, size: body.length, opts }); if (behavior.upload) return behavior.upload(); store.set(path, body); return { data: { path }, error: null }; },
        createSignedUrl: async (path, ttl) => { calls.sign.push({ path, ttl }); if (behavior.sign) return behavior.sign(); return { data: { signedUrl: `${URL_SECRET}/object/sign/${bucket}/${path}?token=t` }, error: null }; },
        remove: async (paths) => { calls.remove.push(paths); if (behavior.remove) return behavior.remove(); for (const p of paths) store.delete(p); return { data: paths.map((name) => ({ name })), error: null }; },
        list: async (prefix, opts) => { calls.list.push({ prefix, opts }); if (behavior.list) return behavior.list(); const names = [...store.keys()].filter((k) => k.startsWith(prefix + '/')).map((k) => k.slice(prefix.length + 1)).filter((n) => !n.includes('/')).slice(0, opts.limit).map((name) => ({ name })); return { data: names, error: null }; },
      };
    } } };
  };
}

beforeEach(() => {
  calls = { created: [], buckets: [], upload: [], sign: [], remove: [], list: [] }; store = new Map(); behavior = {};
  process.env.SUPABASE_URL = URL_SECRET; process.env.SUPABASE_SERVICE_ROLE_KEY = KEY_SECRET; process.env.SUPABASE_STORAGE_BUCKET = BUCKET; delete process.env.STORAGE_SIGNED_URL_TTL_SECONDS;
  storage._setClientFactoryForTests(fakeClientFactory());
});

// (de la pila solo cuenta la primera línea, el mensaje: el resto son rutas del CÓDIGO del servidor, no de datos)
const leaks = (error) => [URL_SECRET, KEY_SECRET, 'proyectosecreto123', 'therapist-docs/7/secreto.pdf'].filter((x) => `${error.message}|${error.stack.split('\n')[0]}|${JSON.stringify(error)}|${String(error)}`.includes(x));

test('ES-268 variables: si falta cualquiera → storage_unavailable, sin bucket por defecto y sin crear ningún cliente', async () => {
  for (const name of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_STORAGE_BUCKET']) {
    const saved = process.env[name]; delete process.env[name];
    await assert.rejects(storage.uploadFile(PDF, 'therapist-docs/1/a.pdf', 'application/pdf'), (e) => e.code === 'storage_unavailable' && leaks(e).length === 0, name);
    await assert.rejects(storage.getSignedUrl('therapist-docs/1/a.pdf'), (e) => e.code === 'storage_unavailable', name);
    await assert.rejects(storage.deleteFile('therapist-docs/1/a.pdf'), (e) => e.code === 'storage_unavailable', name);
    process.env[name] = saved;
  }
  assert.equal(calls.created.length, 0);
});

test('ES-268 subir: usa el bucket de la variable, tipo de contenido y SIN sobrescribir; cliente sin sesión; devuelve la ruta', async () => {
  const out = await storage.uploadFile(PDF, 'therapist-docs/7/1700000000000_abc.pdf', 'application/pdf');
  assert.equal(out, 'therapist-docs/7/1700000000000_abc.pdf');
  assert.deepEqual(calls.upload[0].opts, { contentType: 'application/pdf', upsert: false });
  assert.equal(calls.buckets[0], BUCKET);
  assert.deepEqual(calls.created[0].options, { auth: { persistSession: false, autoRefreshToken: false } });
  assert.equal(calls.created.length, 1, 'el cliente se reutiliza');
  await storage.uploadFile(PDF, 'therapist-docs/7/otra.pdf', 'application/pdf');
  assert.equal(calls.created.length, 1);
});

test('ES-268 subir: rechaza vacío, > 10 MB, no-Buffer y rutas peligrosas ANTES de llamar a Supabase', async () => {
  const bad = [[Buffer.alloc(0), 'a/b.pdf'], [Buffer.alloc(storage.MAX_BYTES + 1), 'a/b.pdf'], ['texto', 'a/b.pdf'], [PDF, '../x.pdf'], [PDF, 'a/../x.pdf'], [PDF, '/abs.pdf'], [PDF, ''], [PDF, 'a/\u0000b.pdf'], [PDF, 'x'.repeat(513)]];
  for (const [buffer, path] of bad) await assert.rejects(storage.uploadFile(buffer, path, 'application/pdf'), (e) => e instanceof storage.StorageError && ['invalid_upload', 'invalid_path'].includes(e.code));
  assert.equal(calls.upload.length, 0);
  await storage.uploadFile(Buffer.alloc(storage.MAX_BYTES), 'a/justo.pdf', 'application/pdf'); // exactamente 10 MB sí
});

test('ES-268 errores: los de Supabase (error devuelto o excepción) salen GENÉRICOS, con estado HTTP y sin URL, clave, bucket ni ruta', async () => {
  const dirty = (extra = {}) => Object.assign(new Error(`fallo en ${URL_SECRET}/object/${BUCKET}/therapist-docs/7/secreto.pdf con ${KEY_SECRET}`), extra);
  behavior.upload = async () => ({ data: null, error: dirty({ statusCode: '409' }) });
  await assert.rejects(storage.uploadFile(PDF, 'therapist-docs/7/secreto.pdf', 'application/pdf'), (e) => e.code === 'storage_failed' && e.status === 409 && leaks(e).length === 0 && !e.message.includes(BUCKET));
  behavior.upload = async () => { throw dirty({ status: 500 }); };
  await assert.rejects(storage.uploadFile(PDF, 'therapist-docs/7/secreto.pdf', 'application/pdf'), (e) => e.code === 'storage_failed' && e.status === 500 && leaks(e).length === 0);
  behavior.sign = async () => ({ data: null, error: dirty() });
  await assert.rejects(storage.getSignedUrl('therapist-docs/7/secreto.pdf'), (e) => e.code === 'storage_failed' && leaks(e).length === 0);
  behavior.sign = async () => ({ data: {}, error: null }); // sin URL: no se devuelve undefined
  await assert.rejects(storage.getSignedUrl('therapist-docs/7/secreto.pdf'), (e) => e.code === 'storage_failed');
  behavior.remove = async () => ({ data: null, error: dirty() });
  await assert.rejects(storage.deleteFile('therapist-docs/7/secreto.pdf'), (e) => e.code === 'storage_failed' && leaks(e).length === 0);
});

test('ES-268 URL firmada: 900 s por defecto, acotada entre 60 y 3600 por STORAGE_SIGNED_URL_TTL_SECONDS, y devuelve la URL', async () => {
  const url = await storage.getSignedUrl('therapist-docs/7/a.pdf');
  assert.match(url, /^https:\/\/proyectosecreto123\.supabase\.co\/object\/sign\//);
  assert.equal(calls.sign[0].ttl, 900);
  for (const [value, expected] of [['10', 60], ['99999', 3600], ['abc', 900], ['-5', 900], ['0', 900], ['120.9', 120], ['3600', 3600], ['60', 60]]) {
    process.env.STORAGE_SIGNED_URL_TTL_SECONDS = value; await storage.getSignedUrl('therapist-docs/7/a.pdf');
    assert.equal(calls.sign.at(-1).ttl, expected, value);
  }
  assert.equal(storage.DEFAULT_TTL_SECONDS, 900);
});

test('ES-268 borrar: idempotente (borrar lo que no existe no falla) y borra solo la ruta pedida', async () => {
  store.set('therapist-docs/7/a.pdf', PDF); store.set('therapist-docs/7/b.pdf', PDF);
  await storage.deleteFile('therapist-docs/7/a.pdf'); await storage.deleteFile('therapist-docs/7/a.pdf'); await storage.deleteFile('therapist-docs/7/no-existe.pdf');
  assert.deepEqual([...store.keys()], ['therapist-docs/7/b.pdf']);
  assert.deepEqual(calls.remove[0], ['therapist-docs/7/a.pdf']);
});

test('ES-268 borrar por prefijo: lotes de 100, solo bajo ese prefijo (no el de otro profesional), devuelve el total; un fallo se propaga genérico', async () => {
  for (let i = 0; i < 250; i++) store.set(`therapist-docs/7/f${i}.pdf`, PDF);
  store.set('therapist-docs/70/ajeno.pdf', PDF); store.set('therapist-docs/8/otro.pdf', PDF);
  assert.equal(await storage.deleteByPrefix('therapist-docs/7'), 250);
  assert.deepEqual([...store.keys()].sort(), ['therapist-docs/70/ajeno.pdf', 'therapist-docs/8/otro.pdf']);
  assert.ok(calls.list.every((c) => c.opts.limit === 100));
  assert.equal(await storage.deleteByPrefix('therapist-docs/7'), 0);
  behavior.list = async () => ({ data: null, error: Object.assign(new Error(KEY_SECRET), { status: 503 }) });
  await assert.rejects(storage.deleteByPrefix('therapist-docs/8'), (e) => e.code === 'storage_failed' && e.status === 503 && leaks(e).length === 0);
});

test('ES-268 claves de objeto: la extensión sale del TIPO validado y el nombre original nunca forma parte de la clave', () => {
  assert.deepEqual(ALLOWED_TYPES.map(extensionFor), ['.pdf', '.jpg', '.png', '.webp']);
  assert.equal(extensionFor('application/x-msdownload'), '');
  assert.equal(extensionFor(undefined), '');
});
