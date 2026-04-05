// backend/routes/landingContent.js
// GET /api/landing-content — público
// PUT /api/landing-content — solo superadmin (middleware aplicado en server.js)

const express = require('express');
const router  = express.Router();
const LandingContent = require('../LandingContent');

const LANDING_DEFAULTS = {
  es: {
    hero_title:         'Encuentra tu calma interior',
    hero_subtitle:      'Tu compañero privado para la claridad mental y el bienestar emocional.',
    cta_primary:        'Iniciar conversación',
    cta_final_title:    '¿Listo para empezar?',
    cta_final_subtitle: 'Sin tarjeta de crédito.',
  },
  en: {
    hero_title:         'Find your inner calm',
    hero_subtitle:      'Your private companion for mental clarity and emotional wellbeing.',
    cta_primary:        'Start a conversation',
    cta_final_title:    'Ready to begin?',
    cta_final_subtitle: 'No credit card required.',
  },
};

// GET /api/landing-content
router.get('/', async (req, res) => {
  try {
    const lang = req.query.lang === 'en' ? 'en' : 'es';
    const registros = await LandingContent.findAll({ where: { lang } });
    const content = { ...LANDING_DEFAULTS[lang] };
    registros.forEach(r => { content[r.key] = r.value; });
    res.json(content);
  } catch (error) {
    console.error('❌ Error obteniendo contenido landing:', error);
    const lang = req.query.lang === 'en' ? 'en' : 'es';
    res.json(LANDING_DEFAULTS[lang]);
  }
});

// PUT /api/landing-content — verificarSuperAdmin aplicado en server.js
router.put('/', async (req, res) => {
  try {
    const { key, lang, value } = req.body;
    if (!key || !lang || !value)
      return res.status(400).json({ error: 'key, lang y value son requeridos.' });
    if (!['es', 'en'].includes(lang))
      return res.status(400).json({ error: 'lang debe ser es o en.' });
    await LandingContent.upsert({ key, lang, value, updated_by: req.user.name });
    res.json({ message: `Contenido '${key}' (${lang}) actualizado correctamente.` });
  } catch (error) {
    console.error('❌ Error actualizando contenido landing:', error);
    res.status(500).json({ error: 'No se pudo actualizar el contenido.' });
  }
});

module.exports = router;