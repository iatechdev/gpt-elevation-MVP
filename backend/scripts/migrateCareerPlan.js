const { sequelize } = require('../database');
require('../migrations/20261028-es33-career-plan.cjs').up(sequelize)
  .then(() => console.log('ES-33: migración aditiva aplicada.'))
  .catch(error => { console.error('ES-33: migración fallida:', error.name); process.exitCode = 1; })
  .finally(() => sequelize.close());
