const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

const SessionRating = sequelize.define('SessionRating', {
  rating: {
    type: DataTypes.SMALLINT,
    allowNull: true,
    validate: { min: 1, max: 5 },
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
});

module.exports = SessionRating;