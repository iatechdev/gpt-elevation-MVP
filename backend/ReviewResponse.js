const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

// ES-175: la respuesta del revisor a una objeción. UNA por objeción. `UserId` es la PERSONA dueña (para exportar y purgar con ES-23); `reviewerId` quien responde. `text` cifrado v2.
const ReviewResponse = sequelize.define('ReviewResponse', {
  objectionId: { type: DataTypes.INTEGER, allowNull: false },
  UserId: { type: DataTypes.INTEGER, allowNull: false },
  reviewerId: { type: DataTypes.INTEGER, allowNull: false },
  text: { type: DataTypes.TEXT, allowNull: false },
  locale: { type: DataTypes.STRING(2), allowNull: false },
  requestId: { type: DataTypes.STRING(64), allowNull: false },
}, {
  updatedAt: false,
  indexes: [
    { name: 'review_responses__objection', unique: true, fields: ['objectionId'] },
    { name: 'review_responses__request', unique: true, fields: ['reviewerId', 'requestId'] },
  ],
});

module.exports = ReviewResponse;
