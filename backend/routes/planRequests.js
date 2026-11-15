// backend/routes/planRequests.js
// HU-077 — Solicitudes de cambio de plan

const express      = require('express');
const router       = express.Router();
const PlanRequest  = require('../PlanRequest');
const PricingPlan  = require('../PricingPlan');
const User         = require('../User');
const { Transaction } = require('sequelize');
const { sequelize } = require('../database');
const { verificarAdmin } = require('../middlewares/auth');
const { isRouteId } = require('../middlewares/params');
const { recordAdminAction } = require('../utils/adminAudit'); // ES-186 B
const { validateBody, id, text, nonempty, optional, nullable } = require('../middlewares/validateBody');

const CLOSED = { code: 'request_closed', error: 'Esta solicitud ya fue resuelta. / This request has already been resolved.' };

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
    const owner = await User.findByPk(userId, { attributes: ['id', 'active', 'planId'], transaction, lock: transaction.LOCK?.UPDATE ?? true });
    if (!owner || owner.active !== true) {
      await transaction.rollback();
      return res.status(401).json({ code: 'session_invalid' });
    }
    const plan = await PricingPlan.findOne({ where: { id: Number(planId), isActive: true }, transaction, lock: transaction.LOCK?.SHARE ?? true });
    if (!plan) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Plan no encontrado o inactivo.' });
    }

    // ES-223: pedir el plan que ya tiene no crea una solicitud redundante para el equipo. El plan actual sale de la fila del dueño (candado de arriba), nunca del cuerpo.
    if (owner.planId !== null && owner.planId !== undefined && Number(owner.planId) === plan.id) {
      await transaction.rollback();
      return res.status(409).json({ code: 'already_on_plan', error: 'Ya tienes este plan. / You already have this plan.' });
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
// ES-262 (E203-1): un id que no es un entero positivo de la columna es el mismo 404 uniforme que uno inexistente (antes: 500 de la base). Va DESPUÉS de la guarda de rol.
const routeIdGuard = (req, res, next) => (isRouteId(req.params.id) ? next() : res.status(404).json({ code: 'not_found', error: 'No se encontró. / Not found.' }));

router.put('/admin/:id/approve', verificarAdmin, routeIdGuard, validateBody({ adminNote: optional(nullable(text)) }), async (req, res) => {
  // ES-186 (parte A): una transacción con la solicitud BLOQUEADA; la segunda aprobación/rechazo simultáneo espera y recibe 409 request_closed (antes: doble efecto sobre el plan).
  const transaction = await sequelize.transaction();
  const reply = async (status, body) => { await transaction.rollback().catch(() => {}); return res.status(status).json(body); };
  try {
    const { id } = req.params;
    const { adminNote } = req.body;
    const adminId = req.user.id;

    const request = await PlanRequest.findByPk(id, { transaction, lock: Transaction.LOCK.UPDATE });
    if (!request) return await reply(404, { error: 'Solicitud no encontrada.' });
    if (request.status !== 'pending') return await reply(409, CLOSED);

    // Asignar el plan al usuario
    const user = await User.findByPk(request.userId, { transaction, lock: Transaction.LOCK.UPDATE });
    if (!user) return await reply(404, { error: 'Usuario no encontrado.' });

    await user.update({ planId: request.planId }, { transaction });

    // Marcar la solicitud como aprobada
    await request.update({
      status:     'approved',
      adminNote:  adminNote ?? null,
      resolvedBy: adminId,
      resolvedAt: new Date(),
    }, { transaction });
    await recordAdminAction({ actor: req.user, action: 'plan_request.approve', targetType: 'plan_request', targetId: request.id }, { transaction }); // ES-186 B
    await transaction.commit();

    res.json({
      message: 'Solicitud aprobada y plan asignado correctamente.',
      userId:  user.id,
      planId:  request.planId,
    });
  } catch (error) {
    await transaction.rollback().catch(() => {});
    console.error('Error aprobando plan request.');
    res.status(500).json({ error: 'No se pudo aprobar la solicitud.' });
  }
});

// ==========================================
// PUT /api/admin/plan-requests/:id/reject
// Admin — rechaza solicitud
// ==========================================
router.put('/admin/:id/reject', verificarAdmin, routeIdGuard, validateBody({ adminNote: nonempty }), async (req, res) => {
  const transaction = await sequelize.transaction();
  const reply = async (status, body) => { await transaction.rollback().catch(() => {}); return res.status(status).json(body); };
  try {
    const { id } = req.params;
    const { adminNote } = req.body;
    const adminId = req.user.id;

    if (!adminNote?.trim()) return await reply(400, { error: 'La nota de rechazo es requerida.' });

    const request = await PlanRequest.findByPk(id, { transaction, lock: Transaction.LOCK.UPDATE });
    if (!request) return await reply(404, { error: 'Solicitud no encontrada.' });
    if (request.status !== 'pending') return await reply(409, CLOSED);

    await request.update({
      status:     'rejected',
      adminNote:  adminNote,
      resolvedBy: adminId,
      resolvedAt: new Date(),
    }, { transaction });
    await recordAdminAction({ actor: req.user, action: 'plan_request.reject', targetType: 'plan_request', targetId: request.id }, { transaction }); // ES-186 B
    await transaction.commit();

    res.json({ message: 'Solicitud rechazada correctamente.' });
  } catch (error) {
    await transaction.rollback().catch(() => {});
    console.error('Error rechazando plan request.');
    res.status(500).json({ error: 'No se pudo rechazar la solicitud.' });
  }
});

module.exports = router;
