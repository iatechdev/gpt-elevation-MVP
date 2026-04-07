// backend/routes/pricing.js
const express     = require('express');
const router      = express.Router();
const PricingPlan = require('../PricingPlan');

// GET /api/pricing — público
router.get('/', async (req, res) => {
  try {
    const plans = await PricingPlan.findAll({
      where: { isActive: true },
      order: [['order', 'ASC']],
    });
    res.json(plans);
  } catch (error) {
    console.error('❌ Error obteniendo planes:', error);
    res.status(500).json({ error: 'No se pudieron obtener los planes.' });
  }
});

// GET /api/admin/pricing/all — todos los planes (activos e inactivos)
router.get('/all', async (req, res) => {
  try {
    const plans = await PricingPlan.findAll({
      order: [['order', 'ASC']],
    });
    res.json(plans);
  } catch (error) {
    console.error('❌ Error obteniendo planes:', error);
    res.status(500).json({ error: 'No se pudieron obtener los planes.' });
  }
});

// POST /api/admin/pricing/seed — carga los 4 planes base (idempotente)
router.post('/seed', async (req, res) => {
  try {
    const PLANS = [
      {
        slug:           'basic',
        name_es:        'Básico',
        name_en:        'Basic',
        description_es: 'Acceso gratuito para empezar tu camino de bienestar.',
        description_en: 'Free access to start your wellness journey.',
        price:          0,
        currency:       'USD',
        period:         'month',
        features_es:    ['10 mensajes IA por día', 'Check-in emocional diario', 'Recomendaciones básicas'],
        features_en:    ['10 AI messages per day', 'Daily emotional check-in', 'Basic recommendations'],
        isHighlighted:  false,
        isActive:       true,
        order:          1,
      },
      {
        slug:           'essential',
        name_es:        'Esencial',
        name_en:        'Essential',
        description_es: 'Todo lo que necesitás para un acompañamiento real.',
        description_en: 'Everything you need for real support.',
        price:          12,
        currency:       'USD',
        period:         'month',
        features_es:    ['30 mensajes IA por día', '1 sesión con terapeuta / mes', 'Acceso a mi progreso', 'Matching con terapeuta'],
        features_en:    ['30 AI messages per day', '1 therapist session / month', 'Progress tracking', 'Therapist matching'],
        isHighlighted:  false,
        isActive:       true,
        order:          2,
      },
      {
        slug:           'plus',
        name_es:        'Plus',
        name_en:        'Plus',
        description_es: 'Para quienes quieren un proceso terapéutico consistente.',
        description_en: 'For those who want a consistent therapeutic process.',
        price:          29,
        currency:       'USD',
        period:         'month',
        features_es:    ['100 mensajes IA por día', '4 sesiones con terapeuta / mes', 'Acceso a mi progreso', 'Matching prioritario'],
        features_en:    ['100 AI messages per day', '4 therapist sessions / month', 'Progress tracking', 'Priority matching'],
        isHighlighted:  true,
        isActive:       true,
        order:          3,
      },
      {
        slug:           'pro',
        name_es:        'Pro',
        name_en:        'Pro',
        description_es: 'Acceso ilimitado para el máximo nivel de bienestar.',
        description_en: 'Unlimited access for the highest level of wellness.',
        price:          59,
        currency:       'USD',
        period:         'month',
        features_es:    ['Mensajes IA ilimitados', 'Sesiones ilimitadas / mes', 'Acceso completo a progreso', 'Matching VIP', 'Soporte prioritario'],
        features_en:    ['Unlimited AI messages', 'Unlimited sessions / month', 'Full progress access', 'VIP matching', 'Priority support'],
        isHighlighted:  false,
        isActive:       true,
        order:          4,
      },
    ];

    const results = [];
    for (const p of PLANS) {
      const [plan, created] = await PricingPlan.findOrCreate({
        where: { slug: p.slug },
        defaults: p,
      });
      results.push({ slug: plan.slug, created });
    }

    res.json({ message: 'Seed completado.', results });
  } catch (error) {
    console.error('❌ Error en seed de planes:', error);
    res.status(500).json({ error: 'No se pudo completar el seed.' });
  }
});

// POST /api/admin/pricing — crear plan
router.post('/', async (req, res) => {
  try {
    const {
      slug,
      name_es, name_en, description_es, description_en,
      price, currency, period,
      features_es, features_en,
      isHighlighted, order,
    } = req.body;

    if (!name_es || !name_en || !slug)
      return res.status(400).json({ error: 'slug, name_es y name_en son requeridos.' });

    const plan = await PricingPlan.create({
      slug,
      name_es, name_en,
      description_es: description_es ?? '',
      description_en: description_en ?? '',
      price:          price          ?? 0,
      currency:       currency       ?? 'USD',
      period:         period         ?? 'month',
      features_es:    features_es    ?? [],
      features_en:    features_en    ?? [],
      isHighlighted:  isHighlighted  ?? false,
      isActive:       true,
      order:          order          ?? 0,
    });

    res.status(201).json({ message: 'Plan creado exitosamente.', plan });
  } catch (error) {
    console.error('❌ Error creando plan:', error);
    res.status(500).json({ error: 'No se pudo crear el plan.' });
  }
});

// PUT /api/admin/pricing/:id — editar plan
router.put('/:id', async (req, res) => {
  try {
    const plan = await PricingPlan.findByPk(req.params.id);
    if (!plan) return res.status(404).json({ error: 'Plan no encontrado.' });

    const allowed = [
      'slug','name_es','name_en','description_es','description_en',
      'price','currency','period',
      'features_es','features_en',
      'isHighlighted','isActive','order',
    ];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    await plan.update(updates);
    res.json({ message: 'Plan actualizado correctamente.', plan });
  } catch (error) {
    console.error('❌ Error actualizando plan:', error);
    res.status(500).json({ error: 'No se pudo actualizar el plan.' });
  }
});

// DELETE /api/admin/pricing/:id — soft delete
router.delete('/:id', async (req, res) => {
  try {
    const plan = await PricingPlan.findByPk(req.params.id);
    if (!plan) return res.status(404).json({ error: 'Plan no encontrado.' });
    await plan.update({ isActive: false });
    res.json({ message: 'Plan desactivado correctamente.' });
  } catch (error) {
    console.error('❌ Error desactivando plan:', error);
    res.status(500).json({ error: 'No se pudo desactivar el plan.' });
  }
});

module.exports = router;