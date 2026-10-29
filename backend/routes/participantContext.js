const router = require('express').Router();
const User = require('../User');
const ParticipantContext = require('../ParticipantContext');
const DerivedInvalidation = require('../DerivedInvalidation');
const { sequelize } = require('../database');
const { encriptarV2, desencriptar } = require('../utils/crypto');
const { SCHEMA_VERSION, upgradeContext, validateContextRequest } = require('../utils/participantContext');

const present = row => row ? {
  schemaVersion: SCHEMA_VERSION, version: row.version, context: upgradeContext(JSON.parse(desencriptar(row.content))), // ES-109: un contexto v1 sale como v2 con lo nuevo vacío
  savedAt: row.updatedAt, completedAt: row.completedAt,
} : { schemaVersion: SCHEMA_VERSION, version: 0, context: null, savedAt: null, completedAt: null };

// verificarToken is mounted in server.js. The current owner is checked again inside
// the transaction; a stale JWT cannot grant an inactive user or changed role access.
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  if (!Number.isSafeInteger(req.user.id) || req.user.id <= 0 || req.user.role !== 'user') {
    return res.status(403).json({ error: 'context_forbidden' });
  }
  if (Object.keys(req.query).length) return res.status(400).json({ error: 'invalid_request' });
  next();
});

async function ownContext(req, res, write) {
  let transaction;
  try {
    transaction = await sequelize.transaction();
    // Serializes first-create and subsequent updates, as well as owner deletion.
    const owner = await User.findOne({
      where: { id: req.user.id, active: true, role: 'user' },
      attributes: ['id'], transaction, lock: transaction.LOCK?.UPDATE ?? true,
    });
    if (!owner) {
      await transaction.rollback();
      return res.status(403).json({ error: 'context_forbidden' });
    }
    let row = await ParticipantContext.findOne({ where: { UserId: owner.id }, transaction });
    if (write) {
      if ((row?.version ?? 0) !== req.body.expectedVersion) {
        await transaction.rollback();
        return res.status(409).json({ error: 'context_conflict' });
      }
      const values = {
        content: encriptarV2(JSON.stringify(req.validContext)), version: (row?.version ?? 0) + 1,
        completedAt: req.body.action === 'continue' ? new Date() : (req.validContext.preferredLanguage ? row?.completedAt ?? null : null),
      };
      if (row) {
        row = await row.update(values, { transaction });
        await DerivedInvalidation.create({ UserId: owner.id, sourceType: 'participant_context', sourceId: row.id, reason: 'edited' }, { transaction });
      } else row = await ParticipantContext.create({ ...values, UserId: owner.id }, { transaction });
    }
    const result = present(row);
    await transaction.commit();
    return res.json(result);
  } catch {
    if (transaction && !transaction.finished) await transaction.rollback().catch(() => {});
    // Do not log submitted context, tokens, database details or encrypted content.
    return res.status(503).json({ error: 'context_unavailable' });
  }
}
router.get('/', (req, res) => ownContext(req, res, false));
router.put('/', (req, res) => {
  const result = validateContextRequest(req.body);
  if (result.error) return res.status(400).json(result); // incluye { error: 'schema_outdated' } para una pestaña abierta con el esquema v1
  req.validContext = result.context;
  return ownContext(req, res, true);
});
// Never fall through to the SPA for an attempted foreign-ID resource.
router.use((req, res) => res.status(404).json({ error: 'context_not_found' }));
module.exports = router;
