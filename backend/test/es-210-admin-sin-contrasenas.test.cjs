// ES-210: administración no escribe contraseñas ajenas. Búsqueda en el código (heurística): solo estas rutas cifran una contraseña,
// y las tres aplican la política de ES-128 (passwordProblems) antes de hacerlo. Si aparece otra, esta prueba falla y obliga a revisarla.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const SKIP = new Set(['node_modules', 'test', 'test-db', 'migrations', 'scripts', 'dist']);
// utils/demoSeed.js siembra datos sintéticos y no recibe contraseñas por HTTP.
const ALLOWED = new Set(['routes/auth.js', 'routes/invitations.js', 'routes/passwordReset.js', 'utils/demoSeed.js']);

function* sources(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) { if (!SKIP.has(entry.name)) yield* sources(path.join(dir, entry.name)); }
    else if (/\.(js|cjs)$/.test(entry.name)) yield path.join(dir, entry.name);
  }
}

test('ES-210: solo las rutas permitidas cifran contraseñas, y ninguna es de administración', () => {
  const offenders = [];
  for (const file of sources(root)) {
    const rel = path.relative(root, file).split(path.sep).join('/');
    if (/\bbcrypt(js)?\b/.test(fs.readFileSync(file, 'utf8')) && !ALLOWED.has(rel)) offenders.push(rel);
  }
  assert.deepEqual(offenders, [], `archivos que usan bcrypt fuera de la lista: ${offenders.join(', ')}`);
});

test('ES-210: las tres rutas que cifran una contraseña de HTTP aplican la política de ES-128 antes de cifrar', () => {
  for (const rel of ['routes/auth.js', 'routes/invitations.js', 'routes/passwordReset.js']) {
    const text = fs.readFileSync(path.join(root, rel), 'utf8');
    const policy = text.indexOf('passwordProblems(');
    const hash = text.indexOf('bcrypt.hash(');
    assert.ok(policy > -1 && hash > -1 && policy < hash, `${rel}: la política debe validarse antes de cifrar`);
  }
});

test('ES-210: ninguna ruta de administración lee una contraseña del cuerpo', () => {
  const dir = path.join(root, 'routes');
  for (const name of fs.readdirSync(dir).filter((n) => /^admin.*\.js$/.test(n))) {
    const text = fs.readFileSync(path.join(dir, name), 'utf8');
    const reads = text.split(/\r?\n/).filter((line) => /req\.body/.test(line) && /(password|newPassword|contrase)/i.test(line));
    assert.deepEqual(reads, [], `${name} lee una contraseña de req.body`);
  }
});
