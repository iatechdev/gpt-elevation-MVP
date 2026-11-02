const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

// ES-95: hoja de vida (PDF) de la solicitud. Tabla aparte para que las listas nunca la carguen.
// ES-107: el contenido se guarda como BINARIO cifrado (AES-256-GCM sobre los bytes, sin base64): ocupa el tamaño del archivo + 29 bytes.
// El nombre original NO se guarda.
module.exports = sequelize.define('ProfessionalApplicationFile', {
  ApplicationId: {
    type: DataTypes.INTEGER, allowNull: false, unique: true,
    references: { model: 'ProfessionalApplications', key: 'id' }, onDelete: 'CASCADE',
  },
  size: { type: DataTypes.INTEGER, allowNull: false },
  sha256: { type: DataTypes.STRING(64), allowNull: false },
  data: { type: DataTypes.BLOB, allowNull: false },
});
