// ES-141: sirve frontend/dist. Los archivos de /assets llevan hash en el nombre (Vite): su contenido no cambia bajo la misma URL, así que
// se cachean un año como immutable. El resto (index.html y los archivos públicos sin hash) se revalida siempre, para que un despliegue
// nuevo llegue a la persona sin esperar.
const express = require('express');
const compression = require('compression');
const fs = require('fs');
const path = require('path');

const IMMUTABLE = 'public, max-age=31536000, immutable';
const REVALIDATE = 'no-cache';

// Vite nombra los archivos con hash como nombre-HASH.ext (8+ caracteres de [A-Za-z0-9_-]).
const HASHED_ASSET = /[\\/]assets[\\/][^\\/]+-[A-Za-z0-9_-]{8,}\.[A-Za-z0-9]+$/;

function setCacheHeaders(res, filePath) {
  res.setHeader('Cache-Control', HASHED_ASSET.test(filePath) ? IMMUTABLE : REVALIDATE);
}

// ES-201: brotli precomprimido. `npm run build` (frontend/scripts/precompress.mjs) deja un `.br` junto a cada JS/CSS/HTML/SVG/JSON de dist/. Si el navegador lo acepta se sirve ese archivo
// (calidad máxima, ~15 % menos que gzip); si no existe o el navegador no lo acepta, sigue el gzip de siempre. Los tipos son los mismos que comprime el script.
const BROTLI_TYPES = new Set(['.js', '.css', '.html', '.svg', '.json', '.txt', '.xml', '.map']);

/** ¿El navegador acepta brotli? `br` con q>0; un comodín (*) no cuenta, para no prometer lo que el cliente no pidió. */
function acceptsBrotli(header) {
  if (!header) return false;
  for (const part of String(header).split(',')) {
    const [token, ...params] = part.trim().split(';');
    if (token.trim().toLowerCase() !== 'br') continue;
    const q = params.map(p => p.trim()).find(p => /^q=/i.test(p));
    return q ? Number(q.slice(2)) > 0 : true;
  }
  return false;
}

/** Archivo de dist que corresponde a una ruta URL, o null si se sale de dist (../) o la ruta es inválida. '/' → index.html. */
function resolveInDist(root, urlPath) {
  let rel;
  try { rel = decodeURIComponent(urlPath); } catch { return null; }
  if (rel.includes('\0')) return null;
  if (rel === '/') rel = '/index.html';
  const abs = path.normalize(path.join(root, rel));
  return abs.startsWith(root + path.sep) ? abs : null;
}

/** Envía `<abs>.br` con Content-Encoding: br y las cabeceras de caché de siempre. Llama a `miss` si no se pudo (no existe o falló). */
function sendBrotli(res, abs, miss) {
  const br = `${abs}.br`;
  fs.stat(br, (err, stat) => {
    if (err || !stat.isFile()) return miss();
    res.vary('Accept-Encoding');
    res.setHeader('Content-Encoding', 'br');
    res.type(path.extname(abs));
    setCacheHeaders(res, abs);
    res.sendFile(br, { dotfiles: 'allow' }, error => {
      if (error && !res.headersSent) { res.removeHeader('Content-Encoding'); res.removeHeader('Content-Type'); miss(); }
    });
  });
}

function brotliStatic(root) {
  return (req, res, next) => {
    if ((req.method !== 'GET' && req.method !== 'HEAD') || !acceptsBrotli(req.headers['accept-encoding'])) return next();
    const abs = resolveInDist(root, req.path);
    if (!abs || !BROTLI_TYPES.has(path.extname(abs))) return next();
    sendBrotli(res, abs, next);
  };
}

function mountFrontend(app, distDir) {
  const root = path.resolve(distDir);
  app.use(brotliStatic(root)); // antes de `compression`: una respuesta ya codificada no se vuelve a comprimir
  // ES-139: solo los estáticos se comprimen (`compression` 1.8 negocia gzip y brotli, este último a calidad 4: casi igual que gzip; por eso ES-201 sirve brotli precomprimido de calidad 11 antes de llegar aquí). La API no pasa por aquí: las respuestas con
  // datos de la persona no se comprimen (evita ataques tipo BREACH).
  app.use(compression({ threshold: 1024 }));
  app.use(express.static(distDir, { setHeaders: setCacheHeaders }));
  // ES-140: un archivo de /assets que no existe (p. ej. un bloque con hash de un despliegue anterior) responde 404, no el index.html con 200:
  // el navegador no debe tomar HTML por JavaScript.
  app.use('/assets', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.status(404).type('text/plain').send('Not found');
  });
  app.get('/{*path}', (req, res) => {
    const index = path.join(root, 'index.html');
    const plain = () => { res.set('Cache-Control', REVALIDATE); res.sendFile(index); };
    if (acceptsBrotli(req.headers['accept-encoding'])) sendBrotli(res, index, plain); else plain();
  });
}

module.exports = { mountFrontend, IMMUTABLE, REVALIDATE, acceptsBrotli };
