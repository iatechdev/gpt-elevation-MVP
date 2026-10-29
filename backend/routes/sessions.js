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
    if (new Date(scheduledAt) <= new Date()) {
      return res.status(400).json({ error: 'scheduledAt must be in the future.' });
    }
    const dur = duration ?? 50;
    if (dur < 15 || dur > 120) {
      return res.status(400).json({ error: 'duration must be between 15 and 120 minutes.' });
    }
    const patient = await User.findOne({
      where: { id: patientId, therapistId: req.user.id, role: 'user' },
    });
    if (!patient || await patientBlocked(patient.id)) { // ES-101
      return res.status(403).json({ error: 'This patient is not assigned to you.' });
    }
    if (!(await requireSharing(req, res, patient.id))) return; // sin autorización de compartir, no se agenda
    const session = await TherapySession.create({
      therapistId: req.user.id,
      patientId,
      scheduledAt: new Date(scheduledAt),
      duration: dur,
      status: 'scheduled',
    });
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

// PUT /api/sessions/therapist/:id — editar / cancelar sesión
router.put('/therapist/:id', validateBody({ scheduledAt: optional(date), duration: optional(numeric), status: optional(text), cancelReason: optional(text) }), async (req, res) => {
  const TherapySession = require('../TherapySession');
  try {
    if (req.user.role !== 'therapist') {
      return res.status(403).json({ error: 'Therapists only.' });
    }
    const session = await TherapySession.findOne({
      where: { id: req.params.id, therapistId: req.user.id },
    });
    if (!session || await patientBlocked(session.patientId)) return res.status(404).json({ error: 'Session not found.' }); // ES-101
    if (session.status === 'completed') {
      return res.status(400).json({ error: 'Cannot edit a completed session.' });
    }
    const { scheduledAt, duration, status, cancelReason } = req.body;
    const updates = {};
    if (scheduledAt) {
      if (new Date(scheduledAt) <= new Date()) {
        return res.status(400).json({ error: 'scheduledAt must be in the future.' });
      }
      updates.scheduledAt = new Date(scheduledAt);
    }
    if (duration) {
      if (duration < 15 || duration > 120) {
        return res.status(400).json({ error: 'duration must be between 15 and 120 minutes.' });
      }
      updates.duration = duration;
    }
    if (status)       updates.status       = status;
    if (cancelReason) updates.cancelReason = cancelReason;
    await session.update(updates);
    res.json({ message: 'Session updated.', session });
  } catch (error) {
    console.error('❌ Error updating session:', error);
    res.status(500).json({ error: 'Could not update session.' });
  }
});

// POST /api/sessions/therapist/:id/notes — agregar nota en vivo
router.post('/therapist/:id/notes', validateBody({ content: nonempty }), async (req, res) => {
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
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'content is required.' });
    const note = await SessionNote.create({
      sessionId:   session.id,
      therapistId: req.user.id,
      content:     encriptar(content),
      timestamp:   new Date(),
    });
    res.status(201).json({ message: 'Note saved.', note: { ...note.toJSON(), content } });
  } catch (error) {
    console.error('❌ Error saving note:', error);
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
router.post('/therapist/:id/start', async (req, res) => {
  const TherapySession = require('../TherapySession');
  try {
    if (req.user.role !== 'therapist') {
      return res.status(403).json({ error: 'Therapists only.' });
    }
    const session = await TherapySession.findOne({
      where: { id: req.params.id, therapistId: req.user.id },
    });
    if (!session || await patientBlocked(session.patientId)) return res.status(404).json({ error: 'Session not found.' }); // ES-101
    if (!(await requireSharing(req, res, session.patientId))) return; // sin autorización de compartir, no se inicia
    if (session.status !== 'scheduled') {
      return res.status(400).json({ error: `Cannot start a session with status '${session.status}'.` });
    }

    const meetingUrl = await createDailyRoom(req.user.id, session.patientId, session.id);

    await session.update({
      status:     'in_progress',
      startedAt:  new Date(),
      meetingUrl,
    });

    console.log(`✅ Session ${session.id} started — room: ${meetingUrl}`);
    res.json({ meetingUrl, sessionId: session.id });
  } catch (error) {
    console.error('❌ Error starting session:', error);
    res.status(500).json({ error: 'Could not start session.' });
  }
});

// POST /api/sessions/therapist/:id/end — finalizar videollamada con checkout
router.post('/therapist/:id/end', validateBody({ therapistNote: nonempty, patientMoodAfter: score }), async (req, res) => {
  const TherapySession         = require('../TherapySession');
  const WellnessRecommendation = require('../WellnessRecommendation');
  const anthropic               = require('../utils/anthropic');
  const { textOf }              = require('../utils/claudeText');
  try {
    if (req.user.role !== 'therapist') {
      return res.status(403).json({ error: 'Therapists only.' });
    }
    const session = await TherapySession.findOne({
      where: { id: req.params.id, therapistId: req.user.id },
    });
    if (!session || await patientBlocked(session.patientId)) return res.status(404).json({ error: 'Session not found.' }); // ES-101
    if (session.status !== 'in_progress') {
      return res.status(400).json({ error: `Cannot end a session with status '${session.status}'.` });
    }

    const { therapistNote, patientMoodAfter } = req.body;
    if (!therapistNote || therapistNote.trim().length < 10) {
      return res.status(400).json({ error: 'therapistNote must be at least 10 characters.' });
    }
    if (patientMoodAfter === undefined || patientMoodAfter < 1 || patientMoodAfter > 5) {
      return res.status(400).json({ error: 'patientMoodAfter must be between 1 and 5.' });
    }

    await session.update({
      status:           'completed',
      endedAt:          new Date(),
      therapistNote:    encriptar(therapistNote),
      patientMoodAfter: Number(patientMoodAfter),
    });

    // Generar recomendación IA para el paciente (silent fail si Anthropic falla)
    let recommendation = null;
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
      console.error('⚠️  Could not generate post-session recommendation:', aiErr.message);
      // Silent fail — la sesión ya quedó guardada correctamente
    }

    console.log(`✅ Session ${session.id} completed`);
    res.json({
      message: 'Session completed.',
      session: session.toJSON(),
      recommendation: recommendation ? { id: recommendation.id } : null,
    });
  } catch (error) {
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
