// backend/routes/board.js
// Endpoints for the Ethics Board role
// Protected with verificarBoard in server.js (except /active, consumed internally by chat.js)

const express       = require('express');
const router        = express.Router();
const { sequelize } = require('../database');
const EthicManifest = require('../EthicManifest');
const User          = require('../User');
const { encriptar, desencriptar } = require('../utils/crypto');

// ── POST /api/board/manifest ──────────────────────────────────────────────────
// Upload a new version of the ethics manifest
// Body: { content: string, note?: string }
router.post('/manifest', async (req, res) => {
  const { content, note } = req.body;
  const uploadedBy = req.user.id;

  if (!content || content.trim().length < 50) {
    return res.status(400).json({ error: 'Manifest must be at least 50 characters long.' });
  }

  const t = await sequelize.transaction();
  try {
    // Calculate next version number
    const latest = await EthicManifest.findOne({
      order: [['createdAt', 'DESC']],
      transaction: t,
    });

    let nextVersion = 'v1';
    if (latest) {
      const num = parseInt(latest.version.replace('v', ''), 10);
      nextVersion = `v${num + 1}`;
    }

    // Deactivate all previous versions
    await EthicManifest.update(
      { isActive: false },
      { where: { isActive: true }, transaction: t }
    );

    // Create new encrypted manifest
    const newManifest = await EthicManifest.create({
      content: encriptar(content.trim()),
      version: nextVersion,
      isActive: true,
      uploadedBy,
      note: note?.trim() || null,
    }, { transaction: t });

    await t.commit();

    res.status(201).json({
      message: `✅ Manifest ${nextVersion} published and activated.`,
      id:        newManifest.id,
      version:   newManifest.version,
      isActive:  newManifest.isActive,
      createdAt: newManifest.createdAt,
    });
  } catch (error) {
    await t.rollback();
    console.error('❌ Error uploading manifest:', error);
    res.status(500).json({ error: 'Could not save manifest.' });
  }
});

// ── GET /api/board/manifest ───────────────────────────────────────────────────
// Full version history — decrypted, only for board members
router.get('/manifest', async (req, res) => {
  try {
    const manifests = await EthicManifest.findAll({
      order: [['createdAt', 'DESC']],
      include: [{
        model: User,
        as: 'uploader',
        attributes: ['id', 'name', 'email'],
      }],
    });

    const result = manifests.map(m => ({
      id:        m.id,
      version:   m.version,
      isActive:  m.isActive,
      note:      m.note,
      content:   desencriptar(m.content),
      uploader:  m.uploader,
      createdAt: m.createdAt,
    }));

    res.json(result);
  } catch (error) {
    console.error('❌ Error fetching manifests:', error);
    res.status(500).json({ error: 'Could not retrieve manifest history.' });
  }
});

// ── PUT /api/board/manifest/:id/activate ─────────────────────────────────────
// Reactivate a previous version (rollback)
router.put('/manifest/:id/activate', async (req, res) => {
  const { id } = req.params;

  const t = await sequelize.transaction();
  try {
    const manifest = await EthicManifest.findByPk(id, { transaction: t });
    if (!manifest) {
      await t.rollback();
      return res.status(404).json({ error: 'Manifest not found.' });
    }

    // Deactivate all
    await EthicManifest.update(
      { isActive: false },
      { where: { isActive: true }, transaction: t }
    );

    // Activate selected version
    manifest.isActive = true;
    await manifest.save({ transaction: t });

    await t.commit();

    res.json({
      message: `✅ Version ${manifest.version} reactivated.`,
      id:      manifest.id,
      version: manifest.version,
    });
  } catch (error) {
    await t.rollback();
    console.error('❌ Error activating manifest:', error);
    res.status(500).json({ error: 'Could not activate version.' });
  }
});

// ── GET /api/manifest/active ──────────────────────────────────────────────────
// Consumed internally by chat.js to inject context into Claude
// No auth required here — handled by server.js mount point
router.get('/active', async (req, res) => {
  try {
    const active = await EthicManifest.findOne({
      where: { isActive: true },
      order: [['createdAt', 'DESC']],
    });

    if (!active) return res.json({ content: null });

    res.json({
      version: active.version,
      content: desencriptar(active.content),
    });
  } catch (error) {
    console.error('❌ Error fetching active manifest:', error);
    res.json({ content: null }); // silent fail — chat keeps working
  }
});

module.exports = router;