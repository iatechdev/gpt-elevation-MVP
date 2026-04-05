// backend/TherapistValidation.js
// HU-075 — Modelo para validación académica de terapeutas

const { DataTypes } = require('sequelize');
const { sequelize }  = require('./database');

const TherapistValidation = sequelize.define('TherapistValidation', {
  therapistId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Users', key: 'id' },
  },
  documentType: {
    // titulo, certificado, colegiado, otro
    type: DataTypes.ENUM('titulo', 'certificado', 'colegiado', 'otro'),
    allowNull: false,
    defaultValue: 'titulo',
  },
  documentName: {
    // nombre original del archivo
    type: DataTypes.STRING,
    allowNull: false,
  },
  documentPath: {
    // ruta en GCS: therapist-docs/{therapistId}/{filename}
    type: DataTypes.STRING,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected'),
    allowNull: false,
    defaultValue: 'pending',
  },
  reviewedBy: {
    // nombre del revisor de la Junta
    type: DataTypes.STRING,
    allowNull: true,
  },
  reviewNote: {
    // nota de rechazo o aprobación
    type: DataTypes.TEXT,
    allowNull: true,
  },
  submittedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  reviewedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'TherapistValidations',
  timestamps: true,
});

module.exports = TherapistValidation;