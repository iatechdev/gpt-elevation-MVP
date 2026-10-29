// ES-95: solicitud pública de profesionales. Express real y HTTP real; persistencia y cifrado simulados (sin red ni datos reales).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { randomBytes } = require('node:crypto');
const jwt = require('jsonwebtoken');
const { models, startApp } = require('./support.cjs');
const { desencriptarBuffer, CABECERA_BINARIA } = require('../utils/crypto');
const { validateApplication, isPdf, MAX_CV_BYTES, STATUSES } = require('../utils/professionalApplication');

process.env.PRO_APP_RATE_MAX = '1000'; // el límite de intentos se prueba en es-95-rate.test.cjs
const PDF = Buffer.from('%PDF-1.4\n% synthetic test document\n1 0 obj\n<<>>\nendobj\n%%EOF\n');
const good = (extra = {}) => ({
  name: 'Persona Sintética', email: 'Synthetic.Pro@Example.TEST', country: 'Colombia', profession: 'Psicología clínica',
  licenseNumber: 'SYN-0001', profileUrl: 'https://example.test/perfil', message: 'Mensaje de prueba.', locale: 'es', consent: 'true', ...extra,
});
const form = (fields, file = PDF, name = 'cv.pdf', type = 'application/pdf') => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  if (file) data.append('cv', new Blob([file], { type }), name);
  return data;
};

// Almacén en memoria con la forma mínima de Sequelize que usan las rutas.
function install() {
  const apps = []; const files = [];
  models.ProfessionalApplication.findOne = async ({ where }) => apps.find(a => a.email === where.email && where.status.includes(a.status)) ?? null;
  models.ProfessionalApplication.create = async (values) => { const row = { id: apps.length + 1, createdAt: new Date('2026-10-28T12:00:00Z'), reviewedBy: null, reviewNote: null, reviewedAt: null, userId: null, ...values }; apps.push(row); return row; };
  models.ProfessionalApplication.findAll = async ({ where }) => apps.filter(a => !where.status || a.status === where.status).slice().reverse();
  models.ProfessionalApplication.findByPk = async (id) => apps.find(a => a.id === id) ?? null;
  models.ProfessionalApplication.update = async (values, { where }) => {
    const row = apps.find(a => a.id === where.id && a.status === where.status); if (!row) return [0]; Object.assign(row, values); return [1];
  };
  models.ProfessionalApplication.destroy = async ({ where }) => {
    const index = apps.findIndex(a => a.id === where.id); if (index < 0) return 0;
    apps.splice(index, 1); const f = files.findIndex(x => x.ApplicationId === where.id); if (f >= 0) files.splice(f, 1); return 1;
  };
  models.ProfessionalApplicationFile.create = async (values) => { files.push({ ...values }); return values; };
  models.ProfessionalApplicationFile.findAll = async ({ where }) => files.filter(f => where.ApplicationId.includes(f.ApplicationId)).map(f => ({ ApplicationId: f.ApplicationId, size: f.size }));
  models.ProfessionalApplicationFile.findOne = async ({ where }) => files.find(f => f.ApplicationId === where.ApplicationId) ?? null;
  models.ProfessionalApplication.count = async ({ where }) => apps.filter(a => a.status === where.status).length; // ES-107: uso para el tope global
  models.ProfessionalApplicationFile.sum = async () => files.reduce((total, f) => total + f.size, 0);
  models.User.create = async () => { throw new Error('ES-95 no debe crear cuentas'); };
  return { apps, files };
}
const post = (request, fields, ...rest) => request('POST', '/api/professional-applications', { body: form(fields, ...rest) });

