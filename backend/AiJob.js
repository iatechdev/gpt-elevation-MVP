const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

// Trabajo de análisis de IA del worker (ES-84/ES-85). Postgres es la única fuente de verdad: estado, lease y fence.
// NO guarda prompts, respuestas ni texto de la persona; solo referencias a la versión de contexto autorizada.
// Los CHECK de dominio, el disparador de transiciones y las funciones del worker viven en las migraciones (sync no los crea).
// Tabla nueva: se crea con migración (ES-59); sync() la crea solo en bases desechables.
const AiJob = sequelize.define('AiJob', {
  UserId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' } },
  kind: { type: DataTypes.STRING(32), allowNull: false },          // competency_extraction
  contextVersion: { type: DataTypes.INTEGER, allowNull: false },   // CareerContextVersions.version analizada
  contextHash: { type: DataTypes.STRING(64), allowNull: false },   // sha256 (hex) del payload cifrado de esa versión
  requestId: { type: DataTypes.STRING(64), allowNull: false },     // idempotencia por persona
  status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'PENDING' },
  attempt: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  leaseOwner: { type: DataTypes.STRING(64), allowNull: true },
  leaseExpiresAt: { type: DataTypes.DATE, allowNull: true },
  fence: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }, // solo crece; invalida al worker anterior
  notBefore: { type: DataTypes.DATE, allowNull: true },            // no reclamar antes (p. ej. presupuesto agotado)
  catalogVersion: { type: DataTypes.INTEGER, allowNull: true },    // catálogo con el que se valida la salida
  errorCode: { type: DataTypes.STRING(32), allowNull: true },
  startedAt: { type: DataTypes.DATE, allowNull: true },
  finishedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  indexes: [
    { name: 'ai_jobs_owner_request', unique: true, fields: ['UserId', 'requestId'] },
    { name: 'ai_jobs_owner_id', unique: true, fields: ['UserId', 'id'] },
    { name: 'ai_jobs_status_created', fields: ['status', 'createdAt'] },
  ],
});

module.exports = AiJob;
