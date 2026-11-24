const { catalog } = require('../content/landingDefaults');

// Marca de las filas que creó este script y que nadie ha editado: la edición desde «Textos públicos» guarda el nombre de la persona en updated_by.
const SEED_TAG = 'ES-66 seed';
const guard = env => {
  if (env.APP_ENV !== 'staging' || env.LANDING_SEED_CONFIRM !== 'staging') throw new Error('Landing seed requires APP_ENV=staging and LANDING_SEED_CONFIRM=staging.');
};

async function seedLandingContent({ model, sequelize, env = process.env }) {
  guard(env);
  return sequelize.transaction(async transaction => {
    let created = 0;
    for (const entry of catalog) for (const lang of ['es', 'en']) {
      const [, inserted] = await model.findOrCreate({
        where: { key: entry.key, lang },
        defaults: { value: entry[lang], updated_by: SEED_TAG },
        transaction,
      });
      if (inserted) created++;
    }
    return created;
  });
}

class DryRunRollback extends Error {}

/**
 * ES-378 (H440-1): refresca las filas SEMBRADAS. findOrCreate no actualiza lo que ya existe, así que las filas de staging sembradas con textos antiguos tapaban el JSON nuevo.
 * Reglas (idempotente y aditivo):
 *  - crea las claves que faltan (updated_by = SEED_TAG);
 *  - actualiza SOLO las filas con updated_by = SEED_TAG (nadie las editó) cuyo valor difiere del catálogo; las editadas por una persona (updated_by distinto) NO se tocan;
 *  - borra las filas sembradas de claves landing.* que ya no están en el catálogo (retiradas); las retiradas que editó una persona se dejan (la lectura pública ya las ignora, ES-106);
 *  - dryRun: hace todo dentro de la transacción y la revierte (cuenta lo que haría, no escribe).
 * Auditoría SIN datos: devuelve y registra solo conteos y NOMBRES de clave, nunca los textos.
 * Todo en una sola transacción: si algo falla, no queda nada a medias (rollback).
 */
async function refreshSeededLandingContent({ model, sequelize, env = process.env, dryRun = false }) {
  guard(env);
  const id = (key, lang) => `${key}|${lang}`;
  const wanted = new Map();
  for (const entry of catalog) for (const lang of ['es', 'en']) wanted.set(id(entry.key, lang), { key: entry.key, lang, value: entry[lang] });
  const report = { dryRun, created: 0, updated: 0, removed: 0, kept: 0, updatedKeys: [], removedKeys: [] };
  try {
    await sequelize.transaction(async transaction => {
      const rows = await model.findAll({ transaction, lock: transaction.LOCK ? transaction.LOCK.UPDATE : undefined });
      const seen = new Set();
      for (const row of rows) {
        const want = wanted.get(id(row.key, row.lang));
        if (want) {
          seen.add(id(row.key, row.lang));
          if (row.updated_by !== SEED_TAG) { report.kept++; continue; }
          if (row.value !== want.value) { await row.update({ value: want.value }, { transaction }); report.updated++; report.updatedKeys.push(id(row.key, row.lang)); }
        } else if (typeof row.key === 'string' && row.key.startsWith('landing.')) {
          if (row.updated_by !== SEED_TAG) { report.kept++; continue; }
          await row.destroy({ transaction }); report.removed++; report.removedKeys.push(id(row.key, row.lang));
        }
      }
      for (const [wantedId, want] of wanted) {
        if (seen.has(wantedId)) continue;
        await model.create({ key: want.key, lang: want.lang, value: want.value, updated_by: SEED_TAG }, { transaction });
        report.created++;
      }
      if (dryRun) throw new DryRunRollback();
    });
  } catch (error) { if (!(error instanceof DryRunRollback)) throw error; }
  return report;
}

if (require.main === module) {
  // Guard before loading DB configuration; no .env or connection is read on rejection.
  if (process.env.APP_ENV !== 'staging' || process.env.LANDING_SEED_CONFIRM !== 'staging') {
    console.error('Landing seed refused: staging confirmation required.');
    process.exitCode = 1;
  } else {
    const { sequelize } = require('../database');
    const model = require('../LandingContent');
    // node scripts/seedLandingContent.js                     -> solo crea lo que falta (comportamiento original)
    // node scripts/seedLandingContent.js --refresh --dry-run -> cuenta lo que haría el refresco, sin escribir
    // node scripts/seedLandingContent.js --refresh           -> ES-378: además actualiza las filas sembradas y retira las claves retiradas
    const refresh = process.argv.includes('--refresh'); const dryRun = process.argv.includes('--dry-run');
    const run = refresh
      ? refreshSeededLandingContent({ model, sequelize, dryRun }).then(r => {
        console.log(`Landing refresh${r.dryRun ? ' (DRY RUN, nothing written)' : ''}: created=${r.created} updated=${r.updated} removed=${r.removed} kept(edited by a person)=${r.kept}`);
        console.log(`updated keys: ${r.updatedKeys.join(', ')}`); console.log(`removed keys: ${r.removedKeys.join(', ')}`);
      })
      : seedLandingContent({ model, sequelize }).then(created => console.log(`Landing seed: ${created} entries created; existing values preserved.`));
    run.catch(() => { console.error('Landing seed failed; transaction rolled back.'); process.exitCode = 1; }).finally(() => sequelize.close());
  }
}

module.exports = { seedLandingContent, refreshSeededLandingContent, SEED_TAG };
