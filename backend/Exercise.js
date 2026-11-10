const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

// ES-194 · Ejercicios de acompañamiento que se crean, revisan y publican desde la aplicación (antes: shared/companion-exercises.json + una bandera de compilación).
// `status` (draft | published | withdrawn) y `reviewStatus` (pending | done) son INDEPENDIENTES: publicar no equivale a que el especialista lo haya revisado.
// Si cambia el contenido de un ejercicio revisado, la revisión vuelve a `pending` (una versión nueva no hereda la revisión). Sin datos de personas.
const Exercise = sequelize.define('Exercise', {
  key: { type: DataTypes.STRING(48), allowNull: false },
  status: { type: DataTypes.STRING(12), allowNull: false, defaultValue: 'draft' },
  version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  minutesMin: { type: DataTypes.INTEGER, allowNull: true },
  minutesMax: { type: DataTypes.INTEGER, allowNull: true },
  es: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  en: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  reviewStatus: { type: DataTypes.STRING(8), allowNull: false, defaultValue: 'pending' },
  reviewedBy: { type: DataTypes.STRING(120), allowNull: true },
  reviewedAt: { type: DataTypes.DATE, allowNull: true },
  publishedBy: { type: DataTypes.STRING(120), allowNull: true },
  publishedAt: { type: DataTypes.DATE, allowNull: true },
  withdrawnBy: { type: DataTypes.STRING(120), allowNull: true },
  withdrawnAt: { type: DataTypes.DATE, allowNull: true },
  updatedBy: { type: DataTypes.STRING(120), allowNull: true },
}, {
  indexes: [
    { name: 'exercises__key', unique: true, fields: ['key'] },
    { name: 'exercises__status', fields: ['status'] },
  ],
});

module.exports = Exercise;
