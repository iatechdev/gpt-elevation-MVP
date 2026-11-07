const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

// ES-193: datos de contacto y ayuda (línea de emergencia, etc.) que ven las personas. Los edita superadministración desde Contenido:
// NINGÚN número va en el código ni en el paquete del cliente. Misma regla de procedencia que el registro de ES-21
// (utils/safety.js): una entrada solo se publica con fuente, quién la verificó y una fecha de verificación vigente.
// `version` sirve para detectar ediciones simultáneas (conflicto); se desactiva sin borrar (`active`).
const ContactEntry = sequelize.define('ContactEntry', {
  country: { type: DataTypes.STRING(2), allowNull: false },
  name: { type: DataTypes.STRING(80), allowNull: false },
  contact: { type: DataTypes.STRING(32), allowNull: false },
  descriptionEs: { type: DataTypes.STRING(300), allowNull: false, defaultValue: '' },
  descriptionEn: { type: DataTypes.STRING(300), allowNull: false, defaultValue: '' },
  position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  source: { type: DataTypes.STRING(300), allowNull: true },
  verifiedBy: { type: DataTypes.STRING(120), allowNull: true },
  verifiedAt: { type: DataTypes.DATEONLY, allowNull: true },
  version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  updatedBy: { type: DataTypes.STRING(120), allowNull: true },
}, {
  indexes: [{ fields: ['country', 'active', 'position'], name: 'contact_entries__country_active_position' }],
});

module.exports = ContactEntry;