test('ES-95 validación pura: campos obligatorios, límites, correo, URL, consentimiento y PDF por firma', () => {
  const file = { buffer: PDF };
  const ok = validateApplication(good(), file);
  assert.equal(ok.ok, true); assert.equal(ok.values.email, 'synthetic.pro@example.test'); assert.equal(ok.values.locale, 'es');
  for (const key of ['name', 'email', 'country', 'profession', 'consent']) {
    const body = good(); delete body[key]; const result = validateApplication(body, file);
    assert.deepEqual([result.ok, result.fields.includes(key)], [false, true], key);
  }
  const optional = good(); delete optional.licenseNumber; delete optional.profileUrl; delete optional.message;
  assert.equal(validateApplication(optional, file).ok, true);
  for (const [key, value] of [['name', 'x'.repeat(121)], ['email', 'sin-arroba'], ['email', 'a@b'], ['profileUrl', 'javascript:alert(1)'], ['profileUrl', 'ftp://example.test'], ['profileUrl', 'https://user:pass@example.test'], ['message', 'x'.repeat(1001)], ['licenseNumber', 'x'.repeat(61)]]) {
    const result = validateApplication(good({ [key]: value }), file); assert.equal(result.ok, false, key); assert.ok(result.fields.includes(key), key);
  }
  assert.equal(validateApplication(good({ name: ['a'] }), file).ok, false); // un campo repetido llega como arreglo: se rechaza
  assert.equal(validateApplication(good({ locale: 'fr' }), file).values.locale, 'es');
  assert.equal(validateApplication(good({ locale: 'EN' }), file).values.locale, 'en');
  assert.deepEqual(validateApplication(good(), null).fields, ['cv']);
  assert.deepEqual(validateApplication(good(), { buffer: Buffer.from('MZ not a pdf at all, but long enough') }).fields, ['cv']);
  assert.deepEqual(validateApplication(good(), { buffer: Buffer.concat([Buffer.from('%PDF-'), Buffer.alloc(MAX_CV_BYTES)]) }).fields, ['cv']);
  assert.equal(isPdf(PDF), true); assert.equal(isPdf(Buffer.from('%PDF-')), false); assert.equal(isPdf('%PDF-1.4 string'), false);
  assert.ok(!JSON.stringify(validateApplication(good({ name: '' }), file)).includes('Sintética')); // nunca repite los valores recibidos
  assert.deepEqual(STATUSES, ['pending', 'approved', 'rejected']);
});

test('ES-95: una solicitud válida se guarda pendiente, sin rol ni estado del cliente, con la hoja de vida cifrada y sin nombre de archivo', async t => {
  const { apps, files } = install(); const request = await startApp(t);
  const response = await post(request, good({ role: 'admin', status: 'approved', userId: '1' }), PDF, '../../etc/passwd.pdf');
  assert.equal(response.status, 201); assert.match(response.body.message, /Recibimos tu solicitud/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(apps.length, 1); assert.equal(apps[0].status, 'pending'); assert.equal(apps[0].email, 'synthetic.pro@example.test');
  assert.equal('role' in apps[0], false); assert.equal(apps[0].status, 'pending');
  assert.equal(apps[0].userId, null); assert.equal(apps[0].reviewedBy, null); assert.ok(apps[0].consentAt instanceof Date);
  assert.equal(files.length, 1); assert.equal(files[0].size, PDF.length); assert.match(files[0].sha256, /^[0-9a-f]{64}$/);
  assert.equal(desencriptarBuffer(files[0].data).equals(PDF), true); assert.equal(files[0].data.length, PDF.length + CABECERA_BINARIA); // ES-107: binario, sin base64
  assert.equal(JSON.stringify([apps, files]).includes('passwd'), false); // el nombre original no se guarda
  const en = await post(request, good({ email: 'other@example.test', locale: 'en' })); assert.match(en.body.message, /We received your request/);
});

test('ES-95: sin hoja de vida, con un archivo que no es PDF (aunque diga serlo), pasado de tamaño o con campos inválidos se rechaza con 400 y sin guardar', async t => {
  const { apps } = install(); const request = await startApp(t);
  const cases = [
    [good(), null], [good(), Buffer.from('MZ\x90\x00 this is an executable, not a pdf'), 'cv.pdf', 'application/pdf'],
    [good(), Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(MAX_CV_BYTES)]), 'big.pdf'], [good(), Buffer.from('<html>%PDF-</html>'), 'cv.pdf'],
  ];
  for (const [fields, file, name, type] of cases) {
    const response = await post(request, fields, file, name, type);
    assert.equal(response.status, 400); assert.equal(response.body.code, 'invalid_fields'); assert.deepEqual(response.body.fields, ['cv']);
  }
  const invalid = await post(request, good({ email: 'mal', consent: 'false' }));
  assert.equal(invalid.status, 400); assert.deepEqual(invalid.body.fields.sort(), ['consent', 'email']);
  assert.ok(!JSON.stringify(invalid.body).includes('Persona Sintética')); // no repite lo recibido
  const two = form(good()); two.append('cv', new Blob([PDF]), 'second.pdf');
  assert.equal((await request('POST', '/api/professional-applications', { body: two })).status, 400); // un solo archivo
  const alien = form(good(), null); alien.append('resume', new Blob([PDF]), 'cv.pdf');
  assert.equal((await request('POST', '/api/professional-applications', { body: alien })).status, 400); // campo de archivo inesperado
  assert.equal((await request('POST', '/api/professional-applications', { body: { name: 'json no es multipart' } })).status, 400);
  assert.equal(apps.length, 0);
});

