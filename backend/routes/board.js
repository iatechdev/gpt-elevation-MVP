// backend/routes/board.js
// Manifiesto ético: lectura pública (GET /active) y edición de administración/superadmin (ES-207).
// La autorización por ruta protege también el montaje público /api/manifest.

const express       = require('express');
const { Transaction, Op } = require('sequelize');
const router        = express.Router();
const { sequelize } = require('../database');
const EthicManifest = require('../EthicManifest');
const User          = require('../User');
const { encriptar, desencriptar } = require('../utils/crypto');
const { verificarEditorManifiesto } = require('../middlewares/auth');
const { validateBody, nonempty, text, optional } = require('../middlewares/validateBody');

// ── POST /api/board/manifest ──────────────────────────────────────────────────
// Upload a new version of the ethics manifest
// Body: { content: string, note?: string }
router.post('/manifest', verificarEditorManifiesto, validateBody({ content: nonempty, note: optional(text) }), async (req, res) => {
  const { content, note } = req.body;
  const uploadedBy = req.user.id;

  if (!content || content.trim().length < 50) {
    return res.status(400).json({ error: 'Manifest must be at least 50 characters long.' });
  }

  const t = await sequelize.transaction();
  try {
    // ES-211: mismo bloqueo que al reactivar, para que subir y reactivar a la vez no dejen dos activas ni repitan el número de versión.
    await EthicManifest.findAll({ attributes: ['id'], lock: Transaction.LOCK.UPDATE, transaction: t });
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
router.get('/manifest', verificarEditorManifiesto, async (req, res) => {
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
router.put('/manifest/:id/activate', verificarEditorManifiesto, async (req, res) => {
  const { id } = req.params;

  const t = await sequelize.transaction();
  try {
    // ES-211: bloquea las filas del manifiesto para que dos activaciones (o una activación y una subida) se serialicen; la tabla es pequeña.
    await EthicManifest.findAll({ attributes: ['id'], lock: Transaction.LOCK.UPDATE, transaction: t });
    const manifest = await EthicManifest.findByPk(id, { transaction: t });
    if (!manifest) {
      await t.rollback();
      return res.status(404).json({ error: 'Manifest not found.' });
    }

    // Desactiva las demás y activa esta en la misma transacción. Reactivar la versión ya activa es idempotente: antes se desactivaba
    // en la base pero el objeto en memoria seguía «activo», así que save() no escribía nada y quedaban 0 versiones activas.
    await EthicManifest.update(
      { isActive: false },
      { where: { isActive: true, id: { [Op.ne]: manifest.id } }, transaction: t }
    );
    await EthicManifest.update({ isActive: true }, { where: { id: manifest.id }, transaction: t });

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
// Lectura pública del manifiesto activo (página /manifiesto). El chat NO usa este endpoint.
// Sin sesión a propósito; las demás rutas de este router exigen verificarEditorManifiesto.
router.get('/active', async (req, res) => {
  try {
    const active = await EthicManifest.findOne({
      where: { isActive: true },
      order: [['createdAt', 'DESC']],
    });

    if (!active) return res.json({ content: null });

    // ES-207: lectura pública. Solo versión, texto y fecha de publicación (activación); nunca nota, autor ni IDs.
    res.json({
      version: active.version,
      content: desencriptar(active.content),
      publishedAt: active.updatedAt ? new Date(active.updatedAt).toISOString() : null,
    });
  } catch (error) {
    // ES-207: un fallo ya no se disfraza de «vacío» (el chat no usa este endpoint: lee la base directo).
    console.error('❌ Error fetching active manifest:', error);
    res.status(500).json({ error: 'Could not load manifest.' });
  }
});

module.exports = router;
