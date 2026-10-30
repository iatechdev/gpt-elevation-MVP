// backend/routes/chat.js
// POST /api/chat
// GET  /api/chat/turns/:requestId
// GET  /api/messages
// verificarToken aplicado en server.js
//
// ES-20/16: se confirma mensaje + respuesta válida (Claude, seguridad o pausa explícita); con requestId el reintento
// no duplica mensajes ni vuelve a llamar al proveedor; el historial usa los mensajes MÁS RECIENTES; el diario solo entra
// en el prompt si la persona elige las entradas (contextEntryIds).

const express    = require('express');
const router     = express.Router();
const { sequelize } = require('../database');
const User       = require('../User');
const Message = require('../message');
const ChatTurn = require('../ChatTurn');
const DiaryEntry = require('../DiaryEntry');
const anthropic  = require('../utils/anthropic');
const { callClaude, AiBudgetNotConfiguredError, AiBudgetExhaustedError } = require('../utils/aiClient');
const { textOf } = require('../utils/claudeText');
const { encriptar, encriptarV2, desencriptar } = require('../utils/crypto');
const { getActivePrompt }         = require('../promptVault');
const EthicManifest               = require('../EthicManifest');
const { validateBody, nonempty, optional } = require('../middlewares/validateBody');
const { MAX_MESSAGE_CHARS, normalizeText, capText, redactSecrets, fenceUntrusted, COMPANION_LIMITS } = require('../utils/promptSafety');
const { detectRisk, buildSafetyReply, buildSupportNote, normalizeCountry } = require('../utils/safety');
const { explicitPauseLanguage, PAUSE_REPLY, FALLBACK_REPLY } = require('../utils/companionTone');
const { COMPASS_KEY, validMode, composeCompassPrompt } = require('../utils/compassGuide');

const HISTORY_LIMIT = 20;
const CHAT_MAX_TOKENS = 2000; // ES43-QA-01: con 1500 y esfuerzo bajo 2 de 11 turnos largos aún cerraban por max_tokens (salida máxima ≈1479); el presupuesto reserva este valor por llamada
// ES43-QA-01: Sonnet 5.5 razona por defecto (esfuerzo alto) y esos tokens cuentan contra max_tokens, así que el chat se cortaba con poco texto visible.
// Esfuerzo bajo = razonamiento corto; el tope sigue en CHAT_MAX_TOKENS y no se recorta el texto ni se toca el prompt.
const CHAT_OUTPUT_CONFIG = { effort: 'low' };
const PENDING_TIMEOUT_MS = 2 * 60 * 1000; // un turno pendiente más viejo que esto se puede reintentar
const MAX_CONTEXT_ENTRIES = 3;
const MAX_CONTEXT_CHARS = 2000;
const REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/;
const BUDGET_REPLY = {
  es: 'Por ahora alcanzaste el límite de uso del asistente. Tu conversación y tus avances están guardados; podrás continuar cuando se renueve el periodo.',
  en: 'You have reached the assistant usage limit for now. Your conversation and progress are saved; you can continue when the period renews.',
};
const NOT_CONFIGURED_REPLY = {
  es: 'El asistente no está disponible por el momento. Tu conversación y tus avances están guardados.',
  en: 'The assistant is not available at the moment. Your conversation and progress are saved.',
};

const validRequestId = (value) => typeof value === 'string' && REQUEST_ID.test(value);
const validMessage = (value) => nonempty(value) && value.length <= MAX_MESSAGE_CHARS;
// Campos opcionales del cliente (country, lang): si vienen mal formados se ignoran. Nunca deben impedir la respuesta de seguridad (QA-21-01).
const normalizeLang = (value) => {
  const base = typeof value === 'string' ? value.trim().toLowerCase().split(/[-_]/)[0] : '';
  return base === 'es' || base === 'en' ? base : null;
};
const validEntryIds = (value) => Array.isArray(value) && value.length <= MAX_CONTEXT_ENTRIES
  && value.every((id) => Number.isSafeInteger(id) && id > 0);

