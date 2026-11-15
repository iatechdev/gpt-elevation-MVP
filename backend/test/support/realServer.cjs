// ES-281 (E236-1) · Carga el server.js REAL (no una copia de sus montajes) y registra qué routers monta y bajo qué prefijo.
// Así una ruta o un router nuevo añadido a server.js entra solo a las baterías que recorren `mounts`, sin que alguien tenga que acordarse de copiarlo aquí.
// Uso (en una prueba con PostgreSQL desechable): sustituir antes el módulo ../../database por { sequelize, connectDB } y llamar a loadRealApp().
const express = require('express');

function loadRealApp() {
  process.env.DB_SYNC_DISABLED = 'true'; // el esquema lo crean las migraciones de la prueba; server.js no llama a sync()
  const mounts = [];
  const originalUse = express.application.use;
  express.application.use = function recordingUse(...args) {
    const prefix = typeof args[0] === 'string' ? args[0] : '/';
    const handlers = args.flat().filter((h) => typeof h === 'function');
    const routers = handlers.filter((h) => Array.isArray(h.stack));
    const guards = handlers.filter((h) => !Array.isArray(h.stack)).map((h) => h.name || 'anonimo');
    const guardFns = handlers.filter((h) => !Array.isArray(h.stack));
    for (const router of routers) mounts.push({ prefix, guards, guardFns, router });
    return originalUse.apply(this, args);
  };
  let app;
  try { app = require('../../server'); } finally { express.application.use = originalUse; }
  return { app, mounts };
}

// Recorre las rutas de un router: [[MÉTODO, ruta completa]]. Si un router lleva otro router dentro (router.use(subrouter)), no se puede
// saber su prefijo con certeza: se devuelve en `nested` para que la prueba falle y se declare a propósito.
function routesOf(mounts, app) {
  const out = []; const nested = [];
  // rutas puestas directamente en la aplicación (app.get(...)): no pasan por app.use y también deben contarse
  const root = app && (app.router || app._router);
  if (root) for (const layer of root.stack) { if (layer.route) { for (const method of Object.keys(layer.route.methods)) out.push([method.toUpperCase(), layer.route.path]); } }
  for (const { prefix, router } of mounts) {
    for (const layer of router.stack) {
      if (layer.route) { for (const method of Object.keys(layer.route.methods)) out.push([method.toUpperCase(), (prefix === '/' ? '' : prefix) + layer.route.path]); }
      else if (layer.handle && Array.isArray(layer.handle.stack)) nested.push(prefix);
    }
  }
  return { routes: out, nested };
}

module.exports = { loadRealApp, routesOf };
