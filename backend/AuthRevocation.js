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
  // ES-366 (QA-419-2): versión de sesión de la persona. Cada corte la incrementa de forma atómica en la base y el token firma la vigente (claim `sv`):
  // la validación compara versiones, sin relojes, así que es correcta con varias instancias. Sin fila = 0. Esta fila NO se borra nunca (reiniciaría la versión).
  sessionVersion: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
});

// Un corte = la versión sube en 1 (atómico, en la base) y, además, el instante SOLO AVANZA (QA-419-3: el commit tardío de un corte antiguo no lo retrocede). El instante se sigue
// escribiendo para que un rollback de código (que valida por tiempo) siga revocando. Devuelve la versión nueva.
AuthRevocation.advanceCut = async (UserId, revokedBefore) => {
  const [rows] = await sequelize.query(
    'INSERT INTO "AuthRevocations" ("UserId", "revokedBefore", "sessionVersion", "createdAt", "updatedAt") VALUES (:UserId, :revokedBefore, 1, now(), now()) '
    + 'ON CONFLICT ("UserId") DO UPDATE SET "revokedBefore" = GREATEST("AuthRevocations"."revokedBefore", EXCLUDED."revokedBefore"), '
    + '"sessionVersion" = "AuthRevocations"."sessionVersion" + 1, "updatedAt" = now() RETURNING "sessionVersion"',
    { replacements: { UserId, revokedBefore } },
  );
  return Number(rows?.[0]?.sessionVersion);
};

module.exports = AuthRevocation;