test('ES-95: el campo trampa responde como un éxito sin guardar; un correo pendiente o aprobado no se duplica ni se revela, uno rechazado sí puede volver a solicitar', async t => {
  const { apps } = install(); const request = await startApp(t);
  const bot = await post(request, good({ bot_trap: 'https://spam.example.test' })); assert.equal(bot.status, 201); assert.equal(apps.length, 0);
  const first = await post(request, good()); const again = await post(request, good({ name: 'Otro Nombre' }));
  assert.equal(first.status, 201); assert.equal(again.status, 201); assert.deepEqual(again.body, first.body); assert.equal(apps.length, 1);
  apps[0].status = 'approved'; assert.equal((await post(request, good())).status, 201); assert.equal(apps.length, 1);
  apps[0].status = 'rejected'; assert.equal((await post(request, good())).status, 201); assert.equal(apps.length, 2);
});

test('ES-95: un fallo de base de datos responde 500 sin registrar datos personales', async t => {
  install(); const request = await startApp(t); const logs = []; const previous = console.error;
  models.ProfessionalApplication.findOne = async () => { throw Object.assign(new Error('SYNTHETIC_PRIVATE synthetic.pro@example.test'), { parameters: ['Persona Sintética'] }); };
  console.error = (...args) => logs.push(args);
  try {
    const response = await post(request, good()); assert.equal(response.status, 500); assert.equal(response.body.code, 'internal_error');
    assert.doesNotMatch(JSON.stringify(logs), /SYNTHETIC_PRIVATE|synthetic\.pro|Sint/); assert.equal(logs.length, 1);
  } finally { console.error = previous; }
});

test('ES-95 backoffice: sin sesión 403 y llave inválida 401; persona, terapeuta o junta de otro rol 403; admin y superadmin sí; la lista no incluye la hoja de vida', async t => {
  const { apps } = install(); const request = await startApp(t);
  await post(request, good()); await post(request, good({ email: 'second@example.test' }));
  assert.equal((await request('GET', '/api/admin/professional-applications')).status, 403); // sin llave: el middleware existente responde 403
  assert.equal((await request('GET', '/api/admin/professional-applications', { headers: { Authorization: 'Bearer invalid' } })).status, 401);
  for (const role of ['user', 'therapist', 'board']) assert.equal((await request('GET', '/api/admin/professional-applications', { role })).status, 403, role);
  for (const role of ['admin', 'superadmin']) {
    const response = await request('GET', '/api/admin/professional-applications', { role }); assert.equal(response.status, 200);
    assert.equal(response.body.length, 2); assert.equal(response.body[0].email, 'second@example.test'); assert.equal(response.body[0].cv.size, PDF.length);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.doesNotMatch(JSON.stringify(response.body), /content|sha256|JVBER/); // ni el contenido ni su cifra ni su base64
  }
  apps[0].status = 'approved';
  assert.equal((await request('GET', '/api/admin/professional-applications?status=pending', { role: 'admin' })).body.length, 1);
  assert.equal((await request('GET', '/api/admin/professional-applications?status=bogus', { role: 'admin' })).status, 400);
});

