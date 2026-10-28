const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

// ES-14: one current version per owner, containing only the validated career DTO.
module.exports = sequelize.define('ParticipantContext', {
  UserId: {
    type: DataTypes.INTEGER, allowNull: false, unique: true,
    references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE',
  },
  version: { type: DataTypes.INTEGER, allowNull: false },
  // Encrypted, validated DTO; preferences have a single canonical location here.
  content: { type: DataTypes.TEXT, allowNull: false },
  completedAt: { type: DataTypes.DATE, allowNull: true },
});
