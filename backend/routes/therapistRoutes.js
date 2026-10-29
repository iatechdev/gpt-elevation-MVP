// HU-046 + HU-049 + HU-050 + HU-062 + HU-065 — Therapist routes

const express = require('express');
const router = express.Router();
const User = require('../User');
const MoodLog = require('../MoodLog');
const SessionRating = require('../SessionRating');
const ClinicalNote = require('../ClinicalNote');
const { validateBody, nonempty, text, date, optional } = require('../middlewares/validateBody');

const { encriptar, desencriptar } = require('../utils/crypto');
const anthropic = require('../utils/anthropic');
const { textOf } = require('../utils/claudeText');
const { blockedPatientIds, patientBlocked } = require('../utils/therapistAccess'); // ES-101
const { callClaude, AiBudgetNotConfiguredError, AiBudgetExhaustedError } = require('../utils/aiClient'); // ES-102

const {
  PromptVault,
  getActivePrompt,
  proposePrompt,
} = require('../promptVault');

// ==========================================
// HU-062 — Trend calculation helper
// ==========================================
const calculateTrend = (moodLogs) => {
  if (!moodLogs || moodLogs.length < 3) return null;

  const now = Date.now();
  const ONE_DAY = 1000 * 60 * 60 * 24;

  const recent = [];
  const older  = [];

  for (const log of moodLogs) {
    const daysDiff = (now - new Date(log.date).getTime()) / ONE_DAY;
    const values = [log.checkin_mood, log.checkout_mood].filter(v => v != null);
    if (values.length === 0) continue;
    const dayAvg = values.reduce((a, b) => a + b, 0) / values.length;

    if (daysDiff < 3)      recent.push(dayAvg);
    else if (daysDiff < 7) older.push(dayAvg);
  }

  if (recent.length === 0 || older.length === 0) return null;

  const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length;
  const avgOlder  = older.reduce((a, b) => a + b, 0) / older.length;
  const diff = avgRecent - avgOlder;

  if (diff > 0.5)  return 'improving';
  if (diff < -0.5) return 'declining';
  return 'stable';
};

// ==========================================
// GET /api/therapist/pacientes
// ==========================================
router.get('/pacientes', async (req, res) => {
  try {
    const therapistId = req.user.id;

    const linked = await User.findAll({
      where: { therapistId, role: 'user' },
      attributes: ['id', 'name', 'email', 'active', 'createdAt'],
    });
    // ES-101: sin eliminación aceptada ni cuenta inactiva en la lista.
    const blocked = await blockedPatientIds(linked.map((p) => p.id));
    const patients = linked.filter((p) => !blocked.has(p.id));

    const patientsWithStats = await Promise.all(
      patients.map(async (p) => {
        const moodLogs = await MoodLog.findAll({
          where: { UserId: p.id },
          order: [['date', 'DESC']],
          limit: 30,
        });

        const ratings = await SessionRating.findAll({
          where: { UserId: p.id },
          attributes: ['rating'],
        });

        const lastMood = moodLogs[0] ?? null;

        const allMoods = moodLogs
          .flatMap(m => [m.checkin_mood, m.checkout_mood])
          .filter(Boolean);

        const moodTrend = allMoods.length >= 2
          ? allMoods[0] >= allMoods[1] ? 'up' : 'down'
          : 'neutral';

        const avgRating = ratings.length > 0
          ? Math.round((ratings.reduce((acc, r) => acc + r.rating, 0) / ratings.length) * 10) / 10
          : null;

        const sessionsThisWeek = moodLogs.filter(m => {
          const daysDiff = (Date.now() - new Date(m.date).getTime()) / (1000 * 60 * 60 * 24);
          return daysDiff <= 7;
        }).length;

        const trend = calculateTrend(moodLogs);

        return {
          id: p.id,
          name: p.name,
          email: p.email,
          active: p.active,
          createdAt: p.createdAt,
          lastMood,
          moodTrend,
          avgRating,
          totalSessions: moodLogs.length,
          sessionsThisWeek,
          trend,
        };
      })
    );

    res.json(patientsWithStats);
  } catch (error) {
    console.error('❌ Error fetching patients:', error);
    res.status(500).json({ error: 'Could not fetch patients.' });
  }
});

