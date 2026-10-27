const DeletionRequest = require('../DeletionRequest');

// A tombstone blocks every new session even if an administrator sets active=true.
// Database errors propagate: an unavailable deletion ledger never grants access.
const deletionPending = async (userId, transaction) => Boolean(await DeletionRequest.findOne({
  where: { UserId: userId }, transaction,
}));

module.exports = { deletionPending };
