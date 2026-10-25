// backend/utils/syncOptions.js
// Opciones de sequelize.sync(). `alter` modifica columnas de tablas existentes, así que solo se activa
// de forma explícita con DB_SYNC_ALTER=true (desarrollo desechable); sin la variable, sync() solo crea
// las tablas que falten, en cualquier entorno. QA-57-05: no depende de NODE_ENV.

function syncOptions(env = process.env) {
  return env.DB_SYNC_ALTER === 'true' ? { alter: true } : {};
}

module.exports = syncOptions;
