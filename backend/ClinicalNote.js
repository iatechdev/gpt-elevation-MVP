// HU-050 — Clinical notes model with AES-256 encryption

const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

const ClinicalNote = sequelize.define('ClinicalNote', {
  UserId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Users', key: 'id' },
  },
  therapistId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Users', key: 'id' },
  },
  // Content is always stored encrypted — never in plain text in the DB
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'session_note',
    // Values: 'session_note' | 'observation' | 'goal'
  },
  sessionDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
});

module.exports = ClinicalNote;