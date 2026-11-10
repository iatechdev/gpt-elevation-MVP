// backend/routes/sessions.js
// HU-066 — TherapySession CRUD endpoints
// HU-067 — Daily.co videocall: start, end, join

const express = require('express');
const router  = express.Router();

// ES-96 (ES93-M7): datos de personas y de su terapeuta: nunca en cachés.
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

const { encriptar, desencriptar } = require('../utils/crypto');
const { sharingSet, blockedPatientIds, patientBlocked, requireSharing, hasSharing } = require('../utils/therapistAccess'); // ES-96 y ES-101
const { callClaude } = require('../utils/aiClient'); // ES-102
const { validateBody, id, date, numeric, nonempty, text, optional, score } = require('../middlewares/validateBody');
const { Transaction } = require('sequelize');
const { sequelize } = require('../database');
const { validateIdParams, isRouteId } = require('../middlewares/params');
const { findConflict, editProblem } = require('../utils/sessionSchedule');

// ES-98 (ES93-B1): un id de ruta mal formado es un 404 uniforme, no un 500 de la base.
validateIdParams(router, 'id');

const CONFLICT = { code: 'session_conflict', error: 'Ya hay una sesión en ese horario. / There is already a session at that time.' };
const MAX_CLOSING_NOTE = 4000; // ES-179: nota de cierre de la sesión
const MAX_CANCEL_REASON = 255; // TherapySessions.cancelReason es VARCHAR(255)
// Duración en minutos: entero entre 15 y 120 (acepta un número o un texto numérico, como antes).
const parseDuration = (value) => (value === undefined ? 50 : Number(value));

// ── Todos los requires de modelos DENTRO de cada handler ─────────────────────