// ==========================================
// HU-065 — GET /api/therapist/alerts
// ==========================================
router.get('/alerts', async (req, res) => {
  try {
    const therapistId = req.user.id;
    const now = Date.now();
    const ONE_DAY = 1000 * 60 * 60 * 24;

    const linked = await User.findAll({
      where: { therapistId, role: 'user', active: true },
      attributes: ['id', 'name'],
    });
    const blocked = await blockedPatientIds(linked.map((p) => p.id)); // ES-101
    const patients = linked.filter((p) => !blocked.has(p.id));

    const inactivePatients = [];
    const notableProgress  = [];

    await Promise.all(patients.map(async (p) => {
      const moodLogs = await MoodLog.findAll({
        where: { UserId: p.id },
        order: [['date', 'DESC']],
        limit: 14,
      });

      const lastLog = moodLogs[0] ?? null;
      if (!lastLog) {
        inactivePatients.push({ userId: p.id, name: p.name, daysSinceLastSession: null });
      } else {
        const daysSince = (now - new Date(lastLog.date).getTime()) / ONE_DAY;
        if (daysSince >= 7) {
          inactivePatients.push({
            userId: p.id,
            name: p.name,
            daysSinceLastSession: Math.floor(daysSince),
          });
        }
      }

      if (moodLogs.length >= 4) {
        const recent = moodLogs.filter(m => {
          const d = (now - new Date(m.date).getTime()) / ONE_DAY;
          return d < 3;
        });
        const older = moodLogs.filter(m => {
          const d = (now - new Date(m.date).getTime()) / ONE_DAY;
          return d >= 3 && d < 7;
        });

        if (recent.length > 0 && older.length > 0) {
          const avgRecent = recent
            .flatMap(m => [m.checkin_mood, m.checkout_mood].filter(Boolean))
            .reduce((a, b, _, arr) => a + b / arr.length, 0);

          const avgOlder = older
            .flatMap(m => [m.checkin_mood, m.checkout_mood].filter(Boolean))
            .reduce((a, b, _, arr) => a + b / arr.length, 0);

          if (avgOlder > 0) {
            const improvementPercent = Math.round(((avgRecent - avgOlder) / avgOlder) * 100);
            if (improvementPercent >= 30) {
              notableProgress.push({
                userId: p.id,
                name: p.name,
                improvementPercent,
              });
            }
          }
        }
      }
    }));

    res.json({ inactivePatients, notableProgress });
  } catch (error) {
    console.error('❌ Error fetching therapist alerts:', error);
    res.status(500).json({ error: 'Could not fetch alerts.' });
  }
});

// ==========================================
// GET /api/therapist/pacientes/:id/historial
// ==========================================
router.get('/pacientes/:id/historial', async (req, res) => {
  try {
    const therapistId = req.user.id;
    const patientId = req.params.id;

    const patient = await User.findOne({
      where: { id: patientId, therapistId, role: 'user' },
      attributes: ['id', 'name', 'email', 'createdAt'],
    });

    if (!patient || await patientBlocked(patient.id)) { // ES-101: eliminación aceptada o cuenta inactiva → 404 uniforme
      return res.status(404).json({ error: 'Patient not found or not assigned to you.' });
    }

    const moodLogs = await MoodLog.findAll({
      where: { UserId: patientId },
      order: [['date', 'DESC']],
      limit: 30,
    });

    const ratings = await SessionRating.findAll({
      where: { UserId: patientId },
      order: [['date', 'DESC']],
      limit: 30,
    });

    res.json({ patient: patient.toJSON(), moodLogs, ratings });
  } catch (error) {
    console.error('❌ Error fetching patient history:', error);
    res.status(500).json({ error: 'Could not fetch patient history.' });
  }
});

// ==========================================
// HU-049 — THERAPIST PROMPT MANAGEMENT
// ==========================================
router.get('/prompt', async (req, res) => {
  try {
    const therapistId = req.user.id;
    const promptKey = `therapist_prompt_${therapistId}`;

    const content = await getActivePrompt(promptKey);

    const activeRecord = await PromptVault.findOne({
      where: { key: promptKey, status: 'active' },
      attributes: ['id', 'version', 'status', 'approved_by', 'approved_at', 'updatedAt'],
    });

    const pendingRecord = await PromptVault.findOne({
      where: { key: promptKey, status: 'pending_review' },
      attributes: ['id', 'version', 'status', 'proposed_by', 'createdAt'],
    });

    const rejectedRecord = await PromptVault.findOne({
      where: { key: promptKey, status: 'rejected' },
      attributes: ['id', 'version', 'status', 'rejected_by', 'rejection_note', 'rejected_at'],
      order: [['version', 'DESC']],
    });

    res.json({
      hasPrompt: !!content,
      content: content ?? null,
      active: activeRecord ?? null,
      pending: pendingRecord ?? null,
      rejected: rejectedRecord ?? null,
    });

  } catch (error) {
    console.error('❌ Error fetching therapist prompt:', error);
    res.status(500).json({ error: 'Could not fetch prompt.' });
  }
});

