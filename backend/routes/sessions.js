// backend/routes/sessions.js
// HU-066 — TherapySession CRUD endpoints

const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');

const ALGORITMO = 'aes-256-cbc';
const KEY = Buffer.from(
  (process.env.DB_PASS || 'default_password_2026').padEnd(32).slice(0, 32)
);

const encriptar = (texto) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITMO, KEY, iv);
  let enc = cipher.update(texto, 'utf8', 'hex');
  enc += cipher.final('hex');
  return iv.toString('hex') + ':' + enc;
};

const desencriptar = (texto) => {
  try {
    const partes = texto.split(':');
    const iv  = Buffer.from(partes.shift(), 'hex');
    const enc = partes.join(':');
    const decipher = crypto.createDecipheriv(ALGORITMO, KEY, iv);
    let dec = decipher.update(enc, 'hex', 'utf8');
    dec += decipher.final('utf8');
    return dec;
  } catch {
    return texto;
  }
};

// ── Todos los requires de modelos DENTRO de cada handler ─────────────────────
// Esto garantiza que cuando se ejecuta el handler, todos los modelos
// ya están completamente definidos en el caché de Node.js

// POST /api/sessions/therapist — crear nueva sesión
router.post('/therapist', async (req, res) => {
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
    if (!patient) {
      return res.status(403).json({ error: 'This patient is not assigned to you.' });
    }
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
    const enriched = await Promise.all(sessions.map(async (s) => {
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
    const enriched = await Promise.all(sessions.map(async (s) => {
      const p = await User.findByPk(s.patientId, { attributes: ['name', 'email'] });
      return { ...s.toJSON(), patientName: p?.name ?? 'Unknown', patientEmail: p?.email ?? '' };
    }));
    res.json(enriched);
  } catch (error) {
    console.error('❌ Error fetching therapist sessions:', error);
    res.status(500).json({ error: 'Could not fetch sessions.' });
  }
});

// PUT /api/sessions/therapist/:id — editar / cancelar sesión
router.put('/therapist/:id', async (req, res) => {
  const TherapySession = require('../TherapySession');
  try {
    if (req.user.role !== 'therapist') {
      return res.status(403).json({ error: 'Therapists only.' });
    }
    const session = await TherapySession.findOne({
      where: { id: req.params.id, therapistId: req.user.id },
    });
    if (!session) return res.status(404).json({ error: 'Session not found.' });
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
router.post('/therapist/:id/notes', async (req, res) => {
  const TherapySession = require('../TherapySession');
  const SessionNote    = require('../SessionNote');
  try {
    if (req.user.role !== 'therapist') {
      return res.status(403).json({ error: 'Therapists only.' });
    }
    const session = await TherapySession.findOne({
      where: { id: req.params.id, therapistId: req.user.id },
    });
    if (!session) return res.status(404).json({ error: 'Session not found.' });
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
    if (!session) return res.status(404).json({ error: 'Session not found.' });
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

module.exports = router;