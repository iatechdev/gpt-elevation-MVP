const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

// Corte de sesiones por persona: los tokens emitidos hasta ese instante dejan de valer.
// Se escribe al cerrar todas las sesiones y cuando un administrador cambia rol/estado, borra o restablece la contraseña.
const AuthRevocation = sequelize.define('AuthRevocation', {
  UserId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
  },
  revokedBefore: {
    type: DataTypes.DATE,
    allowNull: false,
  },
});

module.exports = AuthRevocation;
