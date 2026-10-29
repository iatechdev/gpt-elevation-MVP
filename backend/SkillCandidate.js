const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

// Candidata a competencia publicada por el worker (ES-84/ES-85), revisable por su dueño. `level` 1–4 o null (sin evidencia
// suficiente); `citations` son claves de campo del contexto profesional (sin texto). La confianza no se guarda: la calcula el API
// por reglas al revisar (ES-29). La clave foránea compuesta (UserId, jobId) y los CHECK viven en la migración.
const SkillCandidate = sequelize.define('SkillCandidate', {
  jobId: { type: DataTypes.INTEGER, allowNull: false },
  UserId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' } },
  skillKey: { type: DataTypes.STRING(48), allowNull: false },
  level: { type: DataTypes.INTEGER, allowNull: true },
  citations: { type: DataTypes.JSON, allowNull: false },
  status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'REVIEW_REQUIRED' },
  catalogVersion: { type: DataTypes.INTEGER, allowNull: false },
}, {
  indexes: [
    { name: 'skill_candidates_job_skill', unique: true, fields: ['jobId', 'skillKey'] },
    { name: 'skill_candidates_owner_status', fields: ['UserId', 'status'] },
  ],
});

module.exports = SkillCandidate;
