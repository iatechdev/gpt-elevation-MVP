const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

const SessionNote = sequelize.define('SessionNote', {
  sessionId:   { type: DataTypes.INTEGER, allowNull: false },
  therapistId: { type: DataTypes.INTEGER, allowNull: false },
  content:     { type: DataTypes.TEXT,    allowNull: false },
  timestamp:   { type: DataTypes.DATE,    defaultValue: DataTypes.NOW },
});

module.exports = SessionNote;