router.post('/prompt/propose', validateBody({ content: nonempty }), async (req, res) => {
  try {
    const therapistId = req.user.id;
    const { content } = req.body;

    if (!content || content.trim().length < 50) {
      return res.status(400).json({ error: 'Prompt content must be at least 50 characters.' });
    }

    const promptKey = `therapist_prompt_${therapistId}`;

    const existing = await PromptVault.findOne({
      where: { key: promptKey, status: 'pending_review' },
    });

    if (existing) {
      return res.status(409).json({
        error: 'You already have a version pending review. Wait for superadmin approval before proposing a new one.',
      });
    }

    await proposePrompt(promptKey, content, req.user.name);

    res.json({ message: 'Prompt submitted for superadmin review.' });
  } catch (error) {
    console.error('❌ Error proposing therapist prompt:', error);
    res.status(500).json({ error: 'Could not submit prompt.' });
  }
});

router.get('/prompt/versions', async (req, res) => {
  try {
    const therapistId = req.user.id;
    const promptKey = `therapist_prompt_${therapistId}`;

    const versions = await PromptVault.findAll({
      where: { key: promptKey },
      attributes: [
        'id', 'version', 'status', 'proposed_by', 'approved_by',
        'rejected_by', 'rejection_note', 'approved_at', 'rejected_at', 'createdAt',
      ],
      order: [['version', 'DESC']],
    });

    res.json(versions);
  } catch (error) {
    console.error('❌ Error fetching prompt versions:', error);
    res.status(500).json({ error: 'Could not fetch prompt versions.' });
  }
});

// ==========================================
// HU-050 — CLINICAL HISTORY
// ==========================================
router.get('/pacientes/:id/historia', async (req, res) => {
  try {
    const therapistId = req.user.id;
    const patientId = req.params.id;

    const patient = await User.findOne({
      where: { id: patientId, therapistId, role: 'user' },
      attributes: ['id', 'name', 'email', 'createdAt', 'therapistId'],
    });

    if (!patient || await patientBlocked(patient.id)) { // ES-101: eliminación aceptada o cuenta inactiva → 404 uniforme
      return res.status(404).json({ error: 'Patient not found or not assigned to you.' });
    }

    const moodLogs = await MoodLog.findAll({
      where: { UserId: patientId },
      order: [['date', 'DESC']],
      limit: 60,
    });

    const ratings = await SessionRating.findAll({
      where: { UserId: patientId },
      order: [['date', 'DESC']],
      limit: 60,
    });

    const notes = await ClinicalNote.findAll({
      where: { UserId: patientId, therapistId },
      order: [['sessionDate', 'DESC']],
    });

    const decryptedNotes = notes.map(n => ({
      ...n.toJSON(),
      content: desencriptar(n.content),
    }));

    res.json({
      patient: patient.toJSON(),
      moodLogs,
      ratings,
      notes: decryptedNotes,
    });
  } catch (error) {
    console.error('❌ Error fetching clinical history:', error);
    res.status(500).json({ error: 'Could not fetch clinical history.' });
  }
});

router.post('/pacientes/:id/notas', validateBody({ content: nonempty, sessionDate: date, type: optional(text) }), async (req, res) => {
  try {
    const therapistId = req.user.id;
    const patientId = req.params.id;
    const { content, type, sessionDate } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Note content is required.' });
    }
    if (!sessionDate) {
      return res.status(400).json({ error: 'Session date is required.' });
    }

    const validTypes = ['session_note', 'observation', 'goal'];
    const noteType = validTypes.includes(type) ? type : 'session_note';

    const patient = await User.findOne({
      where: { id: patientId, therapistId, role: 'user' },
    });
    if (!patient || await patientBlocked(patient.id)) { // ES-101: eliminación aceptada o cuenta inactiva → 404 uniforme
      return res.status(404).json({ error: 'Patient not found or not assigned to you.' });
    }

    const note = await ClinicalNote.create({
      UserId: patientId,
      therapistId,
      content: encriptar(content),
      type: noteType,
      sessionDate,
    });

    res.status(201).json({
      message: 'Note saved successfully.',
      note: { ...note.toJSON(), content },
    });
  } catch (error) {
    console.error('❌ Error creating clinical note:', error);
    res.status(500).json({ error: 'Could not save note.' });
  }
});

