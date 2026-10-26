const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

// Registro de invalidación de dependencias (ES-20): cuando una entrada de origen se edita o se borra, los derivados
// que dependan de ella (síntesis, evidencias, candidatas) deben revisarse. Aquí solo se registra; lo consumen ES-25/ES-23.
// Sin contenido privado. Tabla nueva: sync() la crea.
const DerivedInvalidation = sequelize.define('DerivedInvalidation', {
  UserId: { type: DataTypes.INTEGER, allowNull: false },
  sourceType: { type: DataTypes.STRING(32), allowNull: false }, // p. ej. diary_entry
  sourceId: { type: DataTypes.INTEGER, allowNull: false },
  reason: { type: DataTypes.STRING(16), allowNull: false }, // edited | deleted
  handledAt: { type: DataTypes.DATE, allowNull: true },
}, {
  updatedAt: false,
  indexes: [{ fields: ['UserId'] }, { fields: ['sourceType', 'sourceId'] }],
});

module.exports = DerivedInvalidation;
