// backend/routes/landingContent.js
// GET /api/landing-content — público
// PUT /api/landing-content — solo superadmin, autorizado en la propia ruta.

const express = require('express');
const router  = express.Router();
const LandingContent = require('../LandingContent');
const { verificarSuperAdmin } = require('../middlewares/auth');
const { defaults, catalog } = require('../content/landingDefaults');
const approvedKeys = new Set(catalog.map(entry => entry.key));
const { sequelize } = require('../database');

// ES-279 (E216-7): edición simultánea de textos públicos. El cliente envía `expectedUpdatedAt` (la versión que leyó; null si el texto aún no tenía registro);
// si cambió, 409 con el texto vigente y quién lo guardó, y NO se escribe nada. Sin `expectedUpdatedAt` el servidor conserva el comportamiento anterior
// (el último guarda) hasta que la pantalla lo envíe; entonces pasará a ser obligatorio.
const CONFLICT = { code: 'version_conflict', error: 'Otra persona cambió este texto mientras lo editabas. / Someone else changed this text while you were editing it.' };
const INVALID_EXPECTED = { code: 'invalid_input', field: 'expectedUpdatedAt', error: 'Versión esperada inválida. / Invalid expected version.' };
const parseExpected = (raw) => {
  if (raw === undefined) return { given: false };
  if (raw === null) return { given: true, at: null };
  if (typeof raw !== 'string' || raw.length > 40 || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$/.test(raw)) return { invalid: true };
  const at = new Date(raw);
  return Number.isNaN(at.getTime()) ? { invalid: true } : { given: true, at };
};
const versionOf = (row) => ({ value: row.value, updatedAt: row.updatedAt, updatedBy: row.updated_by });

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
    const expected = parseExpected(req.body.expectedUpdatedAt);
    if (expected.invalid) return res.status(400).json(INVALID_EXPECTED);
    if (!expected.given) {
      await LandingContent.upsert({ key, lang, value, updated_by: req.user.name });
      return res.json({ message: `Contenido '${key}' (${lang}) actualizado correctamente.` });
    }
    // Con versión esperada: lectura con bloqueo y escritura en una sola transacción; de varias ediciones simultáneas solo una gana.
    const outcome = await sequelize.transaction(async (transaction) => {
      const row = await LandingContent.findOne({ where: { key, lang }, transaction, lock: transaction.LOCK.UPDATE });
      if (!row) {
        if (expected.at !== null) return { conflict: null }; // esperaba un registro que ya no existe
        const created = await LandingContent.create({ key, lang, value, updated_by: req.user.name }, { transaction });
        return { saved: created };
      }
      if (expected.at === null || row.updatedAt.getTime() !== expected.at.getTime()) return { conflict: versionOf(row) };
      await row.update({ value, updated_by: req.user.name }, { transaction });
      return { saved: row };
    }).catch((error) => (error && error.name === 'SequelizeUniqueConstraintError' ? { conflict: undefined } : Promise.reject(error)));
    if (outcome.saved) return res.json({ message: `Contenido '${key}' (${lang}) actualizado correctamente.`, updatedAt: outcome.saved.updatedAt });
    const current = outcome.conflict === undefined ? (await LandingContent.findOne({ where: { key, lang } })) : null;
    return res.status(409).json({ ...CONFLICT, current: outcome.conflict ? outcome.conflict : (current ? versionOf(current) : null) });
  } catch {
    console.error('Error actualizando contenido landing.');
    res.status(500).json({ error: 'No se pudo actualizar el contenido.' });
  }
});

// GET /api/landing-content/versions?lang=es — solo superadministración: cada texto guardado con su versión (updatedAt) y quién lo guardó, para que la pantalla
// envíe `expectedUpdatedAt` al editar. La lectura pública no cambia.
router.get('/versions', verificarSuperAdmin, async (req, res) => {
  try {
    const lang = req.query.lang === 'en' ? 'en' : 'es';
    const rows = await LandingContent.findAll({ where: { lang }, order: [['key', 'ASC']] });
    res.set('Cache-Control', 'no-store');
    res.json(rows.map((row) => ({ key: row.key, lang: row.lang, ...versionOf(row) })));
  } catch {
    console.error('Error leyendo versiones de contenido landing.');
    res.status(500).json({ error: 'No se pudieron leer las versiones.' });
  }
});

module.exports = router;
