// backend/routes/validation.js
// HU-075 — Validación académica de terapeutas
//
// Rutas terapeuta (verificarToken en server.js):
//   POST /api/therapist/validation/upload
//   GET  /api/therapist/validation/status
//
// Rutas Junta (verificarSuperAdmin en server.js):
//   GET  /api/junta/validations/pending
//   GET  /api/junta/validations/:id/download
//   POST /api/junta/validations/:id/approve
//   POST /api/junta/validations/:id/reject

const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const path     = require('path');
const User     = require('../User');
const TherapistValidation = require('../TherapistValidation');
const { uploadFile, getSignedUrl } = require('../utils/storage');
const { verificarSuperAdmin } = require('../middlewares/auth');
const { validateBody, optional, text, nonempty } = require('../middlewares/validateBody');
const { validateIdParams } = require('../middlewares/params');
const { ALLOWED_TYPES, contentMatches, safeDocumentName, storageName } = require('../utils/uploadSafety');

validateIdParams(router, 'id'); // ES-99 (ES93-B1): ids de ruta mal formados = 404 uniforme

// Multer en memoria — no guarda en disco, va directo al almacenamiento de documentos
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB máximo
class UnsupportedTypeError extends Error {}
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1, fields: 5, parts: 8 },
  fileFilter: (req, file, cb) => (ALLOWED_TYPES.includes(file.mimetype) ? cb(null, true) : cb(new UnsupportedTypeError())),
});

// ES-99 (ES93-M4): ningún error de la subida llega al manejador por defecto de Express (HTML con traza y rutas del servidor).
const problem = (res, status, code, es, en) => res.status(status).json({ code, error: `${es} / ${en}` });
function uploadDocument(req, res, next) {
  upload.single('document')(req, res, (error) => {
    if (!error) return next();
    if (error instanceof UnsupportedTypeError) return problem(res, 400, 'unsupported_file_type', 'Solo se permiten PDF, JPG, PNG o WEBP.', 'Only PDF, JPG, PNG or WEBP files are allowed.');
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') return problem(res, 413, 'file_too_large', 'El archivo supera los 10 MB.', 'The file exceeds 10 MB.');
    console.error('⚠️  Subida de documento rechazada:', error && (error.code || error.name)); // nunca el mensaje ni la traza
    return problem(res, 400, 'invalid_upload', 'La subida no es válida. Envía un solo archivo en el campo «document».', 'The upload is not valid. Send a single file in the "document" field.');
  });
}
const onlyTherapist = (req, res, next) => (req.user.role === 'therapist' ? next() : res.status(403).json({ error: 'Solo terapeutas pueden subir documentos.' }));
// ── RUTAS TERAPEUTA ───────────────────────────────────────────────────────────

// POST /api/therapist/validation/upload
router.post('/upload', onlyTherapist, uploadDocument, async (req, res) => {
  try {
    if (!req.file) {
      return problem(res, 400, 'no_file', 'No se recibió ningún archivo.', 'No file was received.');
    }
    if (req.file.size === 0) {
      return problem(res, 400, 'empty_file', 'El archivo está vacío.', 'The file is empty.');
    }
    // El tipo declarado no basta: el contenido debe ser de verdad de ese tipo (un .exe renombrado como imagen se rechaza).
    if (!contentMatches(req.file.mimetype, req.file.buffer)) {
      return problem(res, 400, 'file_content_mismatch', 'El contenido del archivo no corresponde a su tipo.', 'The file content does not match its type.');
    }

    const { documentType } = req.body;
    const validTypes = ['titulo', 'certificado', 'colegiado', 'otro'];
    const docType = validTypes.includes(documentType) ? documentType : 'titulo';

    // Ruta en el almacenamiento: therapist-docs/{therapistId}/{timestamp}_{nombre saneado}
    const destination = `therapist-docs/${req.user.id}/${Date.now()}_${storageName(req.file.originalname)}`;

    try {
      await uploadFile(req.file.buffer, destination, req.file.mimetype);
    } catch (error) {
      // Almacenamiento no disponible o mal configurado: respuesta genérica; el detalle (que puede incluir rutas de credenciales) no sale del servidor.
      console.error('❌ Almacenamiento de documentos no disponible:', error && (error.code || error.name));
      return problem(res, 503, 'storage_unavailable', 'No se pudo guardar el documento ahora. Inténtalo más tarde.', 'The document could not be saved right now. Please try again later.');
    }

    // Guardar metadata en BD
    const validation = await TherapistValidation.create({
      therapistId:  req.user.id,
      documentType: docType,
      documentName: safeDocumentName(req.file.originalname),
      documentPath: destination,
      status:       'pending',
      submittedAt:  new Date(),
    });

    res.status(201).json({
      message:    'Documento subido exitosamente. La Junta lo revisará pronto.',
      validation: {
        id:           validation.id,
        documentType: validation.documentType,
        documentName: validation.documentName,
        status:       validation.status,
        submittedAt:  validation.submittedAt,
      },
    });
  } catch (error) {
    console.error('❌ Error subiendo documento:', error && (error.code || error.name));
    res.status(500).json({ error: 'No se pudo subir el documento. / The document could not be uploaded.' });
  }
});
// GET /api/therapist/validation/status
router.get('/status', async (req, res) => {
  try {
    if (req.user.role !== 'therapist') {
      return res.status(403).json({ error: 'Solo terapeutas.' });
    }

    const validations = await TherapistValidation.findAll({
      where:  { therapistId: req.user.id },
      order:  [['submittedAt', 'DESC']],
      attributes: ['id', 'documentType', 'documentName', 'status', 'reviewNote', 'submittedAt', 'reviewedAt'],
    });

    res.json(validations);
  } catch (error) {
    console.error('❌ Error obteniendo estado:', error);
    res.status(500).json({ error: 'No se pudo obtener el estado.' });
  }
});

