const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

// ES-175: revisión que un profesional registra sobre material autorizado. INMUTABLE: una corrección es otra revisión que apunta a la anterior (`supersedesId`).
// `observation` y `limits` van cifrados v2 (texto sobre la persona). Tabla nueva (migración con RLS).
const ProfessionalReview = sequelize.define('ProfessionalReview', {
  shareId: { type: DataTypes.INTEGER, allowNull: false },
  UserId: { type: DataTypes.INTEGER, allowNull: false },
  reviewerId: { type: DataTypes.INTEGER, allowNull: false },
  materialVersion: { type: DataTypes.INTEGER, allowNull: false },
  evidenceRefs: { type: DataTypes.JSON, allowNull: false },
  observation: { type: DataTypes.TEXT, allowNull: false },
  limits: { type: DataTypes.TEXT, allowNull: false },
  locale: { type: DataTypes.STRING(2), allowNull: false },
  supersedesId: { type: DataTypes.INTEGER, allowNull: true },
  requestId: { type: DataTypes.STRING(64), allowNull: false },
}, {
  updatedAt: false,
  indexes: [
    { name: 'professional_reviews__request', unique: true, fields: ['reviewerId', 'requestId'] },
    { name: 'professional_reviews__owner', fields: ['UserId'] },
  ],
});

module.exports = ProfessionalReview;
