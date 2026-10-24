// backend/PlanRequest.js
// HU-077 — Solicitudes de cambio de plan iniciadas por el usuario

const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

const PlanRequest = sequelize.define('PlanRequest', {
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Users', key: 'id' },
  },
  planId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'PricingPlans', key: 'id' },
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected'),
    allowNull: false,
    defaultValue: 'pending',
  },
  // Nota del admin al aprobar o rechazar
  adminNote: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  // Quién procesó la solicitud
  resolvedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'Users', key: 'id' },
  },
  resolvedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'PlanRequests',
  timestamps: true,
});

module.exports = PlanRequest;