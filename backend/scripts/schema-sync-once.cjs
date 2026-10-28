// Auxiliar de schema-drift.cjs (ES-59): crea el esquema con sequelize.sync() sobre la base de DATABASE_URL
// y termina. Carga server.js para registrar exactamente los mismos modelos que el servidor.
// Solo para bases desechables; nunca contra staging ni producción.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'schema-drift-solo-pruebas';
process.env.DATA_ENCRYPTION_KEY = process.env.DATA_ENCRYPTION_KEY || require('crypto').randomBytes(32).toString('hex');
process.env.PROMPT_ENCRYPTION_KEY = process.env.PROMPT_ENCRYPTION_KEY || require('crypto').randomBytes(32).toString('hex');

const { sequelize } = require('../database');
require('../server');

const esperado = () => Object.keys(sequelize.models).length;
const contar = async () => {
  const [r] = await sequelize.query("select count(*)::int n from information_schema.tables where table_schema='public'");
  return r[0].n;
};

(async () => {
  let estable = 0;
  let previo = -1;
  for (let i = 0; i < 120 && estable < 6; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const n = await contar().catch(() => -1);
    estable = n === previo && n >= esperado() ? estable + 1 : 0;
    previo = n;
  }
  console.log(`sync: ${previo} tablas (${esperado()} modelos)`);
  process.exit(previo >= esperado() ? 0 : 1);
})();
