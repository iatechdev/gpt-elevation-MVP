// backend/routes/plans.js
// HU-077 — Endpoints públicos y de usuario para planes

const express     = require('express');
const router      = express.Router();
const PricingPlan = require('../PricingPlan');
const User        = require('../User');
const { getLimits } = require('../utils/planLimits');

// ==========================================
// GET /api/plans — Lista pública de planes
// ==========================================
router.get('/', async (req, res) => {
  try {
    const plans = await PricingPlan.findAll({
      where: { isActive: true },
      order: [['order', 'ASC']],
      attributes: [
        'id', 'slug', 'name_es', 'name_en',
        'description_es', 'description_en',
        'price', 'currency', 'period',
        'features_es', 'features_en',
        'isHighlighted', 'order',
      ],
    });
    res.json(plans);
  } catch (error) {
    console.error('❌ Error listando planes:', error);
    res.status(500).json({ error: 'Could not fetch plans.' });
  }
});

// ==========================================
// GET /api/user/plan — Plan del usuario autenticado
// Requiere verificarToken (montado en server.js)
// ==========================================
router.get('/me', async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: [{ model: PricingPlan, as: 'plan' }],
    });

    if (!user) return res.status(404).json({ error: 'User not found.' });

    const plan   = user.plan ?? null;
    const limits = getLimits(plan);

    res.json({
      plan: plan
        ? {
            id:             plan.id,
            slug:           plan.slug,
            name_es:        plan.name_es,
            name_en:        plan.name_en,
            price:          plan.price,
            currency:       plan.currency,
            period:         plan.period,
            features_es:    plan.features_es,
            features_en:    plan.features_en,
            isHighlighted:  plan.isHighlighted,
          }
        : null,
      limits,
    });
  } catch (error) {
    console.error('❌ Error obteniendo plan del usuario:', error);
    res.status(500).json({ error: 'Could not fetch user plan.' });
  }
});

module.exports = router;