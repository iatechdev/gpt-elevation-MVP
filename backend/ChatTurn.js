const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

// Turno de chat con requestId (ES-20): permite reintentar sin duplicar mensajes y recuperar el estado desde otro navegador.
// Tabla nueva: sync() la crea. Los textos van cifrados (formato v2).
const ChatTurn = sequelize.define('ChatTurn', {
  UserId: { type: DataTypes.INTEGER, allowNull: false },
  requestId: { type: DataTypes.STRING(64), allowNull: false },
  status: { type: DataTypes.STRING(12), allowNull: false, defaultValue: 'pending' }, // pending | completed | failed
  userContent: { type: DataTypes.TEXT, allowNull: false },
  replyContent: { type: DataTypes.TEXT, allowNull: true },
  failureCode: { type: DataTypes.STRING(40), allowNull: true },
}, {
  indexes: [{ unique: true, fields: ['UserId', 'requestId'] }],
});

module.exports = ChatTurn;
