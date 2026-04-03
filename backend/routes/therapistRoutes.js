// HU-046 + HU-049 + HU-050 + HU-062 + HU-065 — Therapist routes

const express = require('express');
const router = express.Router();
const User = require('../User');
const MoodLog = require('../MoodLog');
const SessionRating = require('../SessionRating');
const ClinicalNote = require('../ClinicalNote');
const Anthropic = require('@anthropic-ai/sdk');

const {
  PromptVault,
  getActivePrompt,
  proposePrompt,
} = require('../promptVault');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ==========================================
// Encryption helpers for clinical data
// ==========================================
const crypto = require('crypto');
const ALGORITHM = 'aes-256-cbc';
const KEY = Buffer.from(
  (process.env.DB_PASS || 'default_password_2026').padEnd(32).slice(0, 32)
);

const encrypt = (text) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
};

const decrypt = (text) => {
  try {
    const parts = text.split(':');
    const iv = Buffer.from(parts.shift(), 'hex');
    const encryptedContent = parts.join(':');
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    let decrypted = decipher.update(encryptedContent, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('⚠️ Error decrypting clinical note:', error.message);
    return text;
  }
};

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

    const patients = await User.findAll({
      where: { therapistId, role: 'user' },
      attributes: ['id', 'name', 'email', 'active', 'createdAt'],
    });

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

    // Obtener todos los pacientes asignados al terapeuta
    const patients = await User.findAll({
      where: { therapistId, role: 'user', active: true },
      attributes: ['id', 'name'],
    });

    const inactivePatients = [];
    const notableProgress  = [];

    await Promise.all(patients.map(async (p) => {

      const moodLogs = await MoodLog.findAll({
        where: { UserId: p.id },
        order: [['date', 'DESC']],
        limit: 14,
      });

      // ── Alerta 1: sin actividad en últimos 7 días ──────────────────────
      const lastLog = moodLogs[0] ?? null;
      if (!lastLog) {
        // Nunca ha tenido sesión
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

      // ── Alerta 2: progreso notable (mejora >= 30% en mood) ─────────────
      if (moodLogs.length >= 4) {
        // Últimos 3 días vs días 4-7
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

    if (!patient) {
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

    res.json({
      hasPrompt: !!content,
      content: content ?? null,
      active: activeRecord ?? null,
      pending: pendingRecord ?? null,
    });
  } catch (error) {
    console.error('❌ Error fetching therapist prompt:', error);
    res.status(500).json({ error: 'Could not fetch prompt.' });
  }
});

router.post('/prompt/propose', async (req, res) => {
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

    if (!patient) {
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
      content: decrypt(n.content),
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

router.post('/pacientes/:id/notas', async (req, res) => {
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
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found or not assigned to you.' });
    }

    const note = await ClinicalNote.create({
      UserId: patientId,
      therapistId,
      content: encrypt(content),
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

router.put('/notas/:noteId', async (req, res) => {
  try {
    const therapistId = req.user.id;
    const { noteId } = req.params;
    const { content, type, sessionDate } = req.body;

    const note = await ClinicalNote.findOne({
      where: { id: noteId, therapistId },
    });

    if (!note) {
      return res.status(404).json({ error: 'Note not found or not authorized.' });
    }

    const updates = {};
    if (content)     updates.content     = encrypt(content);
    if (type)        updates.type        = type;
    if (sessionDate) updates.sessionDate = sessionDate;

    await note.update(updates);

    res.json({
      message: 'Note updated successfully.',
      note: { ...note.toJSON(), content: content ?? decrypt(note.content) },
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
      attributes: ['id', 'name'],
    });

    if (!patient) {
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

    const notes = await ClinicalNote.findAll({
      where: { UserId: patientId, therapistId },
      order: [['sessionDate', 'DESC']],
      limit: 10,
    });

    const decryptedNotes = notes.map(n => decrypt(n.content));

    const avgMood = moodLogs.length > 0
      ? (moodLogs.flatMap(m => [m.checkin_mood, m.checkout_mood])
          .filter(Boolean)
          .reduce((a, b) => a + b, 0) / moodLogs.length).toFixed(1)
      : 'N/A';

    const avgRating = ratings.length > 0
      ? (ratings.reduce((a, r) => a + r.rating, 0) / ratings.length).toFixed(1)
      : 'N/A';

    const prompt = `You are a clinical assistant helping a therapist understand their patient's progress.

Patient: ${patient.name}
Total sessions: ${moodLogs.length}
Average mood (1-5): ${avgMood}
Average session rating (1-5): ${avgRating}

Recent therapist notes:
${decryptedNotes.length > 0 ? decryptedNotes.join('\n---\n') : 'No notes yet.'}

Please write a concise clinical summary (3-5 sentences) of this patient's emotional progress and current state. Focus on observable trends, not diagnoses. Be professional and empathetic.`;

    const msg = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    });

    res.json({
      summary: msg.content[0].text,
      generatedAt: new Date().toISOString(),
      basedOn: { sessions: moodLogs.length, notes: notes.length },
    });
  } catch (error) {
    console.error('❌ Error generating AI summary:', error);
    res.status(500).json({ error: 'Could not generate summary.' });
  }
});

module.exports = router;