const refusal = (status, code, error, requestId) => ({ status, response: { error, code, requestId } });

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
    console.error('⚠️ Could not load ethics manifest:', err && err.name);
    return null;
  }
};

// Entradas del diario elegidas por la persona: solo las suyas y no borradas; si alguna no cumple, no se usa ninguna.
const loadContextEntries = async (userId, ids) => {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return [];
  const rows = await DiaryEntry.findAll({ where: { id: unique, UserId: userId, deletedAt: null } });
  if (rows.length !== unique.length) return null;
  return rows.map((row) => ({ date: row.entryDate, text: capText(normalizeText(desencriptar(row.content)), MAX_CONTEXT_CHARS) }));
};

// Reclama el turno de un requestId: crea uno nuevo, repite uno completado o reintenta uno fallido/vencido.
const claimTurn = async (userId, requestId, message) => {
  try {
    const turn = await ChatTurn.create({
      UserId: userId, requestId, status: 'pending', userContent: encriptarV2(message),
    });
    return { turn };
  } catch (error) {
    if (!error || error.name !== 'SequelizeUniqueConstraintError') throw error;
  }
  const existing = await ChatTurn.findOne({ where: { UserId: userId, requestId } });
  if (!existing) throw new Error('Turno no encontrado tras un choque de unicidad.');
  if (desencriptar(existing.userContent) !== message) {
    return refusal(409, 'request_id_reuse',
      'Este requestId ya se usó con otro mensaje. / This requestId was already used with a different message.', requestId);
  }
  if (existing.status === 'completed') {
    return { status: 200, response: { reply: desencriptar(existing.replyContent), requestId, replayed: true } };
  }
  const stale = Date.now() - new Date(existing.updatedAt).getTime() > PENDING_TIMEOUT_MS;
  if (existing.status === 'pending' && !stale) {
    return refusal(409, 'turn_in_progress', 'Este mensaje ya se está procesando. / This message is already being processed.', requestId);
  }
  // Fallido o pendiente vencido: se reclama de forma atómica; si otra solicitud lo reclamó antes, esta se rechaza.
  const [claimed] = await ChatTurn.update(
    { status: 'pending', failureCode: null },
    { where: { id: existing.id, status: existing.status, updatedAt: existing.updatedAt } },
  );
  if (!claimed) {
    return refusal(409, 'turn_in_progress', 'Este mensaje ya se está procesando. / This message is already being processed.', requestId);
  }
  return { turn: existing };
};

const failTurn = async (turn, failureCode) => {
  if (!turn) return;
  try { await turn.update({ status: 'failed', failureCode }); } catch (error) {
    console.error('⚠️ No se pudo marcar el turno como fallido:', error && error.name);
  }
};

