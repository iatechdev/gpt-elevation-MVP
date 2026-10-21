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

// Multer en memoria — no guarda en disco, va directo a GCS
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB máximo
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten PDF, JPG, PNG o WEBP.'));
    }
  },
});

// ── RUTAS TERAPEUTA ───────────────────────────────────────────────────────────

// POST /api/therapist/validation/upload
router.post('/upload', upload.single('document'), async (req, res) => {
  try {
    if (req.user.role !== 'therapist') {
      return res.status(403).json({ error: 'Solo terapeutas pueden subir documentos.' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió ningún archivo.' });
    }

    const { documentType } = req.body;
    const validTypes = ['titulo', 'certificado', 'colegiado', 'otro'];
    const docType = validTypes.includes(documentType) ? documentType : 'titulo';

    // Ruta en GCS: therapist-docs/{therapistId}/{timestamp}_{filename}
    const timestamp   = Date.now();
    const safeName    = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const destination = `therapist-docs/${req.user.id}/${timestamp}_${safeName}`;

    // Subir a GCS
    await uploadFile(req.file.buffer, destination, req.file.mimetype);

    // Guardar metadata en BD
    const validation = await TherapistValidation.create({
      therapistId:  req.user.id,
      documentType: docType,
      documentName: req.file.originalname,
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
    console.error('❌ Error subiendo documento:', error);
    res.status(500).json({ error: error.message || 'No se pudo subir el documento.' });
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
router.get('/pending', async (req, res) => {
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
router.get('/:id/download', async (req, res) => {
  try {
    const validation = await TherapistValidation.findByPk(req.params.id);
    if (!validation) return res.status(404).json({ error: 'Documento no encontrado.' });

    const signedUrl = await getSignedUrl(validation.documentPath);
    res.json({ url: signedUrl, expiresIn: '1 hora' });
  } catch (error) {
    console.error('❌ Error generando URL:', error);
    res.status(500).json({ error: 'No se pudo generar el enlace de descarga.' });
  }
});

// POST /api/junta/validations/:id/approve
router.post('/:id/approve', async (req, res) => {
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
router.post('/:id/reject', async (req, res) => {
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