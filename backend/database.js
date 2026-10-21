require('dotenv').config();
const { Sequelize } = require('sequelize');

const dbHost = process.env.DB_HOST || '';

// Cloud Run usa Unix socket (/cloudsql/...), local usa IP directa
const isSocket = dbHost.startsWith('/');

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    dialect: 'postgres',
    logging: false,
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
          dialectOptions: {
            ssl: {
              require: true,
              rejectUnauthorized: false,
            },
          },
        }),
  }
);

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('🗄️ PostgreSQL conectado con éxito en Google Cloud SQL.');
  } catch (error) {
    console.error('❌ Error al conectar con la base de datos:', error);
  }
};

module.exports = { sequelize, connectDB };