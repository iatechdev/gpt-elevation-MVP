// backend/MatchingRequest.js
// HU-060 — Matching request model

const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

const MatchingRequest = sequelize.define('MatchingRequest', {
  UserId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Users', key: 'id' },
  },
  answers: {
    type: DataTypes.TEXT,
    allowNull: true,
    // JSON: questionnaire answers
    get() {
      const val = this.getDataValue('answers');
      try { return val ? JSON.parse(val) : {}; } catch { return {}; }
    },
    set(val) {
      this.setDataValue('answers', JSON.stringify(val));
    },
  },
  suggestions: {
    type: DataTypes.TEXT,
    allowNull: true,
    // JSON: AI suggestions array
    get() {
      const val = this.getDataValue('suggestions');
      try { return val ? JSON.parse(val) : []; } catch { return []; }
    },
    set(val) {
      this.setDataValue('suggestions', JSON.stringify(val));
    },
  },
  chosenTherapistId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'Users', key: 'id' },
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'pending',
    // Values: 'pending' | 'confirmed' | 'rejected'
  },
});

module.exports = MatchingRequest;