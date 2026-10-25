require('dotenv').config();
const { Sequelize } = require('sequelize');

const dbHost = process.env.DB_HOST || '';

// Cloud Run usa Unix socket (/cloudsql/...), local usa IP directa
const isSocket = dbHost.startsWith('/');

// Pool acotado: el pooler compartido de Supabase limita las conexiones por proyecto
const pool = {
  max: parseInt(process.env.DB_POOL_MAX, 10) || 5,
  min: 0,
  acquire: 30000,
  idle: 10000,
};

// SSL activo salvo que DB_SSL=false (solo para una base local sin SSL)
const useSsl = process.env.DB_SSL !== 'false';
const sslOptions = useSsl ? { ssl: { require: true, rejectUnauthorized: false } } : {};

let sequelize;

if (process.env.DATABASE_URL) {
  // Railway + Supabase — cadena de conexión del pooler (DATABASE_URL)
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    logging: false,
    pool,
    dialectOptions: sslOptions,
  });
} else {
  sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASS,
    {
      dialect: 'postgres',
      logging: false,
      pool,
      ...(isSocket
        ? {
            // Cloud Run — Unix socket
            host: dbHost,
            dialectOptions: {
              socketPath: dbHost,
            },
          }
        : {
            // Local — TCP/IP con SSL
            host: dbHost,
            ...(process.env.DB_PORT ? { port: parseInt(process.env.DB_PORT, 10) } : {}),
            dialectOptions: sslOptions,
          }),
    }
  );
}

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('🗄️ PostgreSQL conectado con éxito.');
  } catch (error) {
    console.error('❌ Error al conectar con la base de datos:', error);
  }
};

module.exports = { sequelize, connectDB };
