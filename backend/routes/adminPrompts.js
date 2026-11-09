// backend/routes/adminPrompts.js
// Endpoints admin: GET/POST /api/admin/prompt*
// Endpoints superadmin: GET/POST /api/superadmin/prompt*
// verificarAdmin / verificarSuperAdmin aplicados en server.js

const express = require('express');
const router  = express.Router();
const { PromptVault, getActivePrompt, proposePrompt, approvePrompt, rejectPrompt, rollbackPrompt, decryptPrompt } = require('../promptVault');
const PromptRule = require('../PromptRule');
const { verificarSuperAdmin } = require('../middlewares/auth');
const { validateBody, nonempty, optional, boolean } = require('../middlewares/validateBody');
const { CATEGORIES, fold, describeReasons } = require('../utils/promptReview'); // ES-191
const { KEY, replyProposal, replyReviewError } = require('../utils/promptHttp');

// ES-191: la clave de una guía es un identificador corto; cualquier otra cosa es 400, no un 500 de la base.
// Los ids de versión son enteros positivos: cualquier otra cosa es 404 (antes, un 500 de la base).
const validId = (req, res, next) => (/^[1-9][0-9]{0,9}$/.test(req.params.id) ? next() : res.status(404).json({ error: 'Versión no encontrada. / Version not found.' }));
const validKey = (req, res, next) => (KEY.test(req.params.key) ? next() : res.status(400).json({ error: 'Clave inválida. / Invalid key.' }));

// POST /api/admin/prompt y /api/superadmin/prompt — RETIRADA (ES-191, decisión de Mauricio): guardaba y ACTIVABA una guía al instante,
// sin aprobación humana. Toda guía nueva pasa por proponer (/prompt/propose, con revisión automática) y aprobar (superadministración).
router.post('/prompt', (req, res) => res.status(410).json({
  code: 'prompt_direct_save_removed',
  error: 'Esta ruta se retiró: toda guía se propone y la aprueba una persona. / This route was removed: every guide is proposed and approved by a person.',
}));

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
router.post('/prompt/propose', validateBody({ key: nonempty, content: nonempty }), async (req, res) => {
  try {
    const { key, content } = req.body;
    if (!key || !content)
      return res.status(400).json({ error: 'key y content son requeridos.' });
    if (!KEY.test(key)) return res.status(400).json({ error: 'Clave inválida. / Invalid key.' });
    return replyProposal(res, await proposePrompt(key, content, req.user.name));
  } catch (error) {
    if (replyReviewError(res, error)) return;
    console.error('❌ Error proponiendo prompt:', error);
    res.status(500).json({ error: 'No se pudo enviar la propuesta.' });
  }
});

// GET /api/superadmin/prompt/:key/versions
// ES-191 (decisión 22): quien aprueba ve el texto de cada versión. Esta ruta solo la alcanzan administración y superadministración
// (verificarAdmin en server.js); el profesional lee las suyas por /api/therapist/prompt, con su propia clave.
router.get('/prompt/:key/versions', validKey, async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const versiones = await PromptVault.findAll({
      where: { key: req.params.key },
      attributes: ['id', 'key', 'version', 'status', 'proposed_by', 'approved_by', 'rejected_by', 'rejection_note', 'approved_at', 'rejected_at', 'updatedAt', 'contentEncrypted', 'reviewOutcome', 'reviewReasons', 'reviewedAt'],
      order: [['version', 'DESC']],
    });
    res.json(versiones.map((row) => {
      const { contentEncrypted, reviewReasons, ...rest } = row.toJSON();
      let content = null; let contentError = false;
      try { content = decryptPrompt(contentEncrypted); } catch { contentError = true; } // una versión ilegible no tumba la lista
      let reasons = []; try { reasons = describeReasons(JSON.parse(reviewReasons || '[]')); } catch { reasons = []; }
      return { ...rest, content, ...(contentError ? { contentError: true } : {}), reviewReasons: reasons };
    }));
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo versiones.' });
  }
});

// POST /api/superadmin/prompt/:id/approve
router.post('/prompt/:id/approve', verificarSuperAdmin, validId, async (req, res) => {
  try {
    await approvePrompt(req.params.id, req.user.name);
    res.json({ message: 'Versión aprobada y activa en producción.' });
  } catch (error) {
    if (replyReviewError(res, error)) return;
    console.error('❌ Error aprobando prompt:', error);
    res.status(500).json({ error: error.message || 'No se pudo aprobar la versión.' });
  }
});