// POST /api/sessions/therapist — crear nueva sesión
router.post('/therapist', validateBody({ patientId: id, scheduledAt: date, duration: optional(numeric) }), async (req, res) => {
  const User           = require('../User');
  const TherapySession = require('../TherapySession');
  try {
    if (req.user.role !== 'therapist') {
      return res.status(403).json({ error: 'Therapists only.' });
    }
    const { patientId, scheduledAt, duration } = req.body;
    if (!patientId || !scheduledAt) {
      return res.status(400).json({ error: 'patientId and scheduledAt are required.' });
    }
    if (!isRouteId(String(patientId))) {
      return res.status(403).json({ error: 'This patient is not assigned to you.' }); // mismo mensaje que un paciente ajeno: no revela nada
    }
    if (new Date(scheduledAt) <= new Date()) {
      return res.status(400).json({ error: 'scheduledAt must be in the future.' });
    }
    const dur = parseDuration(duration);
    if (!Number.isInteger(dur) || dur < 15 || dur > 120) {
      return res.status(400).json({ error: 'duration must be between 15 and 120 minutes.' });
    }
    const patient = await User.findOne({
      where: { id: patientId, therapistId: req.user.id, role: 'user' },
    });
    if (!patient || await patientBlocked(patient.id)) { // ES-101
      return res.status(403).json({ error: 'This patient is not assigned to you.' });
    }
    if (!(await requireSharing(req, res, patient.id))) return; // sin autorización de compartir, no se agenda (ES-96)
    // ES-98 (ES93-B5): sin choques de horario. La fila del terapeuta se bloquea para que dos altas simultáneas no se crucen.
    const start = new Date(scheduledAt);
    const transaction = await sequelize.transaction();
    let session;
    try {
      await User.findByPk(req.user.id, { transaction, lock: Transaction.LOCK.UPDATE, attributes: ['id'] });
      if (await findConflict(TherapySession, { therapistId: req.user.id, patientId, start, durationMin: dur, transaction })) {
        await transaction.rollback();
        return res.status(409).json(CONFLICT);
      }
      session = await TherapySession.create({
        therapistId: req.user.id,
        patientId,
        scheduledAt: start,
        duration: dur,
        status: 'scheduled',
      }, { transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback().catch(() => {});
      throw error;
    }
    res.status(201).json({
      message: 'Session created.',
      session: { ...session.toJSON(), patientName: patient.name },
    });
  } catch (error) {
    console.error('❌ Error creating session:', error);
    res.status(500).json({ error: 'Could not create session.' });
  }
});

// GET /api/sessions/therapist/upcoming — próximas 5 sesiones
router.get('/therapist/upcoming', async (req, res) => {
  const User           = require('../User');
  const TherapySession = require('../TherapySession');
  const { Op }         = require('sequelize');
  try {
    if (req.user.role !== 'therapist') {
      return res.status(403).json({ error: 'Therapists only.' });
    }
    const sessions = await TherapySession.findAll({
      where: {
        therapistId: req.user.id,
        status: 'scheduled',
        scheduledAt: { [Op.gte]: new Date() },
      },
      order: [['scheduledAt', 'ASC']],
      limit: 5,
    });
    const blocked = await blockedPatientIds(sessions.map((s) => s.patientId)); // ES-101
    const enriched = await Promise.all(sessions.filter((s) => !blocked.has(s.patientId)).map(async (s) => {
      const p = await User.findByPk(s.patientId, { attributes: ['name', 'email'] });
      return { ...s.toJSON(), patientName: p?.name ?? 'Unknown' };
    }));
    res.json(enriched);
  } catch (error) {
    console.error('❌ Error fetching upcoming sessions:', error);
    res.status(500).json({ error: 'Could not fetch upcoming sessions.' });
  }
});

// GET /api/sessions/therapist — todas las sesiones del terapeuta
router.get('/therapist', async (req, res) => {
  const User           = require('../User');
  const TherapySession = require('../TherapySession');
  try {
    if (req.user.role !== 'therapist') {
      return res.status(403).json({ error: 'Therapists only.' });
    }
    const { status } = req.query;
    const where = { therapistId: req.user.id };
    if (status && status !== 'all') where.status = status;
    const sessions = await TherapySession.findAll({
      where,
      order: [['scheduledAt', 'ASC']],
    });
    const blocked = await blockedPatientIds(sessions.map((s) => s.patientId)); // ES-101
    // ES-96 (ES93-A3): el nombre es parte del vínculo (para agendar); el correo, solo de quien autorizó compartir sus datos con este terapeuta.
    const sharing = await sharingSet(req.user.id, [...new Set(sessions.map((s) => s.patientId))]);
    const enriched = await Promise.all(sessions.filter((s) => !blocked.has(s.patientId)).map(async (s) => {
      const p = await User.findByPk(s.patientId, { attributes: ['name', 'email'] });
      return { ...s.toJSON(), patientName: p?.name ?? 'Unknown', patientEmail: sharing.has(s.patientId) ? (p?.email ?? '') : '' };
    }));
    res.json(enriched);
  } catch (error) {
    console.error('❌ Error fetching therapist sessions:', error);
    res.status(500).json({ error: 'Could not fetch sessions.' });
  }
});

// PUT /api/sessions/therapist/:id — reprogramar / cancelar una sesión agendada
// ES-98 (ES93-M2): por aquí solo se puede reprogramar y pasar a «cancelled»; iniciar y terminar tienen sus rutas (sala, cierre y nota). Nada de
// estados inventados ni de saltarse el flujo. Una sesión terminada o cancelada no se edita; una en curso solo se cierra por su ruta.
router.put('/therapist/:id', validateBody({ scheduledAt: optional(date), duration: optional(numeric), status: optional(text), cancelReason: optional(text) }), async (req, res) => {
  const User           = require('../User');
  const TherapySession = require('../TherapySession');
  try {
    if (req.user.role !== 'therapist') {
      return res.status(403).json({ error: 'Therapists only.' });
    }
    const session = await TherapySession.findOne({
      where: { id: req.params.id, therapistId: req.user.id },
    });
    if (!session || await patientBlocked(session.patientId)) return res.status(404).json({ error: 'Session not found.' }); // ES-101
    const { scheduledAt, duration, status, cancelReason } = req.body;
    const problem = editProblem(session, { status, scheduledAt, duration });
    if (problem === 'session_final') {
      return res.status(400).json({ code: problem, error: `Cannot edit a ${session.status} session.` });
    }
    if (problem === 'session_in_progress') {
      return res.status(400).json({ code: problem, error: 'Una sesión en curso solo se cierra con su ruta de cierre. / An in-progress session can only be closed through its end route.' });
    }
    if (problem === 'invalid_status') {
      return res.status(400).json({ code: problem, error: "Estado no permitido: por aquí solo se puede cancelar ('cancelled'). / Status not allowed: here you can only cancel ('cancelled')." });
    }
    if (cancelReason !== undefined && cancelReason.length > MAX_CANCEL_REASON) {
      return res.status(400).json({ code: 'invalid_cancel_reason', error: `El motivo no puede superar ${MAX_CANCEL_REASON} caracteres. / The reason cannot exceed ${MAX_CANCEL_REASON} characters.` });
    }
    const updates = {};
    if (scheduledAt) {
      if (new Date(scheduledAt) <= new Date()) {
        return res.status(400).json({ error: 'scheduledAt must be in the future.' });
      }
      updates.scheduledAt = new Date(scheduledAt);
    }
    if (duration !== undefined) {
      const dur = parseDuration(duration);
      if (!Number.isInteger(dur) || dur < 15 || dur > 120) {
        return res.status(400).json({ error: 'duration must be between 15 and 120 minutes.' });
      }
      updates.duration = dur;
    }
    if (status === 'cancelled') updates.status = 'cancelled';
    if (cancelReason) updates.cancelReason = cancelReason;

    const transaction = await sequelize.transaction();
    try {
      await User.findByPk(req.user.id, { transaction, lock: Transaction.LOCK.UPDATE, attributes: ['id'] });
      // Solo choca si la sesión sigue activa y cambia su horario o duración.
      if (updates.status !== 'cancelled' && (updates.scheduledAt || updates.duration)) {
        const conflict = await findConflict(TherapySession, {
          therapistId: req.user.id, patientId: session.patientId, start: updates.scheduledAt ?? new Date(session.scheduledAt),
          durationMin: updates.duration ?? (Number(session.duration) || 50), excludeId: session.id, transaction,
        });
        if (conflict) {
          await transaction.rollback();
          return res.status(409).json(CONFLICT);
        }
      }
      await session.update(updates, { transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback().catch(() => {});
      throw error;
    }
    res.json({ message: 'Session updated.', session });
  } catch (error) {
    console.error('❌ Error updating session:', error);
    res.status(500).json({ error: 'Could not update session.' });
  }
});

// POST /api/sessions/therapist/:id/notes — agregar nota en vivo
// ES-179: UNA nota en vivo por sesión. El autoguardado manda el texto completo; antes cada envío creaba una fila nueva (decenas de copias por sesión).
// Ahora se actualiza la misma fila con control de versión: `version` esperada distinta de la guardada → 409 `note_changed` con la versión vigente (otra pestaña guardó antes);
// `requestId` repetido → 200 sin cambios (reintento de un guardado incierto, idempotente). Sin `version` (clientes anteriores) se sobrescribe la nota en vivo, nunca se duplica.
const MAX_LIVE_NOTE = 20000;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
const isUniqueViolation = (error) => Boolean(error) && (error.name === 'SequelizeUniqueConstraintError' || error.original?.code === '23505');
router.post('/therapist/:id/notes', validateBody({ content: nonempty, version: optional(numeric), requestId: optional(text) }), async (req, res) => {
  const TherapySession = require('../TherapySession');
  const SessionNote    = require('../SessionNote');
  try {
    if (req.user.role !== 'therapist') {
      return res.status(403).json({ error: 'Therapists only.' });
    }
    const session = await TherapySession.findOne({
      where: { id: req.params.id, therapistId: req.user.id },
    });
    if (!session || await patientBlocked(session.patientId)) return res.status(404).json({ error: 'Session not found.' }); // ES-101
    if (!(await requireSharing(req, res, session.patientId))) return; // la autorización se retiró: no se anota en vivo
    if (session.status !== 'in_progress') {
      return res.status(400).json({ error: 'Session is not in progress.' });
    }
    const { content, requestId } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'content is required.' });
    if (content.length > MAX_LIVE_NOTE) {
      return res.status(400).json({ code: 'too_long', max: MAX_LIVE_NOTE, error: `La nota supera el máximo de ${MAX_LIVE_NOTE} caracteres. / The note exceeds the ${MAX_LIVE_NOTE}-character maximum.` });
    }
    if (requestId !== undefined && !REQUEST_ID_PATTERN.test(requestId)) {
      return res.status(400).json({ code: 'invalid_request_id', error: 'requestId no válido. / Invalid requestId.' });
    }
    const expected = req.body.version === undefined ? undefined : Number(req.body.version);
    if (expected !== undefined && !(Number.isInteger(expected) && expected >= 0)) {
      return res.status(400).json({ code: 'invalid_version', error: 'version no válida. / Invalid version.' });
    }
    const current = (note) => ({ content: desencriptar(note.content), version: note.version || 1, timestamp: note.timestamp });
    // Dos intentos: si dos guardados simultáneos intentan crear la primera nota, el índice único hace perder a uno y este reintenta como actualización.
    for (let attempt = 0; attempt < 2; attempt++) {
      const transaction = await sequelize.transaction();
      try {
        const live = await SessionNote.findOne({
          where: { sessionId: session.id, therapistId: req.user.id, isLive: true },
          transaction, lock: Transaction.LOCK.UPDATE,
        });
        if (!live) {
          if (expected !== undefined && expected !== 0) {
            await transaction.rollback();
            return res.status(409).json({ code: 'note_changed', current: null, error: 'La nota cambió. / The note changed.' });
          }
          const created = await SessionNote.create({
            sessionId: session.id, therapistId: req.user.id, content: encriptar(content), timestamp: new Date(),
            isLive: true, version: 1, requestId: requestId ?? null,
          }, { transaction });
          await transaction.commit();
          return res.status(201).json({ message: 'Note saved.', note: { ...created.toJSON(), content } });
        }
        if (requestId && live.requestId === requestId) { // reintento del mismo guardado: ya está aplicado
          await transaction.commit();
          return res.json({ message: 'Note saved.', replayed: true, note: { ...live.toJSON(), content: desencriptar(live.content) } });
        }
        if (expected !== undefined && expected !== (live.version || 1)) {
          await transaction.rollback();
          return res.status(409).json({ code: 'note_changed', current: current(live), error: 'La nota cambió en otra pestaña. / The note changed in another tab.' });
        }
        await live.update({ content: encriptar(content), version: (live.version || 1) + 1, requestId: requestId ?? null, timestamp: new Date() }, { transaction });
        await transaction.commit();
        return res.json({ message: 'Note saved.', note: { ...live.toJSON(), content } });
      } catch (error) {
        await transaction.rollback().catch(() => {});
        if (attempt === 0 && isUniqueViolation(error)) continue;
        throw error;
      }
    }
  } catch (error) {
    console.error('❌ Error saving note:', error && error.name);
    res.status(500).json({ error: 'Could not save note.' });
  }
});

// GET /api/sessions/therapist/:id/notes — ver notas de la sesión
router.get('/therapist/:id/notes', async (req, res) => {
  const TherapySession = require('../TherapySession');
  const SessionNote    = require('../SessionNote');
  try {
    if (req.user.role !== 'therapist') {
      return res.status(403).json({ error: 'Therapists only.' });
    }
    const session = await TherapySession.findOne({
      where: { id: req.params.id, therapistId: req.user.id },
    });
    if (!session || await patientBlocked(session.patientId)) return res.status(404).json({ error: 'Session not found.' }); // ES-101
    const notes = await SessionNote.findAll({
      where: { sessionId: session.id },
      order: [['timestamp', 'ASC']],
    });
    res.json(notes.map(n => ({ ...n.toJSON(), content: desencriptar(n.content) })));
  } catch (error) {
    console.error('❌ Error fetching notes:', error);
    res.status(500).json({ error: 'Could not fetch notes.' });
  }
});

// GET /api/sessions/user/upcoming — próxima sesión del paciente
router.get('/user/upcoming', async (req, res) => {
  const User           = require('../User');
  const TherapySession = require('../TherapySession');
  const { Op }         = require('sequelize');
  try {
    if (req.user.role !== 'user') {
      return res.status(403).json({ error: 'Users only.' });
    }
    const session = await TherapySession.findOne({
      where: {
        patientId: req.user.id,
        status: 'scheduled',
        scheduledAt: { [Op.gte]: new Date() },
      },
      order: [['scheduledAt', 'ASC']],
    });
    if (!session) return res.json({ session: null });
    const therapist = await User.findByPk(session.therapistId, {
      attributes: ['id', 'name', 'email'],
    });
    res.json({
      session: {
        ...session.toJSON(),
        therapistName:  therapist?.name  ?? 'Unknown',
        therapistEmail: therapist?.email ?? '',
      },
    });
  } catch (error) {
    console.error('❌ Error fetching user upcoming session:', error);
    res.status(500).json({ error: 'Could not fetch upcoming session.' });
  }
});

// GET /api/sessions/user — historial de sesiones del paciente
router.get('/user', async (req, res) => {
  const User           = require('../User');
  const TherapySession = require('../TherapySession');
  try {
    if (req.user.role !== 'user') {
      return res.status(403).json({ error: 'Users only.' });
    }
    const sessions = await TherapySession.findAll({
      where: { patientId: req.user.id },
      order: [['scheduledAt', 'DESC']],
      limit: 20,
    });
    const enriched = await Promise.all(sessions.map(async (s) => {
      const t = await User.findByPk(s.therapistId, { attributes: ['name'] });
      return {
        id: s.id, scheduledAt: s.scheduledAt, duration: s.duration,
        status: s.status, patientMoodAfter: s.patientMoodAfter,
        therapistName: t?.name ?? 'Unknown',
      };
    }));
    res.json(enriched);
  } catch (error) {
    console.error('❌ Error fetching user sessions:', error);
    res.status(500).json({ error: 'Could not fetch sessions.' });
  }
});

// DELETE /api/sessions/user/my-therapist — la propia persona se desvincula de su terapeuta (ES-96, ES93-A3).
// El terapeuta pierde el acceso de inmediato; las sesiones futuras entre ambos se cancelan; la autorización que dio queda ligada a ese terapeuta
// (alcance `therapist-<id>`), así que un terapeuta nuevo no la hereda. Idempotente.
router.delete('/user/my-therapist', async (req, res) => {
  const { unlinkTherapist } = require('../utils/therapistLink');
  const { sequelize } = require('../database');
  const consent = require('../utils/consent');
  try {
    if (req.user.role !== 'user') {
      return res.status(403).json({ error: 'Users only.' });
    }
    const transaction = await sequelize.transaction();
    try {
      const result = await unlinkTherapist(req.user.id, 'unlinked_by_person', transaction);
      // La autorización a ese terapeuta se retira en la MISMA transacción (QA ES-96): o ocurren las dos cosas o ninguna; el error no se traga.
      if (result.unlinked) await consent.revokeTherapistSharing(req.user.id, result.therapistId, transaction);
      await transaction.commit();
      res.json({ unlinked: result.unlinked });
    } catch (error) {
      await transaction.rollback().catch(() => {});
      throw error;
    }
  } catch (error) {
    console.error('❌ Error unlinking therapist:', error && (error.code || error.name));
    res.status(500).json({ error: 'No se pudo completar la operación. / The operation could not be completed.' });
  }
});

// GET /api/sessions/user/my-therapist — terapeuta asignado + sesiones (HU-071)
router.get('/user/my-therapist', async (req, res) => {
  const User             = require('../User');
  const TherapySession   = require('../TherapySession');
  const TherapistProfile = require('../TherapistProfile');
  const { Op }           = require('sequelize');
  try {
    if (req.user.role !== 'user') {
      return res.status(403).json({ error: 'Users only.' });
    }
    const user = await User.findByPk(req.user.id, { attributes: ['therapistId'] });
    if (!user?.therapistId) return res.json({ therapist: null });

    const therapist = await User.findByPk(user.therapistId, {
      attributes: ['id', 'name', 'email'],
    });
    const profile = await TherapistProfile.findOne({ where: { UserId: user.therapistId } });

    const upcomingSessions = await TherapySession.findAll({
      where: {
        patientId:   req.user.id,
        therapistId: user.therapistId,
        status:      'scheduled',
        scheduledAt: { [Op.gte]: new Date() },
      },
      order: [['scheduledAt', 'ASC']],
      limit: 3,
    });

    const pastSessions = await TherapySession.findAll({
      where: {
        patientId:   req.user.id,
        therapistId: user.therapistId,
        status:      'completed',
      },
      order: [['scheduledAt', 'DESC']],
      limit: 10,
    });

    res.json({
      therapist: {
        id: therapist.id, name: therapist.name, email: therapist.email,
        profile: profile ? {
          specialties: profile.specialties, approach: profile.approach,
          languages:   profile.languages,   bio:      profile.bio,
        } : null,
      },
      upcomingSessions: upcomingSessions.map(s => ({
        id: s.id, scheduledAt: s.scheduledAt, duration: s.duration,
        meetingUrl: s.meetingUrl, status: s.status,
      })),
      pastSessions: pastSessions.map(s => ({
        id: s.id, scheduledAt: s.scheduledAt,
        patientMoodAfter: s.patientMoodAfter, status: s.status,
      })),
    });
  } catch (error) {
    console.error('❌ Error fetching my-therapist:', error);
    res.status(500).json({ error: 'Could not fetch therapist info.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// HU-067 — Daily.co Videocall
// ─────────────────────────────────────────────────────────────────────────────

// Helper — crea sala en Daily.co o retorna URL mock si no hay API key configurada
const createDailyRoom = async (therapistId, patientId, sessionId) => {
  const roomName = `elevation-${therapistId}-${patientId}-${sessionId}`;

  if (!process.env.DAILY_API_KEY) {
    // Modo mock — para desarrollo local sin API key
    console.warn('⚠️  DAILY_API_KEY not set — using mock meeting URL');
    return `https://mock.daily.co/${roomName}`;
  }

  const response = await fetch('https://api.daily.co/v1/rooms', {
    method: 'POST',
    signal: AbortSignal.timeout(8000), // ES-179: una sala externa lenta no deja la solicitud colgada
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.DAILY_API_KEY}`,
    },
    body: JSON.stringify({
      name: roomName,
      properties: {
        exp: Math.round(Date.now() / 1000) + 7200, // expira en 2 horas
        enable_chat: true,
        start_video_off: false,
        start_audio_off: false,
      },
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`Daily.co error: ${err.error || response.status}`);
  }

  const room = await response.json();
  return room.url;
};

// POST /api/sessions/therapist/:id/start — iniciar videollamada
// ES-179: idempotente y atómico. Se bloquea la fila de la sesión: dos solicitudes simultáneas (dos pestañas, doble clic) no crean dos salas y la
// que llega después, o una repetición tras recargar con la sesión ya en curso, recibe la MISMA sala (`resumed: true`). Si la sala no se puede crear,
// la sesión sigue «scheduled» (no se registró el inicio) y la respuesta lo dice con un código estable.
router.post('/therapist/:id/start', async (req, res) => {
  const TherapySession = require('../TherapySession');
  let transaction;
  try {
    if (req.user.role !== 'therapist') {
      return res.status(403).json({ error: 'Therapists only.' });
    }
    // E179-1: las comprobaciones que usan OTRA conexión (patientBlocked, requireSharing) van ANTES de abrir la transacción con el bloqueo: dentro de ella,
    // cada solicitud retenía una conexión del pool y pedía una segunda; con el pool lleno todas esperaban (agotamiento, 30 s de bloqueo y 5xx).
    const peek = await TherapySession.findOne({ where: { id: req.params.id, therapistId: req.user.id } });
    if (!peek || await patientBlocked(peek.patientId)) return res.status(404).json({ error: 'Session not found.' }); // ES-101
    if (!(await requireSharing(req, res, peek.patientId))) return; // sin autorización de compartir, no se inicia
    transaction = await sequelize.transaction();
    const session = await TherapySession.findOne({
      where: { id: req.params.id, therapistId: req.user.id },
      transaction, lock: Transaction.LOCK.UPDATE,
    });
    if (!session) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Session not found.' });
    }
    if (session.status === 'in_progress' && session.meetingUrl) {
      await transaction.commit();
      return res.json({ meetingUrl: session.meetingUrl, sessionId: session.id, startedAt: session.startedAt, resumed: true });
    }
    if (session.status !== 'scheduled') {
      await transaction.rollback();
      return res.status(400).json({ code: 'session_not_startable', error: `Cannot start a session with status '${session.status}'.` });
    }

    let meetingUrl;
    try {
      meetingUrl = await createDailyRoom(req.user.id, session.patientId, session.id);
    } catch (roomError) {
      await transaction.rollback();
      console.error('❌ No se pudo crear la sala:', roomError && roomError.name);
      return res.status(502).json({ code: 'room_unavailable', retryable: true, error: 'No se ha registrado el inicio de la sesión. / The session start was not recorded.' });
    }
    await session.update({
      status:     'in_progress',
      startedAt:  new Date(),
      meetingUrl,
    }, { transaction });
    await transaction.commit();

    console.log(`✅ Session ${session.id} started`);
    res.json({ meetingUrl, sessionId: session.id, startedAt: session.startedAt, resumed: false });
  } catch (error) {
    if (transaction) await transaction.rollback().catch(() => {});
    console.error('❌ Error starting session:', error && error.name);
    res.status(500).json({ error: 'Could not start session.' });
  }
});

// POST /api/sessions/therapist/:id/end — finalizar videollamada con checkout
router.post('/therapist/:id/end', validateBody({ therapistNote: nonempty, patientMoodAfter: score }), async (req, res) => {
  const TherapySession         = require('../TherapySession');
  const WellnessRecommendation = require('../WellnessRecommendation');
  const anthropic               = require('../utils/anthropic');
  const { textOf }              = require('../utils/claudeText');
  // ES-179: el cierre es atómico. Se bloquea la fila de la sesión: dos cierres simultáneos (doble clic, dos pestañas) no pasan ambos la comprobación;
  // el segundo recibe 409 `already_closed` y NO se genera una segunda recomendación ni se gasta presupuesto de IA dos veces.
  let transaction;
  let session;
  try {
    if (req.user.role !== 'therapist') {
      return res.status(403).json({ error: 'Therapists only.' });
    }
    // E179-1: patientBlocked usa otra conexión: se comprueba ANTES de abrir la transacción con el bloqueo (ver /start).
    const peek = await TherapySession.findOne({ where: { id: req.params.id, therapistId: req.user.id } });
    if (!peek || await patientBlocked(peek.patientId)) return res.status(404).json({ error: 'Session not found.' }); // ES-101
    transaction = await sequelize.transaction();
    session = await TherapySession.findOne({
      where: { id: req.params.id, therapistId: req.user.id },
      transaction, lock: Transaction.LOCK.UPDATE,
    });
    if (!session) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Session not found.' });
    }
    if (session.status === 'completed') {
      await transaction.rollback();
      return res.status(409).json({ code: 'already_closed', status: session.status, endedAt: session.endedAt, error: 'Esta sesión ya terminó. / This session has already ended.' });
    }
    if (session.status !== 'in_progress') {
      await transaction.rollback();
      return res.status(400).json({ error: `Cannot end a session with status '${session.status}'.` });
    }

    const { therapistNote, patientMoodAfter } = req.body;
    if (!therapistNote || therapistNote.trim().length < 10) {
      await transaction.rollback();
      return res.status(400).json({ error: 'therapistNote must be at least 10 characters.' });
    }
    if (therapistNote.length > MAX_CLOSING_NOTE) {
      await transaction.rollback();
      return res.status(400).json({ code: 'too_long', max: MAX_CLOSING_NOTE, error: `La nota de cierre supera el máximo de ${MAX_CLOSING_NOTE} caracteres. / The closing note exceeds the ${MAX_CLOSING_NOTE}-character maximum.` });
    }
    if (patientMoodAfter === undefined || !Number.isInteger(Number(patientMoodAfter)) || patientMoodAfter < 1 || patientMoodAfter > 5) {
      await transaction.rollback();
      return res.status(400).json({ error: 'patientMoodAfter must be an integer between 1 and 5.' });
    }

    await session.update({
      status:           'completed',
      endedAt:          new Date(),
      therapistNote:    encriptar(therapistNote),
      patientMoodAfter: Number(patientMoodAfter),
    }, { transaction });
    await transaction.commit();

    // Generar recomendación IA para el paciente (silent fail si Anthropic falla)
    let recommendation = null;
    let recommendationSkipped = null;
    const sharing = await hasSharing(req.user.id, session.patientId); // sin autorización: se cierra, pero no se genera nada para la persona
    try {
      if (!sharing) throw new Error('sin autorización de compartir');
      // QA-78-01 / ES-79: ni el nombre real de la persona ni la nota del terapeuta se envían al proveedor de IA (decisión de Mauricio, 26-oct): la recomendación se genera solo con el estado de ánimo.
      const moodLabels = { 1: 'muy mal', 2: 'no tan bien', 3: 'neutral', 4: 'bien', 5: 'muy bien' };
      const moodLabel  = moodLabels[patientMoodAfter] || 'neutral';

      // ES-102 (ES93-M5): por la puerta única de IA (presupuesto, tiempo de espera y reintentos de ES-22). Si falla o no hay presupuesto, el cierre sigue.
      const aiResponse = await callClaude({ userId: req.user.id, kind: 'session_recommend', body: {
        model:      anthropic.MODEL,
        max_tokens: 400,
        system:     'Eres un asistente de bienestar empático de Elevation. Genera recomendaciones breves, cálidas y accionables para el paciente después de su sesión de terapia. Responde SOLO con la recomendación, sin preámbulo.',
        messages: [{
          role:    'user',
          content: `La persona terminó una sesión de terapia sintiéndose ${moodLabel}. Genera una recomendación de bienestar breve (máximo 3 oraciones) para ayudarle en las próximas horas.`,
        }],
      } });

      const content = textOf(aiResponse);
      if (content) {
        recommendation = await WellnessRecommendation.create({
          UserId:      session.patientId,
          content:     encriptar(content),
          category:    'reflection',
          generatedAt: new Date(),
        });
      }
    } catch (aiErr) {
      recommendationSkipped = aiErr && aiErr.code === 'ai_budget_exhausted' ? 'budget'
        : aiErr && aiErr.code === 'ai_budget_not_configured' ? 'unavailable' : 'provider';
      console.error('⚠️  Could not generate post-session recommendation:', aiErr && (aiErr.code || aiErr.name));
      // Silent fail — la sesión ya quedó guardada correctamente
    }

    console.log(`✅ Session ${session.id} completed`);
    res.json({
      message: 'Session completed.',
      session: session.toJSON(),
      recommendation: recommendation ? { id: recommendation.id } : null,
      ...(recommendationSkipped ? { recommendationSkipped } : {}),
    });
  } catch (error) {
    if (transaction) await transaction.rollback().catch(() => {}); // si el cierre ya se confirmó, no hay nada que deshacer
    console.error('❌ Error ending session:', error);
    res.status(500).json({ error: 'Could not end session.' });
  }
});

// GET /api/sessions/user/:id/join — el paciente obtiene el meetingUrl de su sesión
router.get('/user/:id/join', async (req, res) => {
  const TherapySession = require('../TherapySession');
  try {
    if (req.user.role !== 'user') {
      return res.status(403).json({ error: 'Users only.' });
    }
    const session = await TherapySession.findOne({
      where: { id: req.params.id, patientId: req.user.id },
    });
    if (!session) return res.status(404).json({ error: 'Session not found.' });
    if (session.status !== 'in_progress') {
      return res.status(400).json({ error: 'Session has not started yet.' });
    }
    if (!session.meetingUrl) {
      return res.status(400).json({ error: 'Meeting URL not available yet.' });
    }
    res.json({ meetingUrl: session.meetingUrl, sessionId: session.id });
  } catch (error) {
    console.error('❌ Error joining session:', error);
    res.status(500).json({ error: 'Could not join session.' });
  }
});

module.exports = router;
