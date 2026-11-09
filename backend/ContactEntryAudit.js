const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

// ES-193: quién cambió qué y cuándo en los datos de contacto. Guarda una copia (JSON) de la entrada tras cada cambio.
// Es registro de la administración (no de las personas usuarias): nunca se borra con una cuenta.
const ContactEntryAudit = sequelize.define('ContactEntryAudit', {
  entryId: { type: DataTypes.INTEGER, allowNull: false },
  action: { type: DataTypes.STRING(16), allowNull: false },
  actorId: { type: DataTypes.INTEGER, allowNull: true },
  actorName: { type: DataTypes.STRING(120), allowNull: true },
  snapshot: { type: DataTypes.TEXT, allowNull: false },
}, {
  updatedAt: false,
  indexes: [{ fields: ['entryId', 'createdAt'], name: 'contact_entry_audits__entry_created_at' }],
});

module.exports = ContactEntryAudit;
