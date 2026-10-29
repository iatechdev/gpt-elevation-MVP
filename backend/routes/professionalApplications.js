// backend/routes/professionalApplications.js
// ES-95 — Solicitud pública de profesionales de psicología.
//   POST /api/professional-applications                 (público, multipart; límite de intentos)
//   GET  /api/admin/professional-applications           (admin y superadmin)
//   GET  /api/admin/professional-applications/:id/cv    (descarga autenticada de la hoja de vida)
//   PUT  /api/admin/professional-applications/:id/approve | /reject
//   DELETE /api/admin/professional-applications/:id
// Aprobar solo cambia el estado: no crea cuentas, roles ni contraseñas (la cuenta la crea el administrador con «Crear usuario»).

const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const { sequelize } = require('../database');
const ProfessionalApplication = require('../ProfessionalApplication');
const ProfessionalApplicationFile = require('../ProfessionalApplicationFile');
const { encriptarBuffer, desencriptarBuffer } = require('../utils/crypto');
const { normalizeText } = require('../utils/promptSafety');
const { validateBody, nonempty, text } = require('../middlewares/validateBody');
const { MAX_CV_BYTES, STATUSES, validateApplication, ack, capacityLimits, isFull } = require('../utils/professionalApplication');

const CLOSED = { error: 'Por ahora no estamos recibiendo solicitudes. Inténtalo más tarde. / We are not accepting requests right now. Please try again later.', code: 'not_accepting' };
const BAD_REQUEST = { error: 'Solicitud inválida. / Invalid request.', code: 'invalid_request' };
const NOTE_MAX = 1000;

// ES-107: uso actual para el tope global (solicitudes pendientes y bytes de hojas de vida almacenadas).
const LOCK_KEY = 1070001;
async function usage(transaction) {
  const pending = await ProfessionalApplication.count({ where: { status: 'pending' }, transaction });
  const bytes = Number(await ProfessionalApplicationFile.sum('size', { transaction })) || 0;
  return { pending, bytes };
}

// ── Público ──────────────────────────────────────────────────────────────
const publicRouter = express.Router();

// Límite por IP; el máximo se lee en cada petición para poder probarlo.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: () => Number(process.env.PRO_APP_RATE_MAX) || 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Inténtalo más tarde. / Too many attempts. Please try later.', code: 'rate_limited' },
});

// Memoria: el archivo nunca toca el disco. Un archivo, un campo «cv», tamaño máximo acotado.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_CV_BYTES, files: 1, fields: 12, fieldSize: 8 * 1024, parts: 14 },
});
const receive = (req, res, next) => upload.single('cv')(req, res, (error) => {
  if (!error) return next();
  if (error.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ ...BAD_REQUEST, code: 'invalid_fields', fields: ['cv'] });
  return res.status(400).json(BAD_REQUEST);
});

publicRouter.post('/', limiter, receive, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  // Campo trampa: un bot lo rellena; se responde igual que un éxito y no se guarda nada.
  if (typeof body.bot_trap === 'string' && body.bot_trap.trim()) return res.status(201).json({ message: ack.es });

  const checked = validateApplication(body, req.file);
  if (!checked.ok) {
    return res.status(400).json({ error: 'Revisa los campos marcados. / Check the marked fields.', code: 'invalid_fields', fields: checked.fields });
  }
  const values = checked.values;
  try {
    // Mismo correo con una solicitud pendiente o aprobada: misma respuesta, sin duplicar ni revelar nada.
    const existing = await ProfessionalApplication.findOne({ where: { email: values.email, status: ['pending', 'approved'] }, attributes: ['id'] });
    if (!existing) {
      const transaction = await sequelize.transaction();
      try {
        // ES-107: tope global. El candado serializa los envíos en Postgres para que 20 simultáneos no lo rebasen; la respuesta no revela cifras.
        if (sequelize.getDialect() === 'postgres') await sequelize.query('SELECT pg_advisory_xact_lock(:key)', { replacements: { key: LOCK_KEY }, transaction });
        if (isFull(await usage(transaction), capacityLimits())) { await transaction.rollback(); return res.status(503).json(CLOSED); }
        const application = await ProfessionalApplication.create({ ...values, status: 'pending', consentAt: new Date() }, { transaction });
        await ProfessionalApplicationFile.create({
          ApplicationId: application.id,
          size: req.file.buffer.length,
          sha256: crypto.createHash('sha256').update(req.file.buffer).digest('hex'),
          data: encriptarBuffer(req.file.buffer),
        }, { transaction });
        await transaction.commit();
      } catch (error) {
        await transaction.rollback().catch(() => {});
        // Envío simultáneo del mismo correo: otro ya lo guardó (índice único parcial). Misma respuesta, nada duplicado.
        if (error && (error.name === 'SequelizeUniqueConstraintError' || error.parent?.code === '23505')) return res.status(201).json({ message: ack[values.locale] });
        throw error;
      }
    }
    return res.status(201).json({ message: ack[values.locale] });
  } catch {
    console.error('Error guardando una solicitud de profesional.'); // sin datos personales ni detalles del error
    return res.status(500).json({ error: 'No se pudo guardar la solicitud. / The request could not be saved.', code: 'internal_error' });
  }
});

