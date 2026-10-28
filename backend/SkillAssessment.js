const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

// Evaluación de una habilidad (ES-29). Solo se añaden filas: la vigente es la `current` de cada (persona, habilidad, pista).
// «Sin evidencia» no se guarda: es la ausencia de fila vigente (nivel null). `rationale` va cifrado v2. Tabla nueva: sync() la crea.
const SkillAssessment = sequelize.define('SkillAssessment', {
  UserId: { type: DataTypes.INTEGER, allowNull: false },
  skillKey: { type: DataTypes.STRING(48), allowNull: false },
  track: { type: DataTypes.STRING(8), allowNull: false }, // self | review
  level: { type: DataTypes.INTEGER, allowNull: false }, // 1..4 (el null no se guarda)
  state: { type: DataTypes.STRING(14), allowNull: false }, // initial | reviewed | contradictory
  catalogVersion: { type: DataTypes.INTEGER, allowNull: false },
  rubricHash: { type: DataTypes.STRING(64), allowNull: false },
  evidenceRefs: { type: DataTypes.JSON, allowNull: false },
  confidence: { type: DataTypes.STRING(8), allowNull: false }, // low | medium | high (calculada por reglas)
  confidenceReasonCode: { type: DataTypes.STRING(32), allowNull: false },
  confidenceRuleVersion: { type: DataTypes.INTEGER, allowNull: false },
  rationale: { type: DataTypes.TEXT, allowNull: true },
  authoring: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'person' }, // person | ai_proposed
  status: { type: DataTypes.STRING(12), allowNull: false }, // current | superseded
  requestId: { type: DataTypes.STRING(64), allowNull: false },
}, {
  indexes: [
    { unique: true, fields: ['UserId', 'requestId'] },
    { unique: true, fields: ['UserId', 'skillKey', 'track'], where: { status: 'current' } },
    { fields: ['UserId'] },
  ],
});

module.exports = SkillAssessment;
