// backend/routes/resumes.js
// ES-109 — Hoja de vida de la persona (PDF): análisis con IA para proponer los campos del contexto, e histórico cifrado.
//   GET    /api/user/resumes               versiones propias (sin contenido)
//   POST   /api/user/resumes/analyze       multipart {cv, requestId}: valida, depura el contacto, guarda la versión y propone campos (NO guarda el contexto)
//   GET    /api/user/resumes/:id/file      descarga del PDF propio
//   DELETE /api/user/resumes/:id           borra la versión (de verdad, sin copias)
// Solo la persona dueña (propietario verificado en el servidor en cada acceso). verificarToken está montado en server.js.
// Nada de aquí registra el PDF, su texto, el texto depurado ni la respuesta del modelo.
const router = require('express').Router();
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const User = require('../User');
const AiUsage = require('../AiUsage');
const { sequelize } = require('../database');
const consent = require('../utils/consent');
const { AiBudgetNotConfiguredError, AiBudgetExhaustedError } = require('../utils/aiClient');
const { MAX_RESUME_BYTES, ResumePdfError, checkResumeFile, extractResumeText } = require('../utils/resumePdf');
const { sanitizeResumeText, ResumeSanitizeError } = require('../utils/resumeSanitizer');
const { analyzeResume, KIND } = require('../utils/resumeAnalysis');
const { MAX_VERSIONS, ResumeError, listResumes, storeResume, getResumeFile, deleteResume } = require('../utils/resumes');

const PURPOSE = 'resume_ai_reading';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail = (res, status, code, es, en, extra = {}) => res.status(status).json({ error: `${es} / ${en}`, code, ...extra });

router.use(async (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  if (!Number.isSafeInteger(req.user.id) || req.user.id <= 0 || req.user.role !== 'user') return fail(res, 403, 'resume_forbidden', 'Acceso no permitido.', 'Access not allowed.');
  next();
});

// Límite por persona además del presupuesto de IA (ES-22): frena el abuso del análisis. Se lee en cada petición para poder probarlo.
const analyzeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: () => Number(process.env.RESUME_ANALYZE_RATE_MAX) || 6,
  keyGenerator: (req) => `resume-${req.user.id}`,
  standardHeaders: true, legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false },
  message: { error: 'Demasiados análisis seguidos. Inténtalo más tarde. / Too many analyses in a row. Please try later.', code: 'rate_limited' },
});

// Memoria: el archivo nunca toca el disco. +1 byte de margen para distinguir «exactamente 5 MB» (válido) de «5 MB + 1» (rechazado por checkResumeFile).
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_RESUME_BYTES + 1, files: 1, fields: 4, fieldSize: 256, parts: 6 } });
const receive = (req, res, next) => upload.single('cv')(req, res, (error) => {
  if (!error) return next();
  if (error.code === 'LIMIT_FILE_SIZE') return fail(res, 400, 'too_large', 'El archivo pesa más de 5 MB.', 'The file is larger than 5 MB.');
  return fail(res, 400, 'invalid_request', 'Solicitud inválida.', 'Invalid request.');
});

const inFlight = new Set(); // un análisis a la vez por persona: «un análisis por intento»

router.get('/', async (req, res) => {
  try { res.json({ resumes: await listResumes(req.user.id), maxVersions: MAX_VERSIONS }); } catch {
    console.error('Error listando hojas de vida.');
    fail(res, 503, 'resume_unavailable', 'No se pudieron cargar tus hojas de vida.', 'Your résumés could not be loaded.');
  }
});

const withId = (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return fail(res, 404, 'resume_not_found', 'Hoja de vida no encontrada.', 'Résumé not found.');
  req.resumeId = id; next();
};

