// ES-141: sirve frontend/dist. Los archivos de /assets llevan hash en el nombre (Vite): su contenido no cambia bajo la misma URL, así que
// se cachean un año como immutable. El resto (index.html y los archivos públicos sin hash) se revalida siempre, para que un despliegue
// nuevo llegue a la persona sin esperar.
const express = require('express');
const compression = require('compression');
const path = require('path');

const IMMUTABLE = 'public, max-age=31536000, immutable';
const REVALIDATE = 'no-cache';

// Vite nombra los archivos con hash como nombre-HASH.ext (8+ caracteres de [A-Za-z0-9_-]).
const HASHED_ASSET = /[\\/]assets[\\/][^\\/]+-[A-Za-z0-9_-]{8,}\.[A-Za-z0-9]+$/;

function setCacheHeaders(res, filePath) {
  res.setHeader('Cache-Control', HASHED_ASSET.test(filePath) ? IMMUTABLE : REVALIDATE);
}

function mountFrontend(app, distDir) {
  // ES-139: solo los estáticos se comprimen (gzip; el paquete compression no ofrece brotli). La API no pasa por aquí: las respuestas con
  // datos de la persona no se comprimen (evita ataques tipo BREACH).
  app.use(compression({ threshold: 1024 }));
  // ES-337: la política estática antigua (producto anterior, GPT de OpenAI) se retiró; su URL sigue viva y lleva con redirección permanente (308) al aviso vigente.
  // Dos rutas (sin arreglos: el enumerador de la política de roles de es-281 no las entiende); `/privacy` también atiende `/privacy/` (enrutado no estricto).
  const legacyPrivacy = (req, res) => { res.set('Cache-Control', 'public, max-age=3600'); res.redirect(308, '/privacidad'); };
  app.get('/privacy', legacyPrivacy);
  app.get('/privacy/index.html', legacyPrivacy);
  app.use(express.static(distDir, { setHeaders: setCacheHeaders }));
  // ES-140: un archivo de /assets que no existe (p. ej. un bloque con hash de un despliegue anterior) responde 404, no el index.html con 200:
  // el navegador no debe tomar HTML por JavaScript.
  app.use('/assets', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.status(404).type('text/plain').send('Not found');
  });
  app.get('/{*path}', (req, res) => {
    res.set('Cache-Control', REVALIDATE);
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

module.exports = { mountFrontend, IMMUTABLE, REVALIDATE };
