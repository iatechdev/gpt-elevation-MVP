const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

// Sesiones cerradas (logout): un token revocado deja de valer aunque no haya vencido. Tabla nueva: sync() la crea.
const RevokedToken = sequelize.define('RevokedToken', {
  jti: {
    type: DataTypes.STRING(64),
    primaryKey: true,
  },
  UserId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  // Vencimiento del token: pasado ese instante el registro ya no hace falta y se puede borrar.
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
});

module.exports = RevokedToken;
