// ES-292 · Escribe dist/BUILD_SHA con el sha del commit (lo lee la guarda de scripts/_buildSha.cjs). Se corre justo después del build: `npm run build:sha` (build + huella).
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: __dirname, encoding: 'utf8' }).trim();
if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error('git rev-parse HEAD no devolvió un sha');
const dist = path.resolve(__dirname, '..', 'dist');
if (!fs.existsSync(dist)) throw new Error('No existe dist/: corre primero «vite build»');
fs.writeFileSync(path.join(dist, 'BUILD_SHA'), sha + '\n');
console.log('dist/BUILD_SHA =', sha);
