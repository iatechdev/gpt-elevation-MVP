const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

// Entrada privada y fechada del diario (ES-20). El contenido va cifrado (formato v2).
// Al borrar, el contenido se vacía y se marca deletedAt: la entrada desaparece de toda consulta y contexto;
// la purga de copias la completa ES-23. Tabla nueva: sync() la crea.
const DiaryEntry = sequelize.define('DiaryEntry', {
  UserId: { type: DataTypes.INTEGER, allowNull: false },
  entryDate: { type: DataTypes.DATEONLY, allowNull: false },
  content: { type: DataTypes.TEXT, allowNull: false },
  deletedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  indexes: [{ fields: ['UserId', 'entryDate'] }],
});

module.exports = DiaryEntry;
