// backend/EthicManifest.js
const { DataTypes } = require('sequelize');
const { sequelize }  = require('./database');

const EthicManifest = sequelize.define('EthicManifest', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },

  // Contenido del manifiesto — encriptado con AES-256-CBC (utils/crypto.js)
  // Se desencripta antes de inyectarlo al system prompt de Claude
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
  },

  // Versión legible: "v1", "v2", etc. — se autoincrementa en el endpoint
  version: {
    type: DataTypes.STRING(10),
    allowNull: false,
  },

  // Solo uno puede estar activo a la vez
  // Al activar uno nuevo, el endpoint desactiva todos los anteriores
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },

  // Quién lo subió (userId del miembro de la junta)
  uploadedBy: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },

  // Nota opcional que acompaña la versión ("Actualización post-revisión Q1 2026")
  note: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'EthicManifests',
  timestamps: true,
});

module.exports = EthicManifest;