router.get('/:id/file', withId, async (req, res) => {
  try {
    const file = await getResumeFile(req.user.id, req.resumeId);
    if (!file) return fail(res, 404, 'resume_not_found', 'Hoja de vida no encontrada.', 'Résumé not found.'); // ajena e inexistente responden igual
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="hoja-de-vida-v${file.version}.pdf"`, 'X-Content-Type-Options': 'nosniff', 'Content-Length': String(file.pdf.length) });
    return res.status(200).end(file.pdf);
  } catch {
    console.error('Error descargando una hoja de vida.');
    return fail(res, 500, 'resume_unavailable', 'No se pudo descargar la hoja de vida.', 'The résumé could not be downloaded.');
  }
});

router.delete('/:id', withId, async (req, res) => {
  let transaction;
  try {
    transaction = await sequelize.transaction();
    const removed = await deleteResume(req.user.id, req.resumeId, transaction);
    await transaction.commit();
    if (!removed) return fail(res, 404, 'resume_not_found', 'Hoja de vida no encontrada.', 'Résumé not found.');
    return res.json({ id: req.resumeId, deleted: true });
  } catch {
    if (transaction && !transaction.finished) await transaction.rollback().catch(() => {});
    console.error('Error borrando una hoja de vida.');
    return fail(res, 500, 'resume_unavailable', 'No se pudo borrar la hoja de vida.', 'The résumé could not be deleted.');
  }
});

const PDF_MESSAGES = {
  empty: [400, 'El archivo está vacío.', 'The file is empty.'],
  too_large: [400, 'El archivo pesa más de 5 MB.', 'The file is larger than 5 MB.'],
  not_pdf: [400, 'Solo se aceptan archivos PDF.', 'Only PDF files are accepted.'],
  encrypted: [422, 'El PDF tiene contraseña. Quítala y vuelve a subirlo.', 'The PDF is password-protected. Remove the password and upload it again.'],
  corrupt: [422, 'No pudimos abrir este PDF.', 'We could not open this PDF.'],
  too_many_pages: [422, 'El PDF tiene demasiadas páginas (máximo 15).', 'The PDF has too many pages (maximum 15).'],
  no_text: [422, 'Este PDF parece una imagen escaneada y todavía no podemos leerlo.', 'This PDF looks like a scanned image and we cannot read it yet.'],
  timeout: [422, 'El PDF tardó demasiado en leerse.', 'The PDF took too long to read.'],
};

router.post('/analyze', analyzeLimiter, receive, async (req, res) => {
  const userId = req.user.id;
  const requestId = typeof req.body?.requestId === 'string' ? req.body.requestId : '';
  if (!UUID.test(requestId)) return fail(res, 400, 'invalid_request', 'Solicitud inválida.', 'Invalid request.');
  if (inFlight.has(userId)) return fail(res, 409, 'analysis_in_progress', 'Ya hay un análisis en curso.', 'An analysis is already in progress.');
  inFlight.add(userId);
  try {
    // 1) Autorización explícita y previa: sin ella no se procesa nada.
    if (!(await consent.hasConsent(userId, PURPOSE))) return fail(res, 403, 'consent_required', 'Necesitamos tu autorización para leer tu hoja de vida con IA.', 'We need your permission to read your résumé with AI.', { purpose: PURPOSE });
    const owner = await User.findOne({ where: { id: userId, active: true, role: 'user' }, attributes: ['id'] });
    if (!owner) return fail(res, 403, 'resume_forbidden', 'Acceso no permitido.', 'Access not allowed.');
    // 2) Un análisis por requestId: reintentar con el mismo no repite el gasto; el cliente genera otro por intento.
    if (await AiUsage.findOne({ where: { UserId: userId, kind: KIND, requestId }, attributes: ['id'] })) return fail(res, 409, 'request_already_processed', 'Esta solicitud ya se procesó. Inténtalo de nuevo.', 'This request was already processed. Please try again.');
    // 3) El archivo: tamaño y firma en el servidor; luego texto; luego depuración del contacto. Cualquier fallo corta ANTES de llamar a la IA.
    const buffer = req.file?.buffer;
    let extracted; let sanitized;
    try {
      checkResumeFile(buffer);
      extracted = await extractResumeText(buffer);
    } catch (error) {
      if (error instanceof ResumePdfError) { const [status, es, en] = PDF_MESSAGES[error.code] ?? PDF_MESSAGES.corrupt; return fail(res, status, error.code, es, en); }
      throw error;
    }
    try { sanitized = sanitizeResumeText(extracted.text); } catch (error) {
      if (error instanceof ResumeSanitizeError) return fail(res, 422, 'sanitize_failed', 'No pudimos preparar tu hoja de vida con seguridad, así que no se envió a la IA.', 'We could not prepare your résumé safely, so it was not sent to the AI.');
      throw error;
    }
    // 4) Se guarda la versión (cifrada) con el consentimiento comprobado DENTRO de la transacción.
    let stored;
    try { stored = await consent.withConsent(userId, PURPOSE, (transaction) => storeResume(userId, buffer, transaction)); } catch (error) {
      if (error instanceof consent.ConsentRequiredError) return fail(res, 403, 'consent_required', 'Necesitamos tu autorización para leer tu hoja de vida con IA.', 'We need your permission to read your résumé with AI.', { purpose: PURPOSE });
      if (error instanceof ResumeError && error.code === 'resume_limit') return fail(res, 409, 'resume_limit', `Ya tienes ${MAX_VERSIONS} versiones. Borra una antes de subir otra.`, `You already have ${MAX_VERSIONS} versions. Delete one before uploading another.`, { maxVersions: MAX_VERSIONS });
      throw error;
    }
    // 5) Análisis. Lo sugerido NO se guarda: vuelve al cliente y la persona decide.
    try {
      const { suggestions, discarded } = await analyzeResume({ userId, requestId, text: sanitized.text, resumeVersion: stored.resume.version });
      return res.json({ resume: stored.resume, reused: stored.reused, suggestions, discarded });
    } catch (error) {
      const resume = stored.resume; // la hoja de vida quedó guardada aunque el análisis falle
      if (error instanceof AiBudgetExhaustedError) return fail(res, 429, 'ai_budget_exhausted', 'Llegaste al límite de análisis por ahora.', 'You reached the analysis limit for now.', { scope: error.scope, resetsAt: error.resetsAt, resume });
      if (error instanceof AiBudgetNotConfiguredError) return fail(res, 503, 'ai_budget_not_configured', 'El análisis no está disponible por ahora.', 'The analysis is not available right now.', { resume });
      console.error('Error del análisis de hoja de vida:', error.errorCode || error.code || error.name);
      return fail(res, 502, 'provider_unavailable', 'El análisis no está disponible ahora. Tu hoja de vida quedó guardada.', 'The analysis is not available right now. Your résumé was saved.', { retryable: true, resume });
    }
  } catch (error) {
    console.error('Error procesando una hoja de vida:', error && (error.code || error.name)); // solo el tipo: nunca el mensaje, el contenido ni detalles // solo el tipo: nunca el mensaje, el contenido ni detalles
    return fail(res, 500, 'internal_error', 'No se pudo procesar la hoja de vida.', 'The résumé could not be processed.');
  } finally {
    inFlight.delete(userId);
  }
});

router.use((req, res) => fail(res, 404, 'resume_not_found', 'No encontrado.', 'Not found.'));
module.exports = router;
