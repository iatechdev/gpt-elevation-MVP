// backend/User.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

const User = sequelize.define('User', {
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  role: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'user'
  },
  active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  therapistId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  loginAttempts: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  lockedUntil: {
    type: DataTypes.DATE,
    allowNull: true
  },
  // HU-072 — Onboarding
  onboardingCompleted: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  motivation: {
    type: DataTypes.STRING,
    allowNull: true
  },
  // HU-077 — Pricing plans
  planId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'PricingPlans',
      key: 'id'
    }
  }
});

module.exports = User;