router.put('/notas/:noteId', validateBody({ content: optional(text), sessionDate: optional(date), type: optional(text) }), async (req, res) => {
  try {
    const therapistId = req.user.id;
    const { noteId } = req.params;
    const { content, type, sessionDate } = req.body;

    const note = await ClinicalNote.findOne({
      where: { id: noteId, therapistId },
    });

    if (!note || await patientBlocked(note.UserId)) { // ES-101: tampoco se edita la nota de una persona bloqueada
      return res.status(404).json({ error: 'Note not found or not authorized.' });
    }

    const updates = {};
    if (content)     updates.content     = encriptar(content);
    if (type)        updates.type        = type;
    if (sessionDate) updates.sessionDate = sessionDate;

    await note.update(updates);

    res.json({
      message: 'Note updated successfully.',
      note: { ...note.toJSON(), content: content ?? desencriptar(note.content) },
    });
  } catch (error) {
    console.error('❌ Error updating clinical note:', error);
    res.status(500).json({ error: 'Could not update note.' });
  }
});

router.get('/pacientes/:id/resumen-ia', async (req, res) => {
  try {
    const therapistId = req.user.id;
    const patientId = req.params.id;

    const patient = await User.findOne({
      where: { id: patientId, therapistId, role: 'user' },
      attributes: ['id'],
    });

    if (!patient || await patientBlocked(patient.id)) { // ES-101: eliminación aceptada o cuenta inactiva → 404 uniforme
      return res.status(404).json({ error: 'Patient not found or not assigned to you.' });
    }

    const moodLogs = await MoodLog.findAll({
      where: { UserId: patientId },
      order: [['date', 'DESC']],
      limit: 30,
    });

    const ratings = await SessionRating.findAll({
      where: { UserId: patientId },
      order: [['date', 'DESC']],
      limit: 30,
    });

    // ES-102: el promedio se calcula sobre los valores registrados (entrada y salida), no sobre el número de registros;
    // antes la suma de dos valores por registro se dividía entre los registros y podía salir fuera de la escala 1-5.
    const moods = moodLogs.flatMap(m => [m.checkin_mood, m.checkout_mood]).filter(Boolean);
    const avgMood = moods.length > 0 ? (moods.reduce((a, b) => a + b, 0) / moods.length).toFixed(1) : 'N/A';

    const avgRating = ratings.length > 0
      ? (ratings.reduce((a, r) => a + r.rating, 0) / ratings.length).toFixed(1)
      : 'N/A';

    // ES-102 (ES93-A2): solo datos estructurados (ánimo y valoraciones). Las notas del terapeuta NO se envían al proveedor de IA
    // (decisión de ES-79, 26-oct), ni el nombre ni el correo de la persona.
    const prompt = `You help a professional review a person's recent progress. The person is not identified in this request.

Total check-ins: ${moodLogs.length}
Average mood (1-5): ${avgMood}
Average session rating (1-5): ${avgRating}

Please write a concise, neutral summary (3-5 sentences) of the emotional progress and current state reflected in this data. Focus on observable trends. Do not diagnose, prescribe or predict outcomes. Be professional and empathetic.`;

    let msg;
    try {
      // ES-102 (ES93-A2/M5): por la puerta única de IA (presupuesto, tiempo de espera y reintentos acotados de ES-22).
      msg = await callClaude({
        userId: therapistId, kind: 'therapist_summary',
        body: { model: anthropic.MODEL, max_tokens: 400, messages: [{ role: 'user', content: prompt }] },
      });
    } catch (error) {
      if (error instanceof AiBudgetExhaustedError) {
        return res.status(429).json({ error: 'AI usage limit reached.', code: 'ai_budget_exhausted', retryable: false, scope: error.scope, resetsAt: error.resetsAt });
      }
      if (error instanceof AiBudgetNotConfiguredError) {
        return res.status(503).json({ error: 'AI is not available at the moment.', code: 'ai_budget_not_configured', retryable: false });
      }
      console.error('❌ Error del proveedor de IA (resumen):', error && error.name);
      return res.status(502).json({ error: 'Could not generate summary.', code: 'provider_unavailable', retryable: true });
    }

    res.json({
      summary: textOf(msg),
      generatedAt: new Date().toISOString(),
      basedOn: { sessions: moodLogs.length, notes: 0 }, // las notas ya no se usan; la clave se conserva por compatibilidad con la pantalla
    });
  } catch (error) {
    console.error('❌ Error generating AI summary:', error && error.name);
    res.status(500).json({ error: 'Could not generate summary.' });
  }
});

module.exports = router;
