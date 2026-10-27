// Explicit migration command; configuration is supplied by the operator, never loaded from .env here.
const { sequelize } = require('../database');
const { up } = require('../migrations/20261026-es23-data-rights.cjs');
up(sequelize).then(() => console.log('ES-23 additive migration applied.'))
  .catch(() => { console.error('ES-23 migration failed.'); process.exitCode = 1; })
  .finally(() => sequelize.close());
