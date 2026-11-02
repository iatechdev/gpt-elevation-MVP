// backend/routes/planRequests.js
// HU-077 — Solicitudes de cambio de plan

const express      = require('express');
const router       = express.Router();
const PlanRequest  = require('../PlanRequest');
const PricingPlan  = require('../PricingPlan');
const User         = require('../User');
const { sequelize } = require('../database');
const { verificarAdmin } = require('../middlewares/auth');
const { validateBody, id, text, nonempty, optional, nullable } = require('../middlewares/validateBody');

// ==========================================
// POST /api/plan-requests
// Usuario autenticado solicita un plan
// ==========================================
router.post('/', validateBody({ planId: id }), async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (Object.keys(req.body).some(key => key !== 'planId') || Object.keys(req.query).length) {
    return res.status(400).json({ code: 'invalid_input' });
  }
  let transaction;
  try {
    const { planId } = req.body;
    const userId = req.user.id;

    if (!planId) {
      return res.status(400).json({ error: 'planId es requerido.' });
    }

    // Verificar que el plan existe y está activo
    transaction = await sequelize.transaction();
    // Serialize all submissions for this owner. No client-supplied owner is accepted.
    const owner = await User.findByPk(userId, { attributes: ['id', 'active'], transaction, lock: transaction.LOCK?.UPDATE ?? true });
    if (!owner || owner.active !== true) {
      await transaction.rollback();
      return res.status(401).json({ code: 'session_invalid' });
    }
    const plan = await PricingPlan.findOne({ where: { id: Number(planId), isActive: true }, transaction, lock: transaction.LOCK?.SHARE ?? true });
    if (!plan) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Plan no encontrado o inactivo.' });
    }

    // Verificar que el usuario no tenga ya una solicitud pendiente
    const existing = await PlanRequest.findOne({
      where: { userId, status: 'pending' },
      transaction,
    });
    if (existing) {
      await transaction.rollback();
      return res.status(409).json({
        error: 'Ya tienes una solicitud de plan pendiente. Espera a que el equipo la procese.',
      });
    }

    const request = await PlanRequest.create({ userId, planId: Number(planId), status: 'pending' }, { transaction });
    await transaction.commit();

    res.status(201).json({
      message: 'Solicitud registrada correctamente.',
      request: {
        id:        request.id,
        planId:    request.planId,
        planName:  plan.name_es,
        status:    request.status,
        createdAt: request.createdAt,
      },
    });
  } catch (error) {
    if (transaction && !transaction.finished) await transaction.rollback().catch(() => {});
    console.error('No se pudo registrar la solicitud de plan.');
    res.status(500).json({ error: 'No se pudo registrar la solicitud.' });
  }
});

// ==========================================
// GET /api/plan-requests/me
// Plan request activo del usuario autenticado
// ==========================================
router.get('/me', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.vary('Authorization');
  if (Object.keys(req.query).length) return res.status(400).json({ code: 'invalid_input' });
  try {
    const request = await PlanRequest.findOne({
      where: { userId: req.user.id, status: 'pending' },
      include: [{ model: PricingPlan, as: 'plan', attributes: ['id', 'slug', 'name_es', 'name_en', 'price'] }],
      order: [['createdAt', 'DESC']],
    });

    res.json({ request: request ?? null });
  } catch (error) {
    console.error('No se pudo leer la solicitud propia.');
    res.status(500).json({ error: 'No se pudo obtener la solicitud.' });
  }
});

// ==========================================
// GET /api/admin/plan-requests
// Admin — lista todas las solicitudes pendientes
// ==========================================
router.get('/admin', verificarAdmin, async (req, res) => {
  try {
    const { status = 'pending' } = req.query;

    const requests = await PlanRequest.findAll({
      where: { status },
      include: [
        {
          model: User,
          as: 'requester',
          attributes: ['id', 'name', 'email'],
        },
        {
          model: PricingPlan,
          as: 'plan',
          attributes: ['id', 'slug', 'name_es', 'name_en', 'price', 'currency'],
        },
      ],
      order: [['createdAt', 'ASC']],
    });

    res.json(requests);
  } catch (error) {
    console.error('❌ Error listando plan requests:', error);
    res.status(500).json({ error: 'No se pudieron obtener las solicitudes.' });
  }
});

// ==========================================
// PUT /api/admin/plan-requests/:id/approve
// Admin — aprueba solicitud y asigna el plan
// ==========================================
router.put('/admin/:id/approve', verificarAdmin, validateBody({ adminNote: optional(nullable(text)) }), async (req, res) => {
  try {
    const { id } = req.params;
    const { adminNote } = req.body;
    const adminId = req.user.id;

    const request = await PlanRequest.findByPk(id);
    if (!request) return res.status(404).json({ error: 'Solicitud no encontrada.' });
    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Esta solicitud ya fue procesada.' });
    }

    // Asignar el plan al usuario
    const user = await User.findByPk(request.userId);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });

    await user.update({ planId: request.planId });

    // Marcar la solicitud como aprobada
    await request.update({
      status:     'approved',
      adminNote:  adminNote ?? null,
      resolvedBy: adminId,
      resolvedAt: new Date(),
    });

    res.json({
      message: 'Solicitud aprobada y plan asignado correctamente.',
      userId:  user.id,
      planId:  request.planId,
    });
  } catch (error) {
    console.error('❌ Error aprobando plan request:', error);
    res.status(500).json({ error: 'No se pudo aprobar la solicitud.' });
  }
});

// ==========================================
// PUT /api/admin/plan-requests/:id/reject
// Admin — rechaza solicitud
// ==========================================
router.put('/admin/:id/reject', verificarAdmin, validateBody({ adminNote: nonempty }), async (req, res) => {
  try {
    const { id } = req.params;
    const { adminNote } = req.body;
    const adminId = req.user.id;

    if (!adminNote?.trim()) {
      return res.status(400).json({ error: 'La nota de rechazo es requerida.' });
    }

    const request = await PlanRequest.findByPk(id);
    if (!request) return res.status(404).json({ error: 'Solicitud no encontrada.' });
    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Esta solicitud ya fue procesada.' });
    }

    await request.update({
      status:     'rejected',
      adminNote:  adminNote,
      resolvedBy: adminId,
      resolvedAt: new Date(),
    });

    res.json({ message: 'Solicitud rechazada correctamente.' });
  } catch (error) {
    console.error('❌ Error rechazando plan request:', error);
    res.status(500).json({ error: 'No se pudo rechazar la solicitud.' });
  }
});

module.exports = router;
