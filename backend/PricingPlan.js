// backend/PricingPlan.js
const { DataTypes } = require('sequelize');
const { sequelize }  = require('./database');

const PricingPlan = sequelize.define('PricingPlan', {
  // Slug único — usado por planLimits.js para aplicar restricciones
  // valores válidos: 'basic' | 'essential' | 'plus' | 'pro'
  slug: {
    type: DataTypes.STRING(20),
    allowNull: true,   // true para permitir sync en BD con filas existentes
    unique: true,
  },
  // Nombre por idioma
  name_es: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  name_en: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  // Descripción por idioma
  description_es: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: '',
  },
  description_en: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: '',
  },
  // Precio
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
  },
  currency: {
    type: DataTypes.STRING(10),
    allowNull: false,
    defaultValue: 'USD',
  },
  period: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'month',
  },
  // Features por idioma (JSON array)
  features_es: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: [],
  },
  features_en: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: [],
  },
  isHighlighted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  order: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
}, {
  tableName: 'PricingPlans',
  timestamps: true,
});

module.exports = PricingPlan;