// backend/routes/chat.js
// POST /api/chat
// GET  /api/messages
// verificarToken aplicado en server.js

const express    = require('express');
const router     = express.Router();
const User       = require('../User');
const Message = require('../message');
const anthropic  = require('../utils/anthropic');
const { encriptar, desencriptar } = require('../utils/crypto');
const { getActivePrompt }         = require('../promptVault');
const EthicManifest               = require('../EthicManifest');

// Internal helper — fetches active manifest content (decrypted)
// Returns null silently if no manifest exists or any error occurs
const getActiveManifest = async () => {
  try {
    const active = await EthicManifest.findOne({
      where: { isActive: true },
      order: [['createdAt', 'DESC']],
    });
    if (!active) return null;
    return desencriptar(active.content);
  } catch (err) {
    console.error('⚠️ Could not load ethics manifest:', err.message);
    return null;
  }
};

// POST /api/chat
router.post('/chat', async (req, res) => {
  const mensajeUsuario = req.body.message;
  const userId = req.user.id;
  try {
    const user = await User.findByPk(userId, { attributes: ['therapistId'] });

    // ── System prompt del terapeuta o el de Elevation por defecto ────────────
    let therapistPrompt = null;
    if (user?.therapistId) {
      therapistPrompt = await getActivePrompt(`therapist_prompt_${user.therapistId}`);
    }
    if (!therapistPrompt) therapistPrompt = await getActivePrompt('elevation_system_prompt');
    if (!therapistPrompt) therapistPrompt = 'You are Elevation, an empathetic emotional wellness companion. You listen actively and ask reflective questions. Your responses are concise, warm and you never use emojis.';

    // ── Manifiesto Ético — se inyecta como contexto adicional ────────────────
    const manifest = await getActiveManifest();
    const systemPrompt = manifest
      ? `${therapistPrompt}\n\n---\nETHICS MANIFEST (Elevation Ethics Board — binding guidelines):\n${manifest}\n---`
      : therapistPrompt;

    // ── Historial de conversación ─────────────────────────────────────────────
    const historialDB = await Message.findAll({
      where: { UserId: userId },
      order: [['createdAt', 'ASC']],
      limit: 20,
    });

    const historial = historialDB.map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: desencriptar(m.content),
    }));

    historial.push({ role: 'user', content: mensajeUsuario });

    await Message.create({ role: 'user', content: encriptar(mensajeUsuario), UserId: userId });

    const msg = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1000,
      system: systemPrompt,
      messages: historial,
    });

    const respuestaIA = msg.content[0].text;
    await Message.create({ role: 'assistant', content: encriptar(respuestaIA), UserId: userId });

    res.json({ reply: respuestaIA });
  } catch (error) {
    console.error('❌ Error de comunicación:', error);
    res.status(500).json({ reply: 'Lo siento, tuve una pequeña desconexión. ¿Podrías repetirme eso?' });
  }
});

// GET /api/messages
router.get('/messages', async (req, res) => {
  try {
    const mensajes = await Message.findAll({
      where: { UserId: req.user.id },
      order: [['createdAt', 'ASC']],
    });
    const historial = mensajes.map(m => ({
      role: m.role === 'assistant' ? 'bot' : 'user',
      text: desencriptar(m.content),
    }));
    res.json(historial);
  } catch (error) {
    console.error('❌ Error obteniendo historial:', error);
    res.status(500).json({ error: 'No se pudo cargar el historial.' });
  }
});

module.exports = router;