test('ES-95 backoffice: aprobar solo cambia el estado (no crea cuenta); rechazar exige nota; una solicitud revisada no se revisa dos veces', async t => {
  const { apps } = install(); const request = await startApp(t);
  await post(request, good()); await post(request, good({ email: 'second@example.test' }));
  for (const role of ['user', 'therapist']) assert.equal((await request('PUT', '/api/admin/professional-applications/1/approve', { role, body: {} })).status, 403, role);
  assert.equal((await request('PUT', '/api/admin/professional-applications/1/reject', { role: 'admin', body: {} })).status, 400);
  assert.equal((await request('PUT', '/api/admin/professional-applications/1/reject', { role: 'admin', body: { note: '   ' } })).status, 400);
  assert.equal((await request('PUT', '/api/admin/professional-applications/1/reject', { role: 'admin', body: { note: 'x'.repeat(1001) } })).status, 400);
  assert.equal((await request('PUT', '/api/admin/professional-applications/abc/approve', { role: 'admin', body: {} })).status, 400);
  assert.equal((await request('PUT', '/api/admin/professional-applications/99/approve', { role: 'admin', body: {} })).status, 404);
  const approved = await request('PUT', '/api/admin/professional-applications/1/approve', { role: 'admin', body: { note: 'Documentación revisada.' } });
  assert.deepEqual(approved.body, { id: 1, status: 'approved' });
  assert.equal(apps[0].reviewedBy, 'Synthetic actor'); assert.equal(apps[0].reviewNote, 'Documentación revisada.'); assert.ok(apps[0].reviewedAt instanceof Date); assert.equal(apps[0].userId, null);
  assert.equal((await request('PUT', '/api/admin/professional-applications/1/reject', { role: 'superadmin', body: { note: 'tarde' } })).status, 409);
  const rejected = await request('PUT', '/api/admin/professional-applications/2/reject', { role: 'superadmin', body: { note: 'Falta la colegiatura.' } });
  assert.equal(rejected.status, 200); assert.equal(apps[1].status, 'rejected');
});

test('ES-95 backoffice: eliminar borra la solicitud y su hoja de vida; roles ajenos 403', async t => {
  const { apps, files } = install(); const request = await startApp(t); await post(request, good());
  assert.equal((await request('DELETE', '/api/admin/professional-applications/1', { role: 'therapist' })).status, 403);
  assert.equal((await request('DELETE', '/api/admin/professional-applications/1', { role: 'admin' })).status, 200);
  assert.equal(apps.length, 0); assert.equal(files.length, 0);
  assert.equal((await request('DELETE', '/api/admin/professional-applications/1', { role: 'admin' })).status, 404);
  assert.equal((await request('DELETE', '/api/admin/professional-applications/-1', { role: 'admin' })).status, 400);
});

test('ES-95 descarga: solo admin y superadmin, siempre como adjunto, sin sniffing y sin caché; devuelve exactamente el PDF subido', async t => {
  install(); const request = await startApp(t); await post(request, good());
  const app = require('../server'); const server = app.listen(0, '127.0.0.1'); await once(server, 'listening'); t.after(() => server.close());
  const token = (role) => jwt.sign({ id: 101, role, name: 'Synthetic actor' }, process.env.JWT_SECRET, { expiresIn: '1m', jwtid: randomBytes(8).toString('hex') });
  const get = (path, role) => fetch(`http://127.0.0.1:${server.address().port}${path}`, role ? { headers: { Authorization: 'Bearer ' + token(role) } } : {});
  assert.equal((await get('/api/admin/professional-applications/1/cv')).status, 403); // sin llave
  for (const role of ['user', 'therapist', 'board']) assert.equal((await get('/api/admin/professional-applications/1/cv', role)).status, 403, role);
  for (const role of ['admin', 'superadmin']) {
    const response = await get('/api/admin/professional-applications/1/cv', role); assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'application/pdf');
    assert.equal(response.headers.get('content-disposition'), 'attachment; filename="solicitud-1-hoja-de-vida.pdf"');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff'); assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(Buffer.from(await response.arrayBuffer()).equals(PDF), true);
  }
  assert.equal((await get('/api/admin/professional-applications/99/cv', 'admin')).status, 404);
  assert.equal((await get('/api/admin/professional-applications/x/cv', 'admin')).status, 400);
});