// POST /api/chat
router.post('/chat', validateBody({
  message: validMessage,
  requestId: optional(validRequestId),
  contextEntryIds: optional(validEntryIds),
  mode: optional(validMode), // ES-13: solo cambia el prompt de esta solicitud; no se guarda
}), async (req, res) => {
  // ES-21: el texto se normaliza (controles e invisibles fuera) antes de usarse en cualquier parte del prompt.
  const mensajeUsuario = normalizeText(req.body.message);
  if (!mensajeUsuario) return res.status(400).json({ error: 'Datos de entrada inválidos. / Invalid input data.' });
  const userId = req.user.id;
  const requestId = req.body.requestId;
  let replyLang = normalizeLang(req.body.lang) ?? 'es';
  let turn = null;

  // Confirma el turno completo (mensaje + respuesta) en una sola transacción.
  const confirmTurn = async (respuesta) => {
    const transaction = await sequelize.transaction();
    try {
      await Message.create({ role: 'user', content: encriptar(mensajeUsuario), UserId: userId }, { transaction });
      await Message.create({ role: 'assistant', content: encriptar(respuesta), UserId: userId }, { transaction });
      if (turn) await turn.update({ status: 'completed', replyContent: encriptarV2(respuesta), failureCode: null }, { transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback().catch(() => {});
      throw error;
    }
  };

  try {
    const contexto = await loadContextEntries(userId, req.body.contextEntryIds ?? []);
    if (contexto === null) {
      return res.status(404).json({
        error: 'Entrada de diario no encontrada. / Diary entry not found.', code: 'diary_entry_not_found',
      });
    }

    if (requestId) {
      const claimed = await claimTurn(userId, requestId, mensajeUsuario);
      if (claimed.response) return res.status(claimed.status).json(claimed.response);
      turn = claimed.turn;
    }

    // ES-21: el nivel de riesgo solo vive en esta solicitud: no se guarda, no se registra y no sale de aquí.
    const risk = detectRisk(mensajeUsuario);
    const pauseLang = explicitPauseLanguage(mensajeUsuario);
    const lang = normalizeLang(req.body.lang) ?? risk.lang ?? pauseLang ?? 'es';
    replyLang = lang;
    const country = normalizeCountry(req.body.country); // solo un país declarado; nunca se infiere del idioma
    if (risk.level === 'high') {
      // Escenario grave: se interrumpe el flujo ordinario y NO se llama al proveedor de IA.
      const reply = buildSafetyReply({ lang, country });
      await confirmTurn(reply);
      return res.json(requestId ? { reply, requestId, interrupted: true } : { reply, interrupted: true });
    }

    // ES-16: safety keeps priority. No provider, budget job or automatic follow-up for an ordinary explicit pause.
    if (!risk.level && pauseLang) {
      const reply = PAUSE_REPLY[lang];
      await confirmTurn(reply);
      return res.json(requestId ? { reply, requestId } : { reply });
    }

    const compass = req.body.mode === 'compass';
    // ── Manifiesto Ético — se inyecta como contexto adicional ────────────────
    const manifest = await getActiveManifest();
    let systemPrompt;
    if (compass) {
      // ES-13: la Brújula usa su propio prompt (Vault o borrador) y NO el del terapeuta.
      systemPrompt = composeCompassPrompt({ vaultPrompt: await getActivePrompt(COMPASS_KEY), manifest, lang });
    } else {
      const user = await User.findByPk(userId, { attributes: ['therapistId'] });

      // ── System prompt del terapeuta o el de Elevation por defecto ────────────
      let therapistPrompt = null;
      if (user?.therapistId) {
        therapistPrompt = await getActivePrompt(`therapist_prompt_${user.therapistId}`);
      }
      if (!therapistPrompt) therapistPrompt = await getActivePrompt('elevation_system_prompt');
      if (!therapistPrompt) therapistPrompt = 'You are Elevation, an empathetic emotional wellness companion. You listen actively and ask reflective questions. Your responses are concise, warm and you never use emojis.';
      systemPrompt = manifest
        ? `${therapistPrompt}

---
ETHICS MANIFEST (Elevation Ethics Board — binding guidelines):
${manifest}
---`
        : therapistPrompt;
    }

    // ── Entradas de diario elegidas por la persona (contexto, no instrucciones) ──
    if (contexto.length > 0) {
      const entries = redactSecrets(contexto.map((entry) => `[${entry.date}] ${entry.text}`).join('\n\n'));
      const { block } = fenceUntrusted('diary entries chosen by the person for this conversation', entries);
      systemPrompt += `\n\n---\n${block}\n---`;
    }
    // Los límites van al final: lo último que lee el modelo no es texto de la persona (QA-21-02).
    systemPrompt += `\n\n---\n${COMPANION_LIMITS}\n---`;

    // ── Historial: los mensajes MÁS RECIENTES, en orden, empezando por un turno del usuario ──
    const recientes = await Message.findAll({
      where: { UserId: userId },
      order: [['createdAt', 'DESC'], ['id', 'DESC']],
      limit: HISTORY_LIMIT,
    });
    const historial = recientes.reverse().map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: redactSecrets(capText(normalizeText(desencriptar(m.content)))),
    })).filter(m => m.content);
    while (historial.length > 0 && historial[0].role === 'assistant') historial.shift();
    historial.push({ role: 'user', content: redactSecrets(mensajeUsuario) });

    let respuestaIA;
    try {
      const msg = await callClaude({
        userId, kind: 'chat', requestId: requestId ?? null,
        body: { model: anthropic.MODEL, max_tokens: CHAT_MAX_TOKENS, output_config: CHAT_OUTPUT_CONFIG, system: systemPrompt, messages: historial },
      });
      respuestaIA = textOf(msg);
      if (!respuestaIA.trim()) throw new Error('Respuesta vacía del proveedor.');
    } catch (error) {
      // Presupuesto agotado o sin configurar (V-13): no se llama al proveedor, se conserva el avance y no se amplía solo.
      if (error instanceof AiBudgetExhaustedError) {
        await failTurn(turn, 'budget_exhausted');
        return res.status(429).json({
          reply: BUDGET_REPLY[lang] ?? BUDGET_REPLY.es, code: 'ai_budget_exhausted', retryable: false,
          scope: error.scope, resetsAt: error.resetsAt, requestId: requestId ?? null,
        });
      }
      if (error instanceof AiBudgetNotConfiguredError) {
        await failTurn(turn, 'budget_not_configured');
        return res.status(503).json({
          reply: NOT_CONFIGURED_REPLY[lang] ?? NOT_CONFIGURED_REPLY.es, code: 'ai_budget_not_configured', retryable: false, requestId: requestId ?? null,
        });
      }
      // Fallo del proveedor: la conversación válida queda intacta y se puede reintentar con el mismo requestId.
      console.error('❌ Error del proveedor de IA:', error && error.name);
      await failTurn(turn, 'provider_unavailable');
      return res.status(502).json({
        reply: FALLBACK_REPLY[replyLang], code: 'provider_unavailable', retryable: true, requestId: requestId ?? null,
      });
    }

    // Malestar: la respuesta ordinaria se acompaña de una nota breve de apoyo (con recursos solo si están verificados).
    if (risk.level === 'medium') respuestaIA = `${respuestaIA}\n\n${buildSupportNote({ lang, country })}`;

    // ── Se confirma el turno completo (mensaje + respuesta) ──
    await confirmTurn(respuestaIA);

    res.json(requestId ? { reply: respuestaIA, requestId } : { reply: respuestaIA });
  } catch (error) {
    console.error('❌ Error de comunicación:', error && error.name);
    await failTurn(turn, 'internal_error');
    res.status(500).json({ reply: FALLBACK_REPLY[replyLang] });
  }
});

