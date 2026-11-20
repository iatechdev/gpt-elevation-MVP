const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

// ES-169 (PR 2a): opciones del emparejamiento (tema, estilo, idioma) con su texto ES/EN, administrables (la pantalla de administración es el ticket 2c; mientras tanto, por la base).
// La CLAVE (`key`) es lo que viaja en `answers` y se guarda en MatchingRequests; no cambia aunque cambie el texto. Tabla nueva (migración 20261120020000-es169-matching-options.cjs; la semilla es el contenido aprobado por Alejo).
const MatchingOption = sequelize.define('MatchingOption', {
  kind: { type: DataTypes.STRING(12), allowNull: false }, // topic | style | language
  key: { type: DataTypes.STRING(32), allowNull: false },
  label_es: { type: DataTypes.STRING(60), allowNull: false },
  label_en: { type: DataTypes.STRING(60), allowNull: false },
  position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, {
  indexes: [{ name: 'matching_options__kind_key', unique: true, fields: ['kind', 'key'] }],
});

module.exports = MatchingOption;
