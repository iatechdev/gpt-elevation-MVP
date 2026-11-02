const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

// ES-109: histórico de hojas de vida (PDF) de la persona. Una fila por versión. El archivo va cifrado como BINARIO (AES-256-GCM sobre los bytes,
// sin base64: PDF + 29 bytes). Solo la persona dueña ve, descarga o borra sus versiones; el servidor verifica el propietario en cada acceso.
// Nunca se guarda el nombre original del archivo ni el texto extraído.
module.exports = sequelize.define('ParticipantResume', {
  UserId: {
    type: DataTypes.INTEGER, allowNull: false,
    references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE',
  },
  version: { type: DataTypes.INTEGER, allowNull: false },
  size: { type: DataTypes.INTEGER, allowNull: false },
  sha256: { type: DataTypes.STRING(64), allowNull: false },
  data: { type: DataTypes.BLOB, allowNull: false },
}, {
  indexes: [
    { unique: true, name: 'participant_resumes_user_version_unique', fields: ['UserId', 'version'] },
    // El mismo archivo no se guarda dos veces por persona: reintentar o volver a subirlo reutiliza la versión existente.
    { unique: true, name: 'participant_resumes_user_sha_unique', fields: ['UserId', 'sha256'] },
  ],
});
