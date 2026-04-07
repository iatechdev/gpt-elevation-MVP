// backend/routes/planRequests.js
// HU-077 — Solicitudes de cambio de plan

const express      = require('express');
const router       = express.Router();
const PlanRequest  = require('../PlanRequest');
const PricingPlan  = require('../PricingPlan');
const User         = require('../User');

// ==========================================
// POST /api/plan-requests
// Usuario autenticado solicita un plan
// ==========================================
router.post('/', async (req, res) => {
  try {
    const { planId } = req.body;
    const userId = req.user.id;

    if (!planId) {
      return res.status(400).json({ error: 'planId es requerido.' });
    }

    // Verificar que el plan existe y está activo
    const plan = await PricingPlan.findOne({ where: { id: planId, isActive: true } });
    if (!plan) {
      return res.status(404).json({ error: 'Plan no encontrado o inactivo.' });
    }

    // Verificar que el usuario no tenga ya una solicitud pendiente
    const existing = await PlanRequest.findOne({
      where: { userId, status: 'pending' },
    });
    if (existing) {
      return res.status(409).json({
        error: 'Ya tenés una solicitud de plan pendiente. Esperá a que el equipo la procese.',
      });
    }

    const request = await PlanRequest.create({ userId, planId, status: 'pending' });

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
    console.error('❌ Error creando plan request:', error);
    res.status(500).json({ error: 'No se pudo registrar la solicitud.' });
  }
});

// ==========================================
// GET /api/plan-requests/me
// Plan request activo del usuario autenticado
// ==========================================
router.get('/me', async (req, res) => {
  try {
    const request = await PlanRequest.findOne({
      where: { userId: req.user.id, status: 'pending' },
      include: [{ model: PricingPlan, as: 'plan', attributes: ['id', 'slug', 'name_es', 'name_en', 'price'] }],
      order: [['createdAt', 'DESC']],
    });

    res.json({ request: request ?? null });
  } catch (error) {
    console.error('❌ Error obteniendo plan request:', error);
    res.status(500).json({ error: 'No se pudo obtener la solicitud.' });
  }
});

// ==========================================
// GET /api/admin/plan-requests
// Admin — lista todas las solicitudes pendientes
// ==========================================
router.get('/admin', async (req, res) => {
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
router.put('/admin/:id/approve', async (req, res) => {
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
router.put('/admin/:id/reject', async (req, res) => {
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