test('ES-95: nada de la solicitud llega al motor profesional ni a otras tablas (solo los dos modelos propios y ninguna cuenta)', async t => {
  install(); const request = await startApp(t); const touched = [];
  for (const name of ['TherapistValidation', 'TherapistProfile', 'MatchingRequest', 'ClinicalNote']) for (const method of ['create', 'findOne', 'findAll']) models[name][method] = async () => { touched.push(name + '.' + method); return null; };
  await post(request, good());
  await request('PUT', '/api/admin/professional-applications/1/approve', { role: 'admin', body: {} });
  assert.deepEqual(touched, []);
});

test('ES-95: un formulario con demasiados campos se rechaza antes de procesarlo', async t => {
  const { apps } = install(); const request = await startApp(t);
  const extra = {}; for (let i = 0; i < 6; i++) extra['x' + i] = 'y';
  assert.equal((await post(request, good(extra))).status, 400); assert.equal(apps.length, 0);
});

test('ES-95 retención: solo se eliminan las rechazadas con más de 180 días desde su revisión; pendientes, aprobadas y recientes quedan', async () => {
  const { purgeExpired, cutoffFor } = require('../scripts/purgeProfessionalApplications');
  const now = new Date('2026-10-28T12:00:00Z'); const calls = [];
  const model = { destroy: async ({ where }) => { calls.push(['destroy', where]); return 2; }, count: async ({ where }) => { calls.push(['count', where]); return 2; } };
  assert.equal(cutoffFor(now).toISOString(), '2026-05-01T12:00:00.000Z');
  assert.deepEqual(await purgeExpired({ now, model }), { count: 2, dryRun: false });
  assert.deepEqual(await purgeExpired({ now, model, dryRun: true }), { count: 2, dryRun: true });
  assert.deepEqual(calls.map(c => c[0]), ['destroy', 'count']);
  for (const [, where] of calls) { assert.equal(where.status, 'rejected'); assert.equal(Object.getOwnPropertySymbols(where.reviewedAt).length, 1); }
});

// ── ES-107 ───────────────────────────────────────────────────────────────
const { capacityLimits, isFull } = require('../utils/professionalApplication');
const { encriptarBuffer } = require('../utils/crypto');


test('ES-107 cifrado de bytes: ida y vuelta idéntica, sobrecoste fijo de 29 bytes, aleatorio por envío y a prueba de alteraciones', () => {
  for (const size of [0, 1, 17, 4096, 1024 * 1024]) {
    const bytes = randomBytes(size); const sealed = encriptarBuffer(bytes);
    assert.equal(sealed.length, size + CABECERA_BINARIA); assert.equal(desencriptarBuffer(sealed).equals(bytes), true);
  }
  const bytes = Buffer.from('%PDF-1.4 sintético'); const a = encriptarBuffer(bytes); const b = encriptarBuffer(bytes);
  assert.equal(a.equals(b), false); // iv distinto cada vez
  assert.equal(a.includes(bytes), false); // el contenido no queda en claro
  for (const index of [0, 5, 20, a.length - 1]) { const bad = Buffer.from(a); bad[index] ^= 1; assert.throws(() => desencriptarBuffer(bad), { code: 'decryption_failed' }); }
  for (const bad of [Buffer.alloc(0), Buffer.alloc(28), 'texto', null, undefined]) assert.throws(() => desencriptarBuffer(bad), { code: 'decryption_failed' });
  assert.throws(() => encriptarBuffer('texto'), TypeError);
});

