const { catalog } = require('../content/landingDefaults');

async function seedLandingContent({ model, sequelize, env = process.env }) {
  if (env.APP_ENV !== 'staging' || env.LANDING_SEED_CONFIRM !== 'staging') {
    throw new Error('Landing seed requires APP_ENV=staging and LANDING_SEED_CONFIRM=staging.');
  }
  return sequelize.transaction(async transaction => {
    let created = 0;
    for (const entry of catalog) for (const lang of ['es', 'en']) {
      const [, inserted] = await model.findOrCreate({
        where: { key: entry.key, lang },
        defaults: { value: entry[lang], updated_by: 'ES-66 seed' },
        transaction,
      });
      if (inserted) created++;
    }
    return created;
  });
}

if (require.main === module) {
  // Guard before loading DB configuration; no .env or connection is read on rejection.
  if (process.env.APP_ENV !== 'staging' || process.env.LANDING_SEED_CONFIRM !== 'staging') {
    console.error('Landing seed refused: staging confirmation required.');
    process.exitCode = 1;
  } else {
    const { sequelize } = require('../database');
    const model = require('../LandingContent');
    seedLandingContent({ model, sequelize })
      .then(created => console.log(`Landing seed: ${created} entries created; existing values preserved.`))
      .catch(() => { console.error('Landing seed failed; transaction rolled back.'); process.exitCode = 1; })
      .finally(() => sequelize.close());
  }
}

module.exports = { seedLandingContent };
