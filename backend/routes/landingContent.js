// backend/routes/landingContent.js
// GET /api/landing-content — público
// PUT /api/landing-content — solo superadmin, autorizado en la propia ruta.

const express = require('express');
const router  = express.Router();
const LandingContent = require('../LandingContent');
const { verificarSuperAdmin } = require('../middlewares/auth');
const { defaults, catalog } = require('../content/landingDefaults');
const approvedKeys = new Set(catalog.map(entry => entry.key));

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
    const content = { ...LANDING_DEFAULTS[lang], ...defaults[lang] };
    registros.forEach(r => {
      // ES-106 (ES94-C03): un texto guardado de una clave `landing.*` que ya no está en el catálogo (p. ej. una clave eliminada) no se publica.
      if (typeof r.key === 'string' && r.key.startsWith('landing.') && !approvedKeys.has(r.key)) return;
      if (typeof r.value === 'string' && r.value.trim()) content[r.key] = r.value;
    });
    res.json(content);
  } catch {
    console.error('Error obteniendo contenido landing.');
    const lang = req.query.lang === 'en' ? 'en' : 'es';
    res.json({ ...LANDING_DEFAULTS[lang], ...defaults[lang] });
  }
});

// PUT /api/landing-content
router.put('/', verificarSuperAdmin, async (req, res) => {
  try {
    const { key, lang, value } = req.body ?? {};
    if (typeof key !== 'string' || !key.trim() ||
        typeof lang !== 'string' || !lang ||
        typeof value !== 'string' || !value.trim())
      return res.status(400).json({ error: 'key, lang y value son requeridos.' });
    if (!['es', 'en'].includes(lang))
      return res.status(400).json({ error: 'lang debe ser es o en.' });
    if (key.startsWith('landing.') && !approvedKeys.has(key))
      return res.status(400).json({ error: lang === 'en' ? 'Unknown landing key.' : 'Clave landing desconocida.' });
    if (key.length > 255 || value.length > 5000)
      return res.status(400).json({ error: lang === 'en' ? 'Content exceeds the allowed length.' : 'El contenido supera la longitud permitida.' });
    await LandingContent.upsert({ key, lang, value, updated_by: req.user.name });
    res.json({ message: `Contenido '${key}' (${lang}) actualizado correctamente.` });
  } catch {
    console.error('Error actualizando contenido landing.');
    res.status(500).json({ error: 'No se pudo actualizar el contenido.' });
  }
});

module.exports = router;
