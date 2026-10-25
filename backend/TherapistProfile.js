// backend/TherapistProfile.js
// HU-060 — Therapist profile for matching

const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

const TherapistProfile = sequelize.define('TherapistProfile', {
  UserId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
    references: { model: 'Users', key: 'id' },
  },
  specialties: {
    type: DataTypes.TEXT,
    allowNull: true,
    // JSON array: ['mindfulness', 'anxiety', 'relationships']
    get() {
      const val = this.getDataValue('specialties');
      try { return val ? JSON.parse(val) : []; } catch { return []; }
    },
    set(val) {
      this.setDataValue('specialties', JSON.stringify(val));
    },
  },
  approach: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  languages: {
    type: DataTypes.TEXT,
    allowNull: true,
    // JSON array: ['es', 'en']
    get() {
      const val = this.getDataValue('languages');
      try { return val ? JSON.parse(val) : ['es']; } catch { return ['es']; }
    },
    set(val) {
      this.setDataValue('languages', JSON.stringify(val));
    },
  },
  bio: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  maxPatients: {
    type: DataTypes.INTEGER,
    defaultValue: 20,
  },
  acceptingNew: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
});

module.exports = TherapistProfile;