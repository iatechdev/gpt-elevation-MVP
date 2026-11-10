const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

// ES-177 · «Persona n»: número ordinal ESTABLE por profesional para mostrar a quien no autorizó compartir sus datos (sin nombre ni identificador interno).
// Se asigna la primera vez que la persona aparece en la lista del profesional y no se reutiliza ni se reordena cuando otras personas entran o salen.
// Se borra en cascada con la persona o con el profesional (las claves foráneas con ON DELETE CASCADE las crea la migración; ver scripts/drift-allowed.json). No contiene datos personales.
const TherapistPersonOrdinal = sequelize.define('TherapistPersonOrdinal', {
  therapistId: { type: DataTypes.INTEGER, allowNull: false },
  personId:    { type: DataTypes.INTEGER, allowNull: false },
  ordinal:     { type: DataTypes.INTEGER, allowNull: false },
}, {
  indexes: [
    { name: 'therapist_person_ordinals__person', unique: true, fields: ['therapistId', 'personId'] },
    { name: 'therapist_person_ordinals__ordinal', unique: true, fields: ['therapistId', 'ordinal'] },
  ],
});

module.exports = TherapistPersonOrdinal;
