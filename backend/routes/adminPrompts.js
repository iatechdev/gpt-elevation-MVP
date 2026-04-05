// backend/routes/adminPrompts.js
// Endpoints admin: GET/POST /api/admin/prompt*
// Endpoints superadmin: GET/POST /api/superadmin/prompt*
// verificarAdmin / verificarSuperAdmin aplicados en server.js

const express = require('express');
const router  = express.Router();
const { PromptVault, getActivePrompt, savePrompt, proposePrompt, approvePrompt, rejectPrompt, rollbackPrompt } = require('../promptVault');

// POST /api/admin/prompt
router.post('/prompt', async (req, res) => {
  try {
    const { key, content } = req.body;
    if (!key || !content)
      return res.status(400).json({ error: 'key y content son requeridos.' });
    await savePrompt(key, content, req.user.name);
    res.json({ message: `Prompt '${key}' guardado y encriptado exitosamente.` });
  } catch (error) {
    console.error('❌ Error guardando prompt:', error);
    res.status(500).json({ error: 'No se pudo guardar el prompt.' });
  }
});

// GET /api/admin/prompts
router.get('/prompts', async (req, res) => {
  try {
    const prompts = await PromptVault.findAll({
      attributes: ['key', 'version', 'isActive', 'updatedBy', 'updatedAt'],
    });
    res.json(prompts);
  } catch (error) {
    res.status(500).json({ error: 'No se pudieron obtener los prompts.' });
  }
});

// GET /api/admin/prompt/:key
router.get('/prompt/:key', async (req, res) => {
  try {
    let prompt = await PromptVault.findOne({
      where: { key: req.params.key, status: 'active' },
      attributes: ['id', 'key', 'version', 'status', 'approved_by', 'approved_at', 'updatedAt'],
    });
    if (!prompt) {
      prompt = await PromptVault.findOne({
        where: { key: req.params.key, isActive: true },
        attributes: ['id', 'key', 'version', 'status', 'approved_by', 'approved_at', 'updatedAt'],
        order: [['version', 'DESC']],
      });
    }
    if (!prompt) return res.status(404).json({ error: 'Prompt no encontrado.' });
    const contenido = await getActivePrompt(req.params.key);
    res.json({ ...prompt.toJSON(), content: contenido });
  } catch (error) {
    console.error('❌ Error obteniendo prompt:', error);
    res.status(500).json({ error: 'Error obteniendo el prompt.' });
  }
});

// POST /api/admin/prompt/propose
router.post('/prompt/propose', async (req, res) => {
  try {
    const { key, content } = req.body;
    if (!key || !content)
      return res.status(400).json({ error: 'key y content son requeridos.' });
    await proposePrompt(key, content, req.user.name);
    res.json({ message: 'Propuesta enviada al superadmin para revisión.' });
  } catch (error) {
    console.error('❌ Error proponiendo prompt:', error);
    res.status(500).json({ error: 'No se pudo enviar la propuesta.' });
  }
});

// GET /api/superadmin/prompt/:key/versions
router.get('/prompt/:key/versions', async (req, res) => {
  try {
    const versiones = await PromptVault.findAll({
      where: { key: req.params.key },
      attributes: ['id', 'key', 'version', 'status', 'proposed_by', 'approved_by', 'rejected_by', 'rejection_note', 'approved_at', 'rejected_at', 'updatedAt'],
      order: [['version', 'DESC']],
    });
    res.json(versiones);
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo versiones.' });
  }
});

// POST /api/superadmin/prompt/:id/approve
router.post('/prompt/:id/approve', async (req, res) => {
  try {
    await approvePrompt(req.params.id, req.user.name);
    res.json({ message: 'Versión aprobada y activa en producción.' });
  } catch (error) {
    console.error('❌ Error aprobando prompt:', error);
    res.status(500).json({ error: error.message || 'No se pudo aprobar la versión.' });
  }
});

// POST /api/superadmin/prompt/:id/reject
router.post('/prompt/:id/reject', async (req, res) => {
  try {
    const { note } = req.body;
    await rejectPrompt(req.params.id, req.user.name, note || '');
    res.json({ message: 'Versión rechazada.' });
  } catch (error) {
    console.error('❌ Error rechazando prompt:', error);
    res.status(500).json({ error: error.message || 'No se pudo rechazar la versión.' });
  }
});

// POST /api/superadmin/prompt/:id/rollback
router.post('/prompt/:id/rollback', async (req, res) => {
  try {
    await rollbackPrompt(req.params.id, req.user.name);
    res.json({ message: 'Rollback exitoso. Versión anterior activa en producción.' });
  } catch (error) {
    console.error('❌ Error en rollback:', error);
    res.status(500).json({ error: error.message || 'No se pudo hacer rollback.' });
  }
});

module.exports = router;