// HU-051 — Wellness recommendations model with AES-256 encryption

const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

const WellnessRecommendation = sequelize.define('WellnessRecommendation', {
  UserId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Users', key: 'id' },
  },
  // Content stored encrypted — wellness data never in plain text in DB
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  category: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'reflection',
    // Values: 'mindfulness' | 'habit' | 'reflection' | 'resource'
  },
  generatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  seenByUser: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  seenByTherapist: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
});

module.exports = WellnessRecommendation;