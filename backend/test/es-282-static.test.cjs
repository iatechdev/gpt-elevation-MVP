// ES-282 (ES-189 PR-3, criterios 8 y 9) · Verificaciones estáticas del repositorio: ningún secreto versionado, solo los archivos .env permitidos, y los datos de ejemplo (.invalid) en un
// registro CERRADO. Corre en `npm test` (sin base de datos). Si el paquete de frontend ya está construido (frontend/dist), también lo escanea.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
let files = null;
try { files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\0').filter(Boolean); } catch { /* sin git */ }
const skip = (t) => (files ? false : t.skip('sin git: no se puede listar lo versionado'));

// Patrones de secretos reales (proveedores y llaves). Las pruebas y el corpus de evaluación usan valores FICTICIOS a propósito y se excluyen por ruta.
const SECRETS = [
  /sk-ant-[A-Za-z0-9_-]{20,}/, /AKIA[0-9A-Z]{16}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /AIza[0-9A-Za-z_-]{35}/, /ghp_[A-Za-z0-9]{30,}/, /xox[bp]-[A-Za-z0-9-]{20,}/,
  /eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/,
];
const FICTIONAL_PATHS = /^(backend\/test\/|backend\/evaluation\/|e2e\/|.*package-lock\.json$)/;
const textFile = /\.(js|cjs|mjs|ts|tsx|json|ya?ml|md|html|css|env|example|txt|sh)$/i;

test('ES-282: ningún secreto de proveedor, llave privada ni JWT en lo versionado (fuera de pruebas con valores ficticios)', (t) => {
  if (skip(t)) return;
  const hits = [];
  for (const file of files) {
    if (FICTIONAL_PATHS.test(file) || !textFile.test(file)) continue;
    let text; try { text = fs.readFileSync(path.join(root, file), 'utf8'); } catch { continue; }
    for (const pattern of SECRETS) if (pattern.test(text)) hits.push(`${file}: ${pattern}`);
    // Una URL de base de datos con contraseña que no sea de bucle local ni una variable
    for (const m of text.matchAll(/postgres(?:ql)?:\/\/([^:@/\s]+):([^@\s]{4,})@([^/\s:]+)/g)) {
      if (!/^(127\.0\.0\.1|localhost|\[::1\])$/.test(m[3]) && !/[${}<>]|USER|PASS|usuario|password|contraseña/i.test(m[1] + m[2])) hits.push(`${file}: URL de base de datos con contraseña`);
    }
  }
  assert.deepEqual(hits, []);
});

test('ES-282: solo hay archivos .env de ejemplo versionados, sin valores; el de producción del frontend solo lleva variables públicas VITE_', (t) => {
  if (skip(t)) return;
  const envs = files.filter((f) => /(^|\/)\.env/.test(f)).sort();
  assert.deepEqual(envs, ['backend/.env.example', 'frontend/.env.example', 'frontend/.env.production']);
  const backend = fs.readFileSync(path.join(root, 'backend/.env.example'), 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l));
  for (const line of backend) { const value = line.slice(line.indexOf('=') + 1).trim(); assert.ok(value.length <= 24 && !/[A-Za-z0-9+/]{32,}/.test(value), `valor sospechoso en backend/.env.example: ${line.split('=')[0]}`); }
  for (const line of fs.readFileSync(path.join(root, 'frontend/.env.production'), 'utf8').split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('#'))) assert.match(line, /^VITE_[A-Z_]+=/, 'solo variables VITE_ (públicas)');
});

test('ES-282: los correos de ejemplo «.invalid» viven solo en el registro cerrado (tombstone de eliminación, correo de solicitud minimizada y semilla de demostración) y no en el código del cliente', (t) => {
  if (skip(t)) return;
  const allowed = new Set(['backend/utils/deletionProcessor.js', 'backend/utils/applicationMinimize.js', 'backend/utils/demoSeedData.js']);
  const found = [];
  for (const file of files) {
    if (!/\.(js|cjs|mjs|ts|tsx)$/.test(file) || /^(backend\/test\/|backend\/evaluation\/|e2e\/|frontend\/test\/|platform\/|TelegramBot\/|Elevation2\/|Flujo2\/|healtech\/)/.test(file) || /\.test\.|\.spec\./.test(file)) continue;
    if (!/^(backend|frontend\/src|api|shared)\//.test(file)) continue;
    if (/@[a-z0-9.-]*\.invalid\b/i.test(fs.readFileSync(path.join(root, file), 'utf8'))) found.push(file);
  }
  assert.deepEqual(found.filter((f) => !allowed.has(f)), [], 'correo .invalid fuera del registro cerrado');
  assert.ok(!found.some((f) => f.startsWith('frontend/')), 'ningún correo de ejemplo en el paquete del cliente');
});

test('ES-282: el paquete del cliente construido (si existe) no lleva secretos ni nombres de variables del servidor', (t) => {
  const dist = path.join(root, 'frontend', 'dist');
  if (!fs.existsSync(dist)) return t.skip('frontend/dist no está construido en esta ejecución');
  const hits = [];
  const walk = (dir) => { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const full = path.join(dir, entry.name); if (entry.isDirectory()) walk(full); else if (/\.(js|html|css|map)$/.test(entry.name)) { const text = fs.readFileSync(full, 'utf8'); for (const p of SECRETS) if (p.test(text)) hits.push(`${entry.name}: ${p}`); if (/JWT_SECRET|DATA_ENCRYPTION_KEY|PROMPT_ENCRYPTION_KEY|ANTHROPIC_API_KEY|DATABASE_URL/.test(text)) hits.push(`${entry.name}: nombre de variable del servidor`); } } };
  walk(dist);
  assert.deepEqual(hits, []);
});
