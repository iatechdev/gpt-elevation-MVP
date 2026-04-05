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

// GET /api/admin/pricing — todos los planes (activos e inactivos)
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

// POST /api/admin/pricing — crear plan
router.post('/', async (req, res) => {
  try {
    const {
      name_es, name_en, description_es, description_en,
      price, currency, period,
      features_es, features_en,
      isHighlighted, order,
    } = req.body;

    if (!name_es || !name_en)
      return res.status(400).json({ error: 'name_es y name_en son requeridos.' });

    const plan = await PricingPlan.create({
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
      'name_es','name_en','description_es','description_en',
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