// ── Backoffice (verificarAdmin en server.js) ─────────────────────────────
const adminRouter = express.Router();
adminRouter.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

const withId = (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json(BAD_REQUEST);
  req.applicationId = id;
  next();
};

const view = (row, file) => ({
  id: row.id, name: row.name, email: row.email, country: row.country, profession: row.profession,
  licenseNumber: row.licenseNumber ?? null, profileUrl: row.profileUrl ?? null, message: row.message ?? null,
  locale: row.locale, status: row.status, reviewedBy: row.reviewedBy ?? null, reviewNote: row.reviewNote ?? null,
  reviewedAt: row.reviewedAt ?? null, userId: row.userId ?? null, createdAt: row.createdAt,
  cv: file ? { size: file.size } : null,
});

// Aviso del backoffice: ¿el formulario está cerrado por el tope? (ES-107). Solo admin; nunca en la ruta pública.
adminRouter.get('/capacity', async (req, res) => {
  try {
    const limits = capacityLimits(); const used = await usage();
    res.json({ full: isFull(used, limits), pending: used.pending, maxPending: limits.maxPending, bytes: used.bytes, maxBytes: limits.maxBytes });
  } catch {
    console.error('Error leyendo el uso de solicitudes de profesionales.');
    res.status(500).json({ error: 'No se pudo leer el uso.', code: 'internal_error' });
  }
});

adminRouter.get('/', async (req, res) => {
  const status = req.query.status;
  if (status !== undefined && !STATUSES.includes(status)) return res.status(400).json(BAD_REQUEST);
  try {
    const rows = await ProfessionalApplication.findAll({ where: status ? { status } : {}, order: [['createdAt', 'DESC']], limit: 200 });
    const ids = rows.map(row => row.id);
    const files = ids.length ? await ProfessionalApplicationFile.findAll({ where: { ApplicationId: ids }, attributes: ['ApplicationId', 'size'] }) : [];
    const sizes = new Map(files.map(file => [file.ApplicationId, file]));
    res.json(rows.map(row => view(row, sizes.get(row.id))));
  } catch {
    console.error('Error listando solicitudes de profesionales.');
    res.status(500).json({ error: 'No se pudieron cargar las solicitudes.', code: 'internal_error' });
  }
});

adminRouter.get('/:id/cv', withId, async (req, res) => {
  try {
    const file = await ProfessionalApplicationFile.findOne({ where: { ApplicationId: req.applicationId } });
    if (!file) return res.status(404).json({ error: 'Hoja de vida no encontrada.', code: 'not_found' });
    const pdf = desencriptarBuffer(file.data);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="solicitud-${req.applicationId}-hoja-de-vida.pdf"`,
      'X-Content-Type-Options': 'nosniff',
      'Content-Length': String(pdf.length),
    });
    return res.status(200).end(pdf);
  } catch {
    console.error('Error descargando una hoja de vida.');
    return res.status(500).json({ error: 'No se pudo descargar la hoja de vida.', code: 'internal_error' });
  }
});

// Cambia el estado solo si sigue pendiente (dos revisores a la vez: gana uno; el otro recibe 409).
async function review(req, res, status, note) {
  try {
    const row = await ProfessionalApplication.findByPk(req.applicationId, { attributes: ['id'] });
    if (!row) return res.status(404).json({ error: 'Solicitud no encontrada.', code: 'not_found' });
    const [changed] = await ProfessionalApplication.update(
      { status, reviewedBy: String(req.user.name ?? '').slice(0, 120) || null, reviewNote: note, reviewedAt: new Date() },
      { where: { id: req.applicationId, status: 'pending' } },
    );
    if (!changed) return res.status(409).json({ error: 'La solicitud ya fue revisada.', code: 'already_reviewed' });
    return res.json({ id: req.applicationId, status });
  } catch {
    console.error('Error revisando una solicitud de profesional.');
    return res.status(500).json({ error: 'No se pudo registrar la revisión.', code: 'internal_error' });
  }
}
const noteOf = (value) => { const note = normalizeText(value ?? '').trim(); return note.length ? note : null; };
const validNote = (value) => value === undefined || (text(value) && value.length <= NOTE_MAX);

adminRouter.put('/:id/approve', withId, validateBody({ note: validNote }), (req, res) => review(req, res, 'approved', noteOf(req.body.note)));
adminRouter.put('/:id/reject', withId, validateBody({ note: (value) => nonempty(value) && noteOf(value) !== null && value.length <= NOTE_MAX }),
  (req, res) => review(req, res, 'rejected', noteOf(req.body.note)));

// Borrado a solicitud de la persona o por retención: la hoja de vida se elimina en cascada.
adminRouter.delete('/:id', withId, async (req, res) => {
  try {
    const removed = await ProfessionalApplication.destroy({ where: { id: req.applicationId } });
    if (!removed) return res.status(404).json({ error: 'Solicitud no encontrada.', code: 'not_found' });
    return res.json({ id: req.applicationId, deleted: true });
  } catch {
    console.error('Error eliminando una solicitud de profesional.');
    return res.status(500).json({ error: 'No se pudo eliminar la solicitud.', code: 'internal_error' });
  }
});

module.exports = { publicRouter, adminRouter };
