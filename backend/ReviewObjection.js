const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

// ES-175: la objeción de la persona a una revisión. UNA por revisión (índice único) e idempotente por (UserId, requestId). `reason` va cifrado v2. Tabla nueva.
const ReviewObjection = sequelize.define('ReviewObjection', {
  reviewId: { type: DataTypes.INTEGER, allowNull: false },
  UserId: { type: DataTypes.INTEGER, allowNull: false },
  reason: { type: DataTypes.TEXT, allowNull: false },
  locale: { type: DataTypes.STRING(2), allowNull: false },
  requestId: { type: DataTypes.STRING(64), allowNull: false },
}, {
  updatedAt: false,
  indexes: [
    { name: 'review_objections__review', unique: true, fields: ['reviewId'] },
    { name: 'review_objections__request', unique: true, fields: ['UserId', 'requestId'] },
  ],
});

module.exports = ReviewObjection;
