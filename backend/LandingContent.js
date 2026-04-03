const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

const LandingContent = sequelize.define('LandingContent', {
  key: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  lang: {
    type: DataTypes.STRING(5),
    allowNull: false,
  },
  value: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  updated_by: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  indexes: [
    { unique: true, fields: ['key', 'lang'] }
  ]
});

module.exports = LandingContent;