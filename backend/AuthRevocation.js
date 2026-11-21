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

// El corte SOLO AVANZA (QA-419-3): dos cortes simultáneos de la misma persona no se pisan; el commit tardío del más antiguo no puede retroceder el corte, así que un token emitido entre ambos no vuelve a valer.
AuthRevocation.advanceCut = (UserId, revokedBefore) => sequelize.query(
  'INSERT INTO "AuthRevocations" ("UserId", "revokedBefore", "createdAt", "updatedAt") VALUES (:UserId, :revokedBefore, now(), now()) '
  + 'ON CONFLICT ("UserId") DO UPDATE SET "revokedBefore" = GREATEST("AuthRevocations"."revokedBefore", EXCLUDED."revokedBefore"), "updatedAt" = now()',
  { replacements: { UserId, revokedBefore } },
);

module.exports = AuthRevocation;