// GET /api/chat/turns/:requestId — estado de un turno propio (recuperación desde otro navegador)
router.get('/chat/turns/:requestId', async (req, res) => {
  const { requestId } = req.params;
  if (!validRequestId(requestId)) return res.status(404).json({ error: 'Turno no encontrado. / Turn not found.' });
  try {
    const turn = await ChatTurn.findOne({ where: { UserId: req.user.id, requestId } });
    if (!turn) return res.status(404).json({ error: 'Turno no encontrado. / Turn not found.' });
    const stale = turn.status === 'pending' && Date.now() - new Date(turn.updatedAt).getTime() > PENDING_TIMEOUT_MS;
    res.json({
      requestId,
      status: turn.status,
      retryable: turn.status === 'failed' || stale,
      ...(turn.status === 'completed' ? { reply: desencriptar(turn.replyContent) } : {}),
    });
  } catch (error) {
    console.error('❌ Error obteniendo el turno:', error && error.name);
    res.status(500).json({ error: 'No se pudo obtener el turno.' });
  }
});

// GET /api/messages
router.get('/messages', async (req, res) => {
  try {
    const mensajes = await Message.findAll({
      where: { UserId: req.user.id },
      order: [['createdAt', 'ASC'], ['id', 'ASC']],
    });
    const historial = mensajes.map(m => ({
      role: m.role === 'assistant' ? 'bot' : 'user',
      text: desencriptar(m.content),
    }));
    res.json(historial);
  } catch (error) {
    console.error('❌ Error obteniendo historial:', error && error.name);
    res.status(500).json({ error: 'No se pudo cargar el historial.' });
  }
});

module.exports = router;
