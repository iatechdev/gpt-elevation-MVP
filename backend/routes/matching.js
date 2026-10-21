// backend/routes/matching.js
// POST /api/matching/request
// POST /api/matching/choose
// GET  /api/admin/matching/pending
// POST /api/admin/matching/:id/confirm
// verificarToken / verificarAdmin aplicados en server.js

const express          = require('express');
const router           = express.Router();
const { Op }           = require('sequelize');
const User             = require('../User');
const MoodLog          = require('../MoodLog');
const MatchingRequest  = require('../MatchingRequest');
const TherapistProfile = require('../TherapistProfile');
const anthropic        = require('../utils/anthropic');

// POST /api/matching/request
router.post('/request', async (req, res) => {
  try {
    const userId   = req.user.id;
    const { answers } = req.body;
    if (!answers) return res.status(400).json({ error: 'Answers are required.' });

    const therapists = await User.findAll({
      where: { role: 'therapist', active: true },
      attributes: ['id', 'name'],
      include: [{ model: TherapistProfile, required: false }],
    });

    const availableTherapists = therapists.filter(t =>
      !t.TherapistProfile || t.TherapistProfile.acceptingNew !== false
    );

    if (availableTherapists.length === 0) {
      return res.status(404).json({ error: 'No therapists available at this time.' });
    }

    const moodLogs = await MoodLog.findAll({
      where: { UserId: userId },
      order: [['date', 'DESC']],
      limit: 14,
    });

    const avgMood = moodLogs.length > 0
      ? (moodLogs.flatMap(m => [m.checkin_mood, m.checkout_mood]).filter(Boolean)
          .reduce((a, b) => a + b, 0) / moodLogs.length).toFixed(1)
      : 'No data';

    const therapistList = availableTherapists.map(t => ({
      id:          t.id,
      name:        t.name,
      specialties: t.TherapistProfile?.specialties ?? [],
      approach:    t.TherapistProfile?.approach    ?? 'General wellness',
      languages:   t.TherapistProfile?.languages   ?? ['es'],
      bio:         t.TherapistProfile?.bio          ?? '',
    }));

    const prompt = `You are a matching assistant for Elevation, a mental health platform.
User questionnaire answers:
- Main area to work on: ${answers.area ?? 'Not specified'}
- Preferred style: ${answers.style ?? 'Not specified'}
- Preferred language: ${answers.language ?? 'Spanish'}
User emotional context:
- Average mood (1-5): ${avgMood}
- Recent sessions: ${moodLogs.length}
Available therapists:
${therapistList.map(t => `ID: ${t.id} | Name: ${t.name} | Specialties: ${t.specialties.join(', ')} | Approach: ${t.approach} | Languages: ${t.languages.join(', ')}`).join('\n')}
Return ONLY a valid JSON array with the top 3 matches (or fewer if less available). No markdown, no extra text:
[{ "therapistId": <id>, "score": <1-10>, "reason": "<one sentence why this therapist fits>" }]`;

    const msg = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    });

    let suggestions = [];
    try {
      const raw = msg.content[0].text.replace(/```json|```/g, '').trim();
      suggestions = JSON.parse(raw);
    } catch {
      return res.status(500).json({ error: 'Could not parse suggestions.' });
    }

    const request = await MatchingRequest.create({
      UserId: userId,
      answers,
      suggestions,
      status: 'pending',
    });

    res.json({
      requestId: request.id,
      suggestions: suggestions.map(s => ({
        ...s,
        therapistName: therapistList.find(t => t.id === s.therapistId)?.name ?? 'Unknown',
      })),
    });
  } catch (error) {
    console.error('❌ Error in matching:', error);
    res.status(500).json({ error: 'Could not process matching request.' });
  }
});

// POST /api/matching/choose
router.post('/choose', async (req, res) => {
  try {
    const { requestId, therapistId } = req.body;
    const request = await MatchingRequest.findOne({
      where: { id: requestId, UserId: req.user.id },
    });
    if (!request) return res.status(404).json({ error: 'Request not found.' });
    await request.update({ chosenTherapistId: therapistId, status: 'pending' });
    res.json({ message: 'Therapist chosen. Waiting for admin confirmation.' });
  } catch (error) {
    res.status(500).json({ error: 'Could not save choice.' });
  }
});

// GET /api/admin/matching/pending
router.get('/pending', async (req, res) => {
  try {
    const requests = await MatchingRequest.findAll({
      where: { status: 'pending', chosenTherapistId: { [Op.ne]: null } },
      order: [['createdAt', 'DESC']],
    });
    const enriched = await Promise.all(requests.map(async r => {
      const user      = await User.findByPk(r.UserId,            { attributes: ['id', 'name', 'email'] });
      const therapist = await User.findByPk(r.chosenTherapistId, { attributes: ['id', 'name'] });
      return {
        id: r.id,
        user: user?.toJSON(),
        chosenTherapist: therapist?.toJSON(),
        answers: r.answers,
        createdAt: r.createdAt,
      };
    }));
    res.json(enriched);
  } catch (error) {
    res.status(500).json({ error: 'Could not fetch pending requests.' });
  }
});

// POST /api/admin/matching/:id/confirm
router.post('/:id/confirm', async (req, res) => {
  try {
    const request = await MatchingRequest.findByPk(req.params.id);
    if (!request) return res.status(404).json({ error: 'Request not found.' });
    if (!request.chosenTherapistId)
      return res.status(400).json({ error: 'No therapist chosen yet.' });
    await User.update({ therapistId: request.chosenTherapistId }, { where: { id: request.UserId } });
    await request.update({ status: 'confirmed' });
    res.json({ message: 'Therapist assigned successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Could not confirm assignment.' });
  }
});

module.exports = router;