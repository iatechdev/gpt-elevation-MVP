// Ejecutar por infraestructura en el entorno elegido, antes de habilitar ES-32. Sin down destructivo.
const { sequelize } = require('../database');
const { up } = require('../migrations/20261028-es32-routes.cjs');
up(sequelize).then(() => console.log('ES-32: migración aditiva aplicada.'))
  .catch(error => { console.error('ES-32: migración fallida:', error.name); process.exitCode = 1; })
  .finally(() => sequelize.close());
