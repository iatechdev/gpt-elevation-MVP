// Operator tool: dry-run by default. Never loads .env, seeds plans or changes prices/limits.
const copy = require('../content/reviewedPricingCopy');
const fields = ['description_es', 'description_en', 'features_es', 'features_en'];
async function reviewedPricingCopy({ PricingPlan, sequelize, apply = false }) {
  const transaction = await sequelize.transaction();
  try {
    const rows = await PricingPlan.findAll({ where: { slug: Object.keys(copy) }, transaction, lock: transaction.LOCK.UPDATE });
    const changes = rows.map(row => ({ row, patch: copy[row.slug] })).filter(({ row, patch }) => fields.some(key => JSON.stringify(row[key]) !== JSON.stringify(patch[key])));
    if (apply) for (const { row, patch } of changes) await row.update(patch, { transaction });
    await transaction.commit();
    return changes.map(({ row }) => ({ slug: row.slug, fields, applied: apply }));
  } catch (error) { if (!transaction.finished) await transaction.rollback(); throw error; }
}
module.exports = { reviewedPricingCopy };
if (require.main === module) {
  const apply = process.argv.includes('--apply');
  if (apply && process.env.PRICING_COPY_APPROVED !== 'ES-73-D01-10406') {
    console.error('Explicit approval marker required; no changes made.');
    process.exitCode = 1;
  } else {
    const { sequelize } = require('../database');
    const PricingPlan = require('../PricingPlan');
    reviewedPricingCopy({ sequelize, PricingPlan, apply })
      .then(result => console.log(JSON.stringify({ mode: apply ? 'apply-reviewed-copy' : 'dry-run', changes: result })))
      .catch(() => { console.error('Pricing copy operation failed; inspect configuration privately.'); process.exitCode = 1; })
      .finally(() => sequelize.close());
  }
}
