const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

// ES-194: historial de los ejercicios (quién y cuándo creó, guardó, publicó, retiró o registró la revisión). Guarda una copia (JSON) del contenido y del estado.
// Es registro de la administración, no de las personas usuarias: nunca contiene datos de personas.
const ExerciseAudit = sequelize.define('ExerciseAudit', {
  exerciseId: { type: DataTypes.INTEGER, allowNull: false },
  version: { type: DataTypes.INTEGER, allowNull: false },
  action: { type: DataTypes.STRING(16), allowNull: false },
  actorId: { type: DataTypes.INTEGER, allowNull: true },
  actorName: { type: DataTypes.STRING(120), allowNull: true },
  snapshot: { type: DataTypes.TEXT, allowNull: false },
}, {
  updatedAt: false,
  indexes: [{ fields: ['exerciseId', 'createdAt'], name: 'exercise_audits__exercise_created_at' }],
});

module.exports = ExerciseAudit;
