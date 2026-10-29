const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

// ES-95: hoja de vida (PDF) de la solicitud. Tabla aparte para que las listas nunca la carguen.
// El contenido va cifrado (AES-256-GCM v2, en base64); el nombre original NO se guarda.
module.exports = sequelize.define('ProfessionalApplicationFile', {
  ApplicationId: {
    type: DataTypes.INTEGER, allowNull: false, unique: true,
    references: { model: 'ProfessionalApplications', key: 'id' }, onDelete: 'CASCADE',
  },
  size: { type: DataTypes.INTEGER, allowNull: false },
  sha256: { type: DataTypes.STRING(64), allowNull: false },
  content: { type: DataTypes.TEXT, allowNull: false },
});