// POST /api/superadmin/prompt/:id/reject
router.post('/prompt/:id/reject', verificarSuperAdmin, validId, validateBody({ note: nonempty }), async (req, res) => {
  try {
    const { note } = req.body;
    await rejectPrompt(req.params.id, req.user.name, note || '');
    res.json({ message: 'Versión rechazada.' });
  } catch (error) {
    if (replyReviewError(res, error)) return;
    console.error('❌ Error rechazando prompt:', error);
    res.status(500).json({ error: error.message || 'No se pudo rechazar la versión.' });
  }
});

// POST /api/superadmin/prompt/:id/rollback
router.post('/prompt/:id/rollback', verificarSuperAdmin, validId, async (req, res) => {
  try {
    await rollbackPrompt(req.params.id, req.user.name);
    res.json({ message: 'Rollback exitoso. Versión anterior activa en producción.' });
  } catch (error) {
    if (replyReviewError(res, error)) return;
    console.error('❌ Error en rollback:', error);
    res.status(500).json({ error: error.message || 'No se pudo hacer rollback.' });
  }
});

// ==========================================
// ES-191 — Reglas de la revisión automática (datos administrables; solo superadministración)
// ==========================================
const LOCALES = ['es', 'en', 'any'];
const ruleId = (req, res, next) => (/^[1-9][0-9]{0,9}$/.test(req.params.id) ? next() : res.status(404).json({ error: 'Regla no encontrada. / Rule not found.' }));
const validPhrase = (value) => typeof value === 'string' && value.length <= 160 && fold(value).replace(/[*\s|]/g, '').length >= 3;
const ruleSchema = { category: (v) => CATEGORIES.includes(v), locale: (v) => LOCALES.includes(v), phrase: validPhrase };
const ruleJson = (r) => ({ id: r.id, category: r.category, locale: r.locale, phrase: r.phrase, active: r.active, source: r.source, updatedBy: r.updatedBy, updatedAt: r.updatedAt });
const uniqueConflict = (error) => error && error.name === 'SequelizeUniqueConstraintError';

router.get('/prompt-rules', verificarSuperAdmin, async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const rules = await PromptRule.findAll({ order: [['category', 'ASC'], ['locale', 'ASC'], ['phrase', 'ASC']] });
    res.json(rules.map(ruleJson));
  } catch (error) { res.status(500).json({ error: 'No se pudieron obtener las reglas.' }); }
});

router.post('/prompt-rules', verificarSuperAdmin, validateBody(ruleSchema), async (req, res) => {
  try {
    const { category, locale, phrase } = req.body;
    const rule = await PromptRule.create({ category, locale, phrase: phrase.trim(), active: true, source: 'admin', updatedBy: req.user.name });
    res.status(201).json(ruleJson(rule));
  } catch (error) {
    if (uniqueConflict(error)) return res.status(409).json({ error: 'La regla ya existe. / The rule already exists.' });
    res.status(500).json({ error: 'No se pudo crear la regla.' });
  }
});

router.put('/prompt-rules/:id', verificarSuperAdmin, ruleId, validateBody({ category: optional((v) => CATEGORIES.includes(v)), locale: optional((v) => LOCALES.includes(v)), phrase: optional(validPhrase), active: optional(boolean) }), async (req, res) => {
  try {
    const rule = await PromptRule.findByPk(Number(req.params.id));
    if (!rule) return res.status(404).json({ error: 'Regla no encontrada. / Rule not found.' });
    const changes = {};
    for (const field of ['category', 'locale', 'active']) if (req.body[field] !== undefined) changes[field] = req.body[field];
    if (req.body.phrase !== undefined) changes.phrase = req.body.phrase.trim();
    await rule.update({ ...changes, source: 'admin', updatedBy: req.user.name });
    res.json(ruleJson(rule));
  } catch (error) {
    if (uniqueConflict(error)) return res.status(409).json({ error: 'La regla ya existe. / The rule already exists.' });
    res.status(500).json({ error: 'No se pudo actualizar la regla.' });
  }
});

router.delete('/prompt-rules/:id', verificarSuperAdmin, ruleId, async (req, res) => {
  try {
    const rule = await PromptRule.findByPk(Number(req.params.id));
    if (!rule) return res.status(404).json({ error: 'Regla no encontrada. / Rule not found.' });
    await rule.destroy();
    res.status(204).end();
  } catch (error) { res.status(500).json({ error: 'No se pudo borrar la regla.' }); }
});

module.exports = router;
