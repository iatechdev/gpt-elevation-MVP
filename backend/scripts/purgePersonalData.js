// Operator-only maintenance command. Never load .env implicitly or print identifiers/content.
// Stop all web/worker/integration processes first; point DATABASE_URL at the intended environment.
const { sequelize } = require('../database');
const { processDeletion } = require('../utils/deletionProcessor');

async function main() {
  const [id, confirmation, replayFlag] = process.argv.slice(2);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id || '') || confirmation !== '--producers-stopped-and-drained' ||
      (replayFlag !== undefined && replayFlag !== '--replay')) {
    throw new Error('Expected request UUID and --producers-stopped-and-drained.');
  }
  await sequelize.authenticate();
  const result = await processDeletion(id, { quiescent: true, replay: replayFlag === '--replay' });
  // Only states, no request IDs, personal data or database diagnostics.
  console.log(JSON.stringify({ status: result.status, deadlinesVerified: false }));
}
main().catch(() => { console.error('Purge not completed. Review the protected request ledger.'); process.exitCode = 1; })
  .finally(() => sequelize.close());
