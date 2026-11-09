const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

// ES-191: reglas de la revisión automática de las guías de la IA. Son DATOS administrables por superadministración
// (no constantes del código): una frase por fila, por categoría e idioma. `*` dentro de la frase = resto de la palabra.
// source: 'initial' = lista inicial de la migración (NO verificada por un especialista); 'admin' = creada desde administración.
const PromptRule = sequelize.define('PromptRule', {
  category: { type: DataTypes.STRING(24), allowNull: false },
  locale: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'any' },
  phrase: { type: DataTypes.STRING(160), allowNull: false },
  active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  source: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'admin' },
  updatedBy: { type: DataTypes.STRING, allowNull: true },
}, {
  indexes: [{ unique: true, fields: ['category', 'locale', 'phrase'], name: 'prompt_rules__category_locale_phrase' }],
});

module.exports = PromptRule;
