// ES-141: sirve frontend/dist. Los archivos de /assets llevan hash en el nombre (Vite): su contenido no cambia bajo la misma URL, así que
// se cachean un año como immutable. El resto (index.html y los archivos públicos sin hash) se revalida siempre, para que un despliegue
// nuevo llegue a la persona sin esperar.
const express = require('express');
const path = require('path');

const IMMUTABLE = 'public, max-age=31536000, immutable';
const REVALIDATE = 'no-cache';

// Vite nombra los archivos con hash como nombre-HASH.ext (8+ caracteres de [A-Za-z0-9_-]).
const HASHED_ASSET = /[\\/]assets[\\/][^\\/]+-[A-Za-z0-9_-]{8,}\.[A-Za-z0-9]+$/;

function setCacheHeaders(res, filePath) {
  res.setHeader('Cache-Control', HASHED_ASSET.test(filePath) ? IMMUTABLE : REVALIDATE);
}

function mountFrontend(app, distDir) {
  app.use(express.static(distDir, { setHeaders: setCacheHeaders }));
  app.get('/{*path}', (req, res) => {
    res.set('Cache-Control', REVALIDATE);
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

module.exports = { mountFrontend, IMMUTABLE, REVALIDATE };
