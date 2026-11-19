// ES-341 (E323-1) · Índice por UserId en SessionRatings: GET /api/admin/usuarios agrega las calificaciones por cuenta (GROUP BY "UserId").
// ADITIVA e idempotente: solo crea el índice si no existe; no toca filas. Mismo nombre que el que crea sequelize.sync() desde el modelo (sin deriva).
// Contrato doble: la prueba la llama con up(sequelize); sequelize-cli (ES-59) con up(queryInterface).
const INDEX = 'session_ratings__user_id';

async function up(arg) {
  const sequelize = arg.sequelize || arg;
  await sequelize.query(`CREATE INDEX IF NOT EXISTS "${INDEX}" ON "SessionRatings" ("UserId")`);
}

async function down(queryInterface) {
  require('../scripts/guard-down.cjs')('20261119010000-es341-session-ratings-userid-index');
  await queryInterface.sequelize.query(`DROP INDEX IF EXISTS "${INDEX}"`);
}

module.exports = { up, down, INDEX };