// ── RUTAS JUNTA ───────────────────────────────────────────────────────────────

// GET /api/junta/validations/pending
router.get('/pending', verificarSuperAdmin, async (req, res) => {
  try {
    const validations = await TherapistValidation.findAll({
      where: { status: 'pending' },
      order: [['submittedAt', 'ASC']],
    });

    // Enriquecer con nombre del terapeuta
    const enriched = await Promise.all(validations.map(async (v) => {
      const therapist = await User.findByPk(v.therapistId, {
        attributes: ['id', 'name', 'email'],
      });
      return {
        id:           v.id,
        therapist:    therapist?.toJSON() ?? { id: v.therapistId, name: 'Desconocido' },
        documentType: v.documentType,
        documentName: v.documentName,
        documentPath: v.documentPath,
        status:       v.status,
        submittedAt:  v.submittedAt,
      };
    }));

    res.json(enriched);
  } catch (error) {
    console.error('❌ Error obteniendo pendientes:', error);
    res.status(500).json({ error: 'No se pudieron obtener los documentos pendientes.' });
  }
});

// GET /api/junta/validations/:id/download — genera signed URL temporal
router.get('/:id/download', verificarSuperAdmin, async (req, res) => {
  try {
    const validation = await TherapistValidation.findByPk(req.params.id);
    if (!validation) return res.status(404).json({ error: 'Documento no encontrado.' });

    let signedUrl;
    try {
      signedUrl = await getSignedUrl(validation.documentPath);
    } catch (error) {
      console.error('❌ Almacenamiento de documentos no disponible:', error && (error.code || error.name));
      return problem(res, 503, 'storage_unavailable', 'No se pudo generar el enlace de descarga ahora.', 'The download link could not be generated right now.');
    }
    res.json({ url: signedUrl, expiresIn: '1 hora' });
  } catch (error) {
    console.error('❌ Error generando URL:', error && (error.code || error.name));
    res.status(500).json({ error: 'No se pudo generar el enlace de descarga.' });
  }
});

// POST /api/junta/validations/:id/approve
router.post('/:id/approve', verificarSuperAdmin, validateBody({ note: optional(text) }), async (req, res) => {
  try {
    const validation = await TherapistValidation.findByPk(req.params.id);
    if (!validation) return res.status(404).json({ error: 'Documento no encontrado.' });
    if (validation.status !== 'pending') {
      return res.status(400).json({ error: 'Este documento ya fue revisado.' });
    }

    const { note } = req.body;

    // Actualizar validación
    await validation.update({
      status:     'approved',
      reviewedBy: req.user.name,
      reviewNote: note ?? '',
      reviewedAt: new Date(),
    });

    // Activar terapeuta
    await User.update(
      { active: true },
      { where: { id: validation.therapistId } }
    );

    res.json({ message: 'Terapeuta aprobado y activado exitosamente.' });
  } catch (error) {
    console.error('❌ Error aprobando:', error);
    res.status(500).json({ error: 'No se pudo aprobar el documento.' });
  }
});

// POST /api/junta/validations/:id/reject
router.post('/:id/reject', verificarSuperAdmin, validateBody({ note: nonempty }), async (req, res) => {
  try {
    const validation = await TherapistValidation.findByPk(req.params.id);
    if (!validation) return res.status(404).json({ error: 'Documento no encontrado.' });
    if (validation.status !== 'pending') {
      return res.status(400).json({ error: 'Este documento ya fue revisado.' });
    }

    const { note } = req.body;
    if (!note?.trim()) {
      return res.status(400).json({ error: 'La nota de rechazo es requerida.' });
    }

    await validation.update({
      status:     'rejected',
      reviewedBy: req.user.name,
      reviewNote: note,
      reviewedAt: new Date(),
    });

    res.json({ message: 'Documento rechazado. El terapeuta recibirá la nota.' });
  } catch (error) {
    console.error('❌ Error rechazando:', error);
    res.status(500).json({ error: 'No se pudo rechazar el documento.' });
  }
});

module.exports = router;
