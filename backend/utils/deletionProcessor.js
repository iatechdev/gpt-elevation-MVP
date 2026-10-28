const { randomBytes } = require('crypto');
const { Transaction } = require('sequelize');
const User = require('../User');
const DeletionRequest = require('../DeletionRequest');
const ExportRequest = require('../ExportRequest');
const { CORE, requiresReview } = require('./personalData');
const { inTransaction, receipt } = require('./dataRights');

// Maintenance entrypoint, not an automatic worker: callers must stop ALL producers
// (web, jobs and integrations) and drain in-flight operations before invoking it.
// ES-25/27/job contracts and provider verification are still integration dependencies.
async function processDeletion(id, { quiescent = false, replay = false } = {}) {
  if (!quiescent) throw new Error('Maintenance drain confirmation required.');
  try {
    return await inTransaction(async transaction => {
      const initial = await DeletionRequest.findOne({ where: { id }, transaction });
      if (!initial) throw new Error('Deletion request not found.');
      const user = await User.findByPk(initial.UserId, { transaction, lock: Transaction.LOCK.UPDATE });
      const request = await DeletionRequest.findOne({ where: { id }, transaction, lock: Transaction.LOCK.UPDATE });
      if (request.activePurgedAt && !replay) return receipt(request);
      const attempts = request.attempts + 1;
      if (!user || user.role !== 'user' || await requiresReview(request.UserId, transaction)) {
        await request.update({ status: 'awaiting_review', attempts, activePurgedAt: null, failureCode: 'legacy_policy_pending' }, { transaction });
        return receipt(request);
      }
      for (const [, name, owner] of CORE) {
        // Keep pending dependency metadata until the professional invalidation contract can consume it.
        if (name === 'DerivedInvalidation') continue;
        await require('../' + name).destroy({ where: { [owner]: user.id }, transaction });
      }
      await ExportRequest.destroy({ where: { UserId: user.id }, transaction });
      // Keep session revocations: erasing them could make a previously revoked JWT
      // eligible for the narrowly scoped receipt-retry route before its expiry.
      // Retain the minimal referenced identity/tombstone; never delete referenced third-party records.
      await user.update({
        name: 'Cuenta eliminada / Deleted account', email: `${request.id}@deleted.invalid`, password: randomBytes(48).toString('hex'),
        active: false, motivation: null, therapistId: null, planId: null,
        onboardingCompleted: false, loginAttempts: 0, lockedUntil: null,
      }, { transaction });
      await request.update({ status: 'awaiting_verification', attempts, activePurgedAt: new Date(), failureCode: null }, { transaction });
      return receipt(request);
    });
  } catch {
    // The purge rolled back in full. Commit a generic failure separately; never store raw SQL or contents.
    await inTransaction(async transaction => {
      const row = await DeletionRequest.findOne({ where: { id }, transaction, lock: Transaction.LOCK.UPDATE });
      if (row && (!row.activePurgedAt || replay)) await row.update({
        status: 'failed', attempts: row.attempts + 1, activePurgedAt: null,
        failureCode: replay ? 'active_replay_failed' : 'active_purge_failed',
      }, { transaction });
    });
    throw new Error('Active purge failed; request remains blocked and can be retried.');
  }
}

module.exports = { processDeletion };
