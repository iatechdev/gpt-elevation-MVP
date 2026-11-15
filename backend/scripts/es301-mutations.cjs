// ES-301 · Mutaciones: cada una ROMPE a propósito un control del registro con aceptación y la prueba de PostgreSQL real (test/integration/es-301-postgres.cjs) debe FALLAR.
// Si una mutación pasa («SOBREVIVE»), el control no está probado y el script termina con código ≠ 0. El archivo original se restaura siempre (también si se interrumpe).
// Uso:  ES301_TEST_DATABASE_URL=postgres://…@127.0.0.1:…/postgres node scripts/es301-mutations.cjs [filtro]      (solo en un clúster desechable en loopback; cada corrida tarda ~1 min)
const fs = require('node:fs'); const path = require('node:path'); const { spawnSync } = require('node:child_process');
const backend = path.resolve(__dirname, '..');
const URL_ = process.env.ES301_TEST_DATABASE_URL; if (!URL_ || !['127.0.0.1', 'localhost'].includes(new URL(URL_).hostname)) { console.error('Se requiere ES301_TEST_DATABASE_URL en loopback.'); process.exit(2); }
const T = 'utils/terms.js'; const A = 'routes/auth.js';
// [nombre, archivo, texto original, texto mutado]. El original debe existir (si no, la mutación está obsoleta y el script falla).
const MUTATIONS = [
  ['M2 no se compara la versión con la vigente', T, 'if (body.termsVersion !== config.version) throw', 'if (false) throw'],
  ['M3 la fecha la manda el cliente', T, 'acceptedAt: new Date() };', 'acceptedAt: body.acceptedAt ? new Date(body.acceptedAt) : new Date() };'],
  ['M4 aceptación obligatoria ignorada', T, "if (enforced) throw new TermsError('terms_required'", "if (false) throw new TermsError('terms_required'"],
  ['M5 acceptedTerms «verdadero» cualquiera', T, 'if (body.acceptedTerms !== true) throw', 'if (!body.acceptedTerms) throw'],
  ['M6 se acepta una versión aunque no haya texto publicado', T, "if (typeof config.version !== 'string' || config.version === '') throw", 'if (false) throw'],
  ['M7 required sin versión cierra el registro', T, "const enforced = config.required === true && typeof config.version === 'string' && config.version !== '';", 'const enforced = config.required === true;'],
  ['M8 forma de la versión sin validar', T, 'const VERSION_SHAPE = /^[A-Za-z0-9._-]{1,32}$/;', 'const VERSION_SHAPE = /^[\s\S]*$/;'],
  ['M9 el registro no guarda la aceptación', A, '...(accepted ? { termsVersion: accepted.termsVersion, acceptedAt: accepted.acceptedAt } : {})', ''],
  ['M10 carrera del mismo correo = 500', A, "if (error && error.name === 'SequelizeUniqueConstraintError') return res.status(400).json({ error: 'El correo ya está registrado.' });", ''],
  ['M11 la aceptación sale de la exportación (ES-23)', 'utils/personalData.js', "'planId', 'termsVersion', 'acceptedAt', 'createdAt'", "'planId', 'createdAt'"],
  ['M12 la purga conserva la aceptación', 'utils/deletionProcessor.js', 'lockedUntil: null, termsVersion: null, acceptedAt: null,', 'lockedUntil: null,'],
  ['M13 migración no idempotente', 'migrations/20261113030000-es301-terms-acceptance.cjs', 'ADD COLUMN IF NOT EXISTS "termsVersion"', 'ADD COLUMN "termsVersion"'],
  ['M14 el rol vuelve a venir del cuerpo', A, "role: 'user', ...(accepted", "role: req.body.role || 'user', ...(accepted"],
];
const only = process.argv[2]; const selected = MUTATIONS.filter(([name]) => !only || name.includes(only));
const originals = new Map(); const restore = () => { for (const [file, text] of originals) fs.writeFileSync(path.join(backend, file), text); originals.clear(); };
process.on('exit', restore); process.on('SIGINT', () => { restore(); process.exit(130); });
const run = () => spawnSync(process.execPath, ['--test', 'test/integration/es-301-postgres.cjs'], { cwd: backend, encoding: 'utf8', env: { ...process.env, ES301_TEST_DATABASE_URL: URL_ } });
let survived = 0;
for (const [name, file, before, after] of selected) {
  const full = path.join(backend, file); const text = fs.readFileSync(full, 'utf8'); const normal = text.replace(/\r\n/g, '\n');
  if (!normal.includes(before)) { console.log(`OBSOLETA   ${name}: el texto original ya no existe`); survived++; continue; }
  originals.set(file, text);
  fs.writeFileSync(full, (normal.split(before).join(after)).replace(/\n/g, text.includes('\r\n') ? '\r\n' : '\n'));
  const result = run(); restore();
  const failing = (result.stdout.match(/^\s*not ok \d+ - .{0,70}/gm) || []).filter((line) => !line.startsWith('not ok 1 ')).map((line) => line.trim().slice(0, 60));
  if (result.status === 0) { console.log(`SOBREVIVE  ${name}`); survived++; } else console.log(`DETECTADA  ${name}  → ${failing[0] || 'falla de arranque/otra'}`);
}
console.log(`\n${selected.length - survived}/${selected.length} mutaciones detectadas`);
process.exit(survived ? 1 : 0);
