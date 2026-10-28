// Configuración de sequelize-cli (ES-59): la conexión sale solo de DATABASE_URL; no hay secretos en el repo.
// DB_SSL=false solo para una base local sin SSL (misma convención que backend/database.js).
require('dotenv').config();

const dialectOptions = process.env.DB_SSL === 'false'
  ? {}
  : { ssl: { require: true, rejectUnauthorized: false } };

const entorno = { use_env_variable: 'DATABASE_URL', dialect: 'postgres', dialectOptions, logging: false };

module.exports = { development: entorno, test: entorno, staging: entorno, production: entorno };