test('ES-107 tope global: valores por defecto, configuración inválida ignorada y cierre por pendientes o por peso', () => {
  assert.deepEqual(capacityLimits({}), { maxPending: 200, maxBytes: 1024 ** 3 });
  assert.deepEqual(capacityLimits({ PRO_APP_MAX_PENDING: '3', PRO_APP_MAX_BYTES: '20000000' }), { maxPending: 3, maxBytes: 20000000 });
  for (const bad of ['0', '-1', 'abc', '1.5', '', '1e400']) assert.deepEqual(capacityLimits({ PRO_APP_MAX_PENDING: bad, PRO_APP_MAX_BYTES: bad }), { maxPending: 200, maxBytes: 1024 ** 3 });
  const limits = { maxPending: 3, maxBytes: 20 * 1024 * 1024 };
  assert.equal(isFull({ pending: 2, bytes: 0 }, limits), false); assert.equal(isFull({ pending: 3, bytes: 0 }, limits), true);
  assert.equal(isFull({ pending: 1, bytes: 15 * 1024 * 1024 }, limits), false); assert.equal(isFull({ pending: 1, bytes: 15 * 1024 * 1024 + 1 }, limits), true);
});

test('ES-107: con el tope alcanzado el formulario responde 503 controlado sin cifras y sin guardar; un correo ya abierto sigue con su respuesta normal; al liberar cupo vuelve a recibir', async t => {
  process.env.PRO_APP_MAX_PENDING = '2'; t.after(() => { delete process.env.PRO_APP_MAX_PENDING; });
  const { apps, files } = install(); const request = await startApp(t);
  assert.equal((await post(request, good({ email: 'a@example.test' }))).status, 201);
  assert.equal((await post(request, good({ email: 'b@example.test' }))).status, 201);
  const closed = await post(request, good({ email: 'c@example.test' }));
  assert.equal(closed.status, 503); assert.equal(closed.body.code, 'not_accepting'); assert.match(closed.body.error, /no estamos recibiendo solicitudes/i);
  assert.doesNotMatch(JSON.stringify(closed.body), /\d/); // sin cifras (ni tope ni uso)
  assert.equal(apps.length, 2); assert.equal(files.length, 2);
  assert.equal((await post(request, good({ email: 'a@example.test' }))).status, 201); // ya abierta: misma respuesta, no se entera del cierre
  apps[0].status = 'approved'; // se libera un cupo (deja de estar pendiente)
  assert.equal((await post(request, good({ email: 'c@example.test' }))).status, 201); assert.equal(apps.length, 3);
});

test('ES-107: el tope por peso total también cierra el formulario', async t => {
  process.env.PRO_APP_MAX_BYTES = String(5 * 1024 * 1024 + PDF.length - 1); t.after(() => { delete process.env.PRO_APP_MAX_BYTES; });
  const { apps } = install(); const request = await startApp(t);
  assert.equal((await post(request, good({ email: 'a@example.test' }))).status, 201); // 0 + 5 MB cabe
  assert.equal((await post(request, good({ email: 'b@example.test' }))).status, 503); // PDF.length + 5 MB ya no cabe
  assert.equal(apps.length, 1);
});

test('ES-107: GET /capacity es solo del backoffice y avisa si el formulario está cerrado', async t => {
  process.env.PRO_APP_MAX_PENDING = '1'; t.after(() => { delete process.env.PRO_APP_MAX_PENDING; });
  install(); const request = await startApp(t);
  const url = '/api/admin/professional-applications/capacity';
  assert.equal((await request('GET', url)).status, 403); // sin sesión: no es público
  for (const role of ['user', 'therapist']) assert.equal((await request('GET', url, { role, id: 5 })).status, 403);
  const open = await request('GET', url, { role: 'admin', id: 9 });
  assert.equal(open.status, 200); assert.equal(open.body.full, false); assert.equal(open.body.pending, 0);
  await post(request, good({ email: 'a@example.test' }));
  const full = await request('GET', url, { role: 'admin', id: 9 });
  assert.equal(full.body.full, true); assert.equal(full.body.pending, 1); assert.equal(full.body.maxPending, 1);
});
