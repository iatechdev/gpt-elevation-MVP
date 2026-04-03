const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

const MoodLog = sequelize.define('MoodLog', {
  checkin_mood: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  checkout_mood: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  UserId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
}, {
  indexes: [
    { unique: true, fields: ['UserId', 'date'] }
  ]
});

module.exports = MoodLog;