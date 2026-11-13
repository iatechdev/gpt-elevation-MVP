// ES-292 · Huella de build: antes de cada corrida de navegador se comprueba que el servidor de vista previa sirve el build del commit que se va a subir
// (un `vite preview` antiguo en el mismo puerto servía otro build sin avisar). Uso del flujo completo:
//   1) liberar el puerto (netstat -ano | grep :<puerto>; taskkill /PID <pid> /F)  2) npm run build:sha   (= vite build + dist/BUILD_SHA desde git rev-parse HEAD)
//   3) npx vite preview --host 127.0.0.1 --port <puerto> --strictPort  4) correr el script: imprime BUILD_SHA=<sha> y FALLA si no coincide con `git rev-parse HEAD` (o EXPECT_SHA).
const { execFileSync } = require('node:child_process');
module.exports = async function assertBuildSha(baseUrl, assert) {
  const expected = (process.env.EXPECT_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { cwd: __dirname, encoding: 'utf8' })).trim();
  let served = '';
  try { const response = await fetch(new URL('/BUILD_SHA', baseUrl)); served = response.ok ? (await response.text()).trim() : ''; } catch { /* sin servidor */ }
  // Una SPA vieja contesta con su index.html para cualquier ruta: nunca se imprime todo el HTML, solo un recorte de 40 caracteres.
  const isSha = /^[0-9a-f]{40}$/.test(served);
  console.log(`BUILD_SHA=${isSha ? served : served ? `(no es un sha: «${served.replace(/\s+/g, ' ').slice(0, 40)}»)` : '(ausente)'} esperado=${expected}`);
  assert.ok(isSha, 'el build servido no trae BUILD_SHA: reconstruye con «npm run build:sha» y reinicia la vista previa (¿hay un proceso viejo en el puerto?)');
  assert.equal(served, expected, 'el servidor de vista previa sirve OTRO build (proceso viejo en el puerto): mata el proceso por PID, reconstruye y repite');
};
