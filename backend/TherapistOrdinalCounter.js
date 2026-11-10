const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

// ES-177 · Contador MONÓTONO de ordinales «Persona n» por profesional: solo sube, así el número de una persona que sale (o se elimina) no se reutiliza nunca
// y el profesional no confunde a dos personas distintas con el mismo «Persona n». Sin datos personales. Se borra con el profesional.
const TherapistOrdinalCounter = sequelize.define('TherapistOrdinalCounter', {
  therapistId: { type: DataTypes.INTEGER, primaryKey: true, allowNull: false },
  lastOrdinal: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
});

module.exports = TherapistOrdinalCounter;
