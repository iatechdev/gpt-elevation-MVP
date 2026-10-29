const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

// ES-95: solicitud pública de un profesional. No es una cuenta: userId queda vacío hasta que el backoffice crea la cuenta.
module.exports = sequelize.define('ProfessionalApplication', {
  name: { type: DataTypes.STRING(120), allowNull: false },
  email: { type: DataTypes.STRING(254), allowNull: false },
  country: { type: DataTypes.STRING(80), allowNull: false },
  profession: { type: DataTypes.STRING(120), allowNull: false },
  licenseNumber: { type: DataTypes.STRING(60), allowNull: true },
  profileUrl: { type: DataTypes.STRING(300), allowNull: true },
  message: { type: DataTypes.TEXT, allowNull: true },
  locale: { type: DataTypes.STRING(2), allowNull: false, defaultValue: 'es' },
  status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'pending' }, // pending | approved | rejected
  reviewedBy: { type: DataTypes.STRING(120), allowNull: true },
  reviewNote: { type: DataTypes.TEXT, allowNull: true },
  reviewedAt: { type: DataTypes.DATE, allowNull: true },
  consentAt: { type: DataTypes.DATE, allowNull: false },
  userId: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'Users', key: 'id' }, onDelete: 'SET NULL' },
}, {
  indexes: [{ fields: ['status', 'createdAt'] }, { fields: ['email'] }],
});
