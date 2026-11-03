// backend/utils/syncOptions.js
// Opciones de sequelize.sync(). `alter` modifica columnas de tablas existentes, así que solo se activa
// de forma explícita con DB_SYNC_ALTER=true (desarrollo desechable); sin la variable, sync() solo crea
// las tablas que falten, en cualquier entorno. QA-57-05: no depende de NODE_ENV.

function syncOptions(env = process.env) {
  return env.DB_SYNC_ALTER === 'true' ? { alter: true } : {};
}

// ES-115 (ES-59, fase 2): con DB_SYNC_DISABLED=true el servidor NO llama a sync(); el esquema lo gestionan solo las migraciones.
// Sin la variable nada cambia (desarrollo local y pruebas). Se define en Railway por entorno y se revierte quitándola.
function syncDisabled(env = process.env) {
  return env.DB_SYNC_DISABLED === 'true';
}

// QA-115-01: solo el valor exacto "true" omite sync(). Un valor distinto (TRUE, 1, yes, con espacios…) dejaría sync() activo en silencio,
// así que se avisa al arrancar. Vacío o ausente no avisa; "false" tampoco (es el valor explícito de no desactivar).
function syncDisabledWarning(env = process.env) {
  const value = env.DB_SYNC_DISABLED;
  if (value === undefined || value === '' || value === 'true' || value === 'false') return null;
  return 'DB_SYNC_DISABLED tiene un valor no reconocido; solo "true" (exacto, en minúsculas) desactiva sync(). sync() sigue ACTIVO.';
}

module.exports = syncOptions;
module.exports.syncDisabled = syncDisabled;
module.exports.syncDisabledWarning = syncDisabledWarning;
