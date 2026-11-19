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
}, {
  // ES-341: GET /api/admin/usuarios agrega por UserId; migración 20261119010000-es341-session-ratings-userid-index.
  indexes: [{ fields: ['UserId'] }],
});

module.exports = SessionRating;