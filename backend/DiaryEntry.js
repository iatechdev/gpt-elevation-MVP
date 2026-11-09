const { DataTypes, Op } = require('sequelize');
const { sequelize } = require('./database');

// Entrada privada y fechada del diario (ES-20). El contenido va cifrado (formato v2).
// Al borrar, el contenido se vacía y se marca deletedAt: la entrada desaparece de toda consulta y contexto;
// la purga de copias la completa ES-23. Tabla nueva: sync() la crea.
const DiaryEntry = sequelize.define('DiaryEntry', {
  UserId: { type: DataTypes.INTEGER, allowNull: false },
  entryDate: { type: DataTypes.DATEONLY, allowNull: false },
  content: { type: DataTypes.TEXT, allowNull: false },
  deletedAt: { type: DataTypes.DATE, allowNull: true },
  // ES-163: identificador del intento de guardado que genera el cliente; solo para que reintentar un POST incierto no duplique. No contiene texto del diario.
  requestId: { type: DataTypes.STRING(64), allowNull: true },
}, {
  indexes: [
    { fields: ['UserId', 'entryDate'] },
    // Único por persona y solo cuando hay requestId (las filas anteriores no lo tienen). Misma definición que la migración 20261110000000-es163-diary-request-id.
    { name: 'diary_entries__user_request_id', unique: true, fields: ['UserId', 'requestId'], where: { requestId: { [Op.ne]: null } } },
  ],
});

module.exports = DiaryEntry;
