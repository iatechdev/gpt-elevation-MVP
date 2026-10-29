// backend/routes/plans.js
// HU-077 — Endpoints públicos y de usuario para planes

const express     = require('express');
const router      = express.Router();
const PricingPlan = require('../PricingPlan');
const User        = require('../User');
const { getLimits } = require('../utils/planLimits');
const { verificarToken } = require('../middlewares/auth');
const publicPricingCopy = require('../content/publicPricingCopy');

// ==========================================
// GET /api/plans — Lista pública de planes
// ==========================================
router.get('/', async (req, res) => {
  res.set('Cache-Control', 'no-store');
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
    res.json(plans.map(publicPricingCopy));
  } catch (error) {
    console.error('No se pudieron leer los planes.');
    res.status(500).json({ error: 'Could not fetch plans.' });
  }
});

// ==========================================
// GET /api/user/plan — Plan del usuario autenticado
// Requiere verificarToken (montado en server.js)
// ==========================================
router.get('/me', verificarToken, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.vary('Authorization');
  if (Object.keys(req.query).length) return res.status(400).json({ code: 'invalid_input' });
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
    console.error('No se pudo leer el plan propio.');
    res.status(500).json({ error: 'Could not fetch user plan.' });
  }
});

module.exports = router;
