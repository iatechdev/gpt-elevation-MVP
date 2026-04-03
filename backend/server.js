require('dotenv').config();
const rateLimit  = require('express-rate-limit');
const express    = require('express');
const cors       = require('cors');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const crypto     = require('crypto');
const Anthropic  = require('@anthropic-ai/sdk');

const { connectDB, sequelize } = require('./database');
const setupAssociations        = require('./associations');

// ── Models used directly in endpoints ───────────────────────────────────────
const User                   = require('./User');
const Message                = require('./Message');
const MoodLog                = require('./MoodLog');
const SessionRating          = require('./SessionRating');
const LandingContent         = require('./LandingContent');
const ClinicalNote           = require('./ClinicalNote');
const WellnessRecommendation = require('./WellnessRecommendation');
const TherapistProfile       = require('./TherapistProfile');
const MatchingRequest        = require('./MatchingRequest');

const {
  PromptVault, getActivePrompt, savePrompt,
  proposePrompt, approvePrompt, rejectPrompt, rollbackPrompt,
} = require('./promptVault');

// ── Routers ──────────────────────────────────────────────────────────────────
const adminUsersRouter = require('./routes/adminUsers');
const therapistRouter  = require('./routes/therapistRoutes');
const sessionsRouter   = require('./routes/sessions');

// ── App ───────────────────────────────────────────────────────────────────────
const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  optionsSuccessStatus: 200,
}));
app.use(express.json());

// ── Rate limiting ─────────────────────────────────────────────────────────────
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Demasiados intentos. Intentá de nuevo en un minuto.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ── Encryption ────────────────────────────────────────────────────────────────
const ALGORITMO = 'aes-256-cbc';
const KEY = Buffer.from(
  (process.env.DB_PASS || 'default_password_2026').padEnd(32).slice(0, 32)
);

const encriptar = (texto) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITMO, KEY, iv);
  let encrypted = cipher.update(texto, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
};

const desencriptar = (texto) => {
  try {
    const partes = texto.split(':');
    const iv = Buffer.from(partes.shift(), 'hex');
    const contenidoEncrypted = partes.join(':');
    const decipher = crypto.createDecipheriv(ALGORITMO, KEY, iv);
    let decrypted = decipher.update(contenidoEncrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('⚠️ Error desencriptando:', error.message);
    return texto;
  }
};

// ── Anthropic ─────────────────────────────────────────────────────────────────
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── JWT ───────────────────────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_dev_secret_2026';
if (!process.env.JWT_SECRET) {
  console.warn('⚠️ JWT_SECRET no está configurado — usando valor de desarrollo');
}

// ── DB + Associations + Sync ──────────────────────────────────────────────────
connectDB().then(() => {
  // Dentro de connectDB().then(() => {
setupAssociations(sequelize);
sequelize.sync({ alter: true })
  .then(() => console.log('✅ Tablas sincronizadas en PostgreSQL.'))
  .catch(err => console.error('❌ Error sincronizando tablas:', err));
});

// ==========================================
// 🛡️ AUTH
// ==========================================
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const adminEmails = (process.env.ADMIN_EMAILS || '')
      .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
    const role = adminEmails.includes(email.toLowerCase()) ? 'admin' : 'user';
    const hashedPassword = await bcrypt.hash(password, 10);
    await User.create({ name, email, password: hashedPassword, role });
    res.status(201).json({ message: 'Usuario creado exitosamente. ¡Bienvenido a Elevation!' });
  } catch (error) {
    res.status(400).json({ error: 'El correo ya está registrado o hubo un error.' });
  }
});

app.post('/api/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });

    if (!user) {
      await delay(200);
      return res.status(401).json({ error: 'Credenciales incorrectas.' });
    }

    if (user.lockedUntil && new Date() < new Date(user.lockedUntil)) {
      const minutosRestantes = Math.ceil((new Date(user.lockedUntil) - new Date()) / 60000);
      return res.status(423).json({
        error: `Cuenta bloqueada. Intentá de nuevo en ${minutosRestantes} minuto${minutosRestantes > 1 ? 's' : ''}.`,
        locked: true,
      });
    }

    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      const nuevosIntentos = (user.loginAttempts || 0) + 1;
      if (nuevosIntentos >= 3) {
        const bloqueadoHasta = new Date(Date.now() + 15 * 60 * 1000);
        await user.update({ loginAttempts: nuevosIntentos, lockedUntil: bloqueadoHasta });
        return res.status(423).json({ error: 'Cuenta bloqueada por 15 minutos.', locked: true });
      }
      await user.update({ loginAttempts: nuevosIntentos });
      await delay(200);
      return res.status(401).json({ error: 'Credenciales incorrectas.' });
    }

    await user.update({ loginAttempts: 0, lockedUntil: null });
    const token = jwt.sign(
      { id: user.id, name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: '8h' }
    );
    res.json({ message: 'Inicio de sesión exitoso', token, name: user.name, role: user.role });
  } catch (error) {
    console.error('❌ Error en login:', error);
    res.status(500).json({ error: 'Error en el servidor.' });
  }
});

// ==========================================
// 👮 MIDDLEWARES
// ==========================================
const verificarToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(403).json({ error: 'Acceso denegado. No tienes llave.' });
  const token = authHeader.split(' ')[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Llave inválida o expirada.' });
  }
};

const verificarAdmin = (req, res, next) => {
  verificarToken(req, res, () => {
    if (!['admin', 'superadmin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Acceso denegado. Solo administradores.' });
    }
    next();
  });
};

const verificarSuperAdmin = (req, res, next) => {
  verificarToken(req, res, () => {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Acceso exclusivo para superadmin.' });
    }
    next();
  });
};

// ==========================================
// 🧠 CHAT
// ==========================================
app.post('/api/chat', verificarToken, async (req, res) => {
  const mensajeUsuario = req.body.message;
  const userId = req.user.id;
  try {
    const user = await User.findByPk(userId, { attributes: ['therapistId'] });

    let systemPrompt = null;
    if (user?.therapistId) {
      systemPrompt = await getActivePrompt(`therapist_prompt_${user.therapistId}`);
    }
    if (!systemPrompt) systemPrompt = await getActivePrompt('elevation_system_prompt');
    if (!systemPrompt) systemPrompt = 'You are Elevation, an empathetic emotional wellness companion. You listen actively and ask reflective questions. Your responses are concise, warm and you never use emojis.';

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

// ==========================================
// 📜 HISTORIAL DE CHAT
// ==========================================
app.get('/api/messages', verificarToken, async (req, res) => {
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

// ==========================================
// 🔐 ROUTERS
// ==========================================
app.use('/api/admin/usuarios', verificarAdmin, adminUsersRouter);
app.use('/api/sessions', verificarToken, require('./routes/sessions'));
app.use('/api/therapist',      verificarToken, therapistRouter);

// ==========================================
// 🔐 BACKOFFICE — PROMPTS
// ==========================================
app.post('/api/admin/prompt', verificarAdmin, async (req, res) => {
  try {
    const { key, content } = req.body;
    if (!key || !content) return res.status(400).json({ error: 'key y content son requeridos.' });
    await savePrompt(key, content, req.user.name);
    res.json({ message: `Prompt '${key}' guardado y encriptado exitosamente.` });
  } catch (error) {
    console.error('❌ Error guardando prompt:', error);
    res.status(500).json({ error: 'No se pudo guardar el prompt.' });
  }
});

app.get('/api/admin/prompts', verificarAdmin, async (req, res) => {
  try {
    const prompts = await PromptVault.findAll({
      attributes: ['key', 'version', 'isActive', 'updatedBy', 'updatedAt'],
    });
    res.json(prompts);
  } catch (error) {
    res.status(500).json({ error: 'No se pudieron obtener los prompts.' });
  }
});

app.get('/api/admin/prompt/:key', verificarAdmin, async (req, res) => {
  try {
    let prompt = await PromptVault.findOne({
      where: { key: req.params.key, status: 'active' },
      attributes: ['id', 'key', 'version', 'status', 'approved_by', 'approved_at', 'updatedAt'],
    });
    if (!prompt) {
      prompt = await PromptVault.findOne({
        where: { key: req.params.key, isActive: true },
        attributes: ['id', 'key', 'version', 'status', 'approved_by', 'approved_at', 'updatedAt'],
        order: [['version', 'DESC']],
      });
    }
    if (!prompt) return res.status(404).json({ error: 'Prompt no encontrado.' });
    const contenido = await getActivePrompt(req.params.key);
    res.json({ ...prompt.toJSON(), content: contenido });
  } catch (error) {
    console.error('❌ Error obteniendo prompt:', error);
    res.status(500).json({ error: 'Error obteniendo el prompt.' });
  }
});

app.post('/api/admin/prompt/propose', verificarAdmin, async (req, res) => {
  try {
    const { key, content } = req.body;
    if (!key || !content) return res.status(400).json({ error: 'key y content son requeridos.' });
    await proposePrompt(key, content, req.user.name);
    res.json({ message: 'Propuesta enviada al superadmin para revisión.' });
  } catch (error) {
    console.error('❌ Error proponiendo prompt:', error);
    res.status(500).json({ error: 'No se pudo enviar la propuesta.' });
  }
});

app.get('/api/superadmin/prompt/:key/versions', verificarSuperAdmin, async (req, res) => {
  try {
    const versiones = await PromptVault.findAll({
      where: { key: req.params.key },
      attributes: ['id', 'key', 'version', 'status', 'proposed_by', 'approved_by', 'rejected_by', 'rejection_note', 'approved_at', 'rejected_at', 'updatedAt'],
      order: [['version', 'DESC']],
    });
    res.json(versiones);
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo versiones.' });
  }
});

app.post('/api/superadmin/prompt/:id/approve', verificarSuperAdmin, async (req, res) => {
  try {
    await approvePrompt(req.params.id, req.user.name);
    res.json({ message: 'Versión aprobada y activa en producción.' });
  } catch (error) {
    console.error('❌ Error aprobando prompt:', error);
    res.status(500).json({ error: error.message || 'No se pudo aprobar la versión.' });
  }
});

app.post('/api/superadmin/prompt/:id/reject', verificarSuperAdmin, async (req, res) => {
  try {
    const { note } = req.body;
    await rejectPrompt(req.params.id, req.user.name, note || '');
    res.json({ message: 'Versión rechazada.' });
  } catch (error) {
    console.error('❌ Error rechazando prompt:', error);
    res.status(500).json({ error: error.message || 'No se pudo rechazar la versión.' });
  }
});

app.post('/api/superadmin/prompt/:id/rollback', verificarSuperAdmin, async (req, res) => {
  try {
    await rollbackPrompt(req.params.id, req.user.name);
    res.json({ message: 'Rollback exitoso. Versión anterior activa en producción.' });
  } catch (error) {
    console.error('❌ Error en rollback:', error);
    res.status(500).json({ error: error.message || 'No se pudo hacer rollback.' });
  }
});

// ==========================================
// 🌐 LANDING CONTENT
// ==========================================
const LANDING_DEFAULTS = {
  es: {
    hero_title:         'Encuentra tu calma interior',
    hero_subtitle:      'Tu compañero privado para la claridad mental y el bienestar emocional.',
    cta_primary:        'Iniciar conversación',
    cta_final_title:    '¿Listo para empezar?',
    cta_final_subtitle: 'Sin tarjeta de crédito.',
  },
  en: {
    hero_title:         'Find your inner calm',
    hero_subtitle:      'Your private companion for mental clarity and emotional wellbeing.',
    cta_primary:        'Start a conversation',
    cta_final_title:    'Ready to begin?',
    cta_final_subtitle: 'No credit card required.',
  },
};

app.get('/api/landing-content', async (req, res) => {
  try {
    const lang = req.query.lang === 'en' ? 'en' : 'es';
    const registros = await LandingContent.findAll({ where: { lang } });
    const content = { ...LANDING_DEFAULTS[lang] };
    registros.forEach(r => { content[r.key] = r.value; });
    res.json(content);
  } catch (error) {
    console.error('❌ Error obteniendo contenido landing:', error);
    const lang = req.query.lang === 'en' ? 'en' : 'es';
    res.json(LANDING_DEFAULTS[lang]);
  }
});

app.put('/api/landing-content', verificarSuperAdmin, async (req, res) => {
  try {
    const { key, lang, value } = req.body;
    if (!key || !lang || !value) return res.status(400).json({ error: 'key, lang y value son requeridos.' });
    if (!['es', 'en'].includes(lang)) return res.status(400).json({ error: 'lang debe ser es o en.' });
    await LandingContent.upsert({ key, lang, value, updated_by: req.user.name });
    res.json({ message: `Contenido '${key}' (${lang}) actualizado correctamente.` });
  } catch (error) {
    console.error('❌ Error actualizando contenido landing:', error);
    res.status(500).json({ error: 'No se pudo actualizar el contenido.' });
  }
});

// ==========================================
// 😊 MOOD LOGS
// ==========================================
app.post('/api/mood/checkin', verificarToken, async (req, res) => {
  try {
    const { mood } = req.body;
    const today = new Date().toISOString().split('T')[0];
    const [log] = await MoodLog.upsert({ UserId: req.user.id, date: today, checkin_mood: mood });
    res.json({ message: 'Check-in registrado.', log });
  } catch (error) {
    console.error('❌ Error en mood checkin:', error);
    res.status(500).json({ error: 'No se pudo registrar el check-in.' });
  }
});

app.post('/api/mood/checkout', verificarToken, async (req, res) => {
  try {
    const { mood } = req.body;
    const today = new Date().toISOString().split('T')[0];
    const [log] = await MoodLog.upsert({ UserId: req.user.id, date: today, checkout_mood: mood });
    res.json({ message: 'Check-out registrado.', log });
  } catch (error) {
    console.error('❌ Error en mood checkout:', error);
    res.status(500).json({ error: 'No se pudo registrar el check-out.' });
  }
});

app.get('/api/mood/history', verificarToken, async (req, res) => {
  try {
    const logs = await MoodLog.findAll({
      where: { UserId: req.user.id },
      order: [['date', 'DESC']],
      limit: 30,
    });
    res.json(logs);
  } catch (error) {
    console.error('❌ Error obteniendo historial mood:', error);
    res.status(500).json({ error: 'No se pudo obtener el historial.' });
  }
});

// ==========================================
// ⭐ RATINGS
// ==========================================
app.post('/api/rating', verificarToken, async (req, res) => {
  try {
    const { rating } = req.body;
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating debe ser entre 1 y 5.' });
    const today = new Date().toISOString().split('T')[0];
    await SessionRating.create({ UserId: req.user.id, rating, date: today });
    res.json({ message: 'Calificación guardada.' });
  } catch (error) {
    console.error('❌ Error guardando rating:', error);
    res.status(500).json({ error: 'No se pudo guardar la calificación.' });
  }
});

app.get('/api/rating/avg', verificarAdmin, async (req, res) => {
  try {
    const ratings = await SessionRating.findAll({ attributes: ['rating'] });
    if (ratings.length === 0) return res.json({ avg: 0, total: 0 });
    const sum = ratings.reduce((acc, r) => acc + r.rating, 0);
    const avg = Math.round((sum / ratings.length) * 10) / 10;
    res.json({ avg, total: ratings.length });
  } catch (error) {
    console.error('❌ Error obteniendo promedio:', error);
    res.status(500).json({ error: 'No se pudo obtener el promedio.' });
  }
});

// ==========================================
// ✨ WELLNESS RECOMMENDATIONS
// ==========================================
app.post('/api/recommendations/generate', verificarToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const moodLogs = await MoodLog.findAll({
      where: { UserId: userId },
      order: [['date', 'DESC']],
      limit: 7,
    });

    const avgMood = moodLogs.length > 0
      ? (moodLogs.flatMap(m => [m.checkin_mood, m.checkout_mood]).filter(Boolean)
          .reduce((a, b) => a + b, 0) / moodLogs.length).toFixed(1)
      : null;

    const trend = moodLogs.length >= 2
      ? (moodLogs[0].checkin_mood ?? 3) >= (moodLogs[moodLogs.length - 1].checkin_mood ?? 3)
        ? 'improving' : 'declining'
      : 'stable';

    const prompt = `You are a wellness coach for Elevation, a mental health platform.
Based on this user's recent emotional data:
- Sessions in last 7 days: ${moodLogs.length}
- Average mood (1-5 scale): ${avgMood ?? 'No data yet'}
- Recent trend: ${trend}
Generate exactly 3 personalized wellness recommendations. Respond ONLY with a valid JSON array, no markdown, no extra text:
[
  { "category": "mindfulness", "content": "..." },
  { "category": "habit", "content": "..." },
  { "category": "reflection", "content": "..." }
]
Categories must be one of: mindfulness, habit, reflection, resource.
Each content must be 1-2 sentences, warm, actionable and specific to the user's emotional state.
Never mention diagnoses or medical advice.`;

    const msg = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    });

    let recommendations = [];
    try {
      const raw = msg.content[0].text.replace(/```json|```/g, '').trim();
      recommendations = JSON.parse(raw);
    } catch {
      return res.status(500).json({ error: 'Could not parse recommendations.' });
    }

    const saved = await Promise.all(
      recommendations.map(r =>
        WellnessRecommendation.create({
          UserId: userId,
          content: encriptar(r.content),
          category: r.category,
          generatedAt: new Date(),
        })
      )
    );

    res.json(saved.map((r, i) => ({
      id: r.id,
      category: r.category,
      content: recommendations[i].content,
      generatedAt: r.generatedAt,
      seenByUser: r.seenByUser,
    })));
  } catch (error) {
    console.error('❌ Error generating recommendations:', error);
    res.status(500).json({ error: 'Could not generate recommendations.' });
  }
});

app.get('/api/recommendations', verificarToken, async (req, res) => {
  try {
    const recs = await WellnessRecommendation.findAll({
      where: { UserId: req.user.id },
      order: [['generatedAt', 'DESC']],
      limit: 9,
    });
    res.json(recs.map(r => ({
      id: r.id,
      category: r.category,
      content: desencriptar(r.content),
      generatedAt: r.generatedAt,
      seenByUser: r.seenByUser,
    })));
  } catch (error) {
    console.error('❌ Error fetching recommendations:', error);
    res.status(500).json({ error: 'Could not fetch recommendations.' });
  }
});

app.put('/api/recommendations/:id/seen', verificarToken, async (req, res) => {
  try {
    const rec = await WellnessRecommendation.findOne({
      where: { id: req.params.id, UserId: req.user.id },
    });
    if (!rec) return res.status(404).json({ error: 'Recommendation not found.' });
    await rec.update({ seenByUser: true });
    res.json({ message: 'Marked as seen.' });
  } catch (error) {
    res.status(500).json({ error: 'Could not update recommendation.' });
  }
});

// ==========================================
// 📊 USER PROGRESS
// ==========================================
app.get('/api/user/progress', verificarToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const moodLogs = await MoodLog.findAll({ where: { UserId: userId }, order: [['date', 'DESC']], limit: 30 });
    const ratings  = await SessionRating.findAll({ where: { UserId: userId }, order: [['date', 'DESC']], limit: 30 });
    const recommendations = await WellnessRecommendation.findAll({
      where: { UserId: userId }, order: [['generatedAt', 'DESC']], limit: 5,
    });

    const allMoods = moodLogs.flatMap(m => [m.checkin_mood, m.checkout_mood]).filter(Boolean);
    const avgMood  = allMoods.length > 0
      ? Math.round((allMoods.reduce((a, b) => a + b, 0) / allMoods.length) * 10) / 10 : null;
    const avgRating = ratings.length > 0
      ? Math.round((ratings.reduce((a, r) => a + r.rating, 0) / ratings.length) * 10) / 10 : null;

    let streak = 0;
    const logDates = [...new Set(moodLogs.map(m => m.date))].sort().reverse();
    for (let i = 0; i < logDates.length; i++) {
      const expected = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
      if (logDates[i] === expected) streak++;
      else break;
    }

    res.json({
      stats: { totalSessions: moodLogs.length, avgMood, avgRating, streak },
      moodLogs,
      ratings,
      recommendations: recommendations.map(r => ({
        id: r.id, category: r.category,
        content: desencriptar(r.content),
        generatedAt: r.generatedAt, seenByUser: r.seenByUser,
      })),
    });
  } catch (error) {
    console.error('❌ Error fetching user progress:', error);
    res.status(500).json({ error: 'Could not fetch progress.' });
  }
});

// ==========================================
// 📊 ADMIN METRICS
// ==========================================
app.get('/api/admin/metrics', verificarAdmin, async (req, res) => {
  try {
    const { Op } = require('sequelize');
    const totalUsers     = await User.count({ where: { role: 'user' } });
    const activeUsers    = await User.count({ where: { role: 'user', active: true } });
    const totalTherapists = await User.count({ where: { role: 'therapist', active: true } });
    const totalSessions  = await MoodLog.count();

    const allMoods   = await MoodLog.findAll({ attributes: ['checkin_mood', 'checkout_mood'] });
    const moodValues = allMoods.flatMap(m => [m.checkin_mood, m.checkout_mood]).filter(Boolean);
    const avgMood    = moodValues.length > 0
      ? Math.round((moodValues.reduce((a, b) => a + b, 0) / moodValues.length) * 10) / 10 : null;

    const allRatings = await SessionRating.findAll({ attributes: ['rating'] });
    const avgRating  = allRatings.length > 0
      ? Math.round((allRatings.reduce((a, r) => a + r.rating, 0) / allRatings.length) * 10) / 10 : null;

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const activeThisWeek = await MoodLog.count({
      where: { date: { [Op.gte]: weekAgo.toISOString().split('T')[0] } },
      distinct: true, col: 'UserId',
    });

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sessionsByDay = await MoodLog.findAll({
      where: { date: { [Op.gte]: thirtyDaysAgo.toISOString().split('T')[0] } },
      attributes: ['date', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['date'],
      order: [['date', 'ASC']],
    });

    const therapists = await User.findAll({
      where: { role: 'therapist', active: true },
      attributes: ['id', 'name', 'email'],
    });

    const topTherapists = await Promise.all(therapists.map(async (th) => {
      const patientCount = await User.count({ where: { therapistId: th.id, role: 'user' } });
      const patientIds   = await User.findAll({ where: { therapistId: th.id, role: 'user' }, attributes: ['id'] });
      const ids          = patientIds.map(p => p.id);
      const ratings      = ids.length > 0
        ? await SessionRating.findAll({ where: { UserId: ids }, attributes: ['rating'] }) : [];
      const avgThRating  = ratings.length > 0
        ? Math.round((ratings.reduce((a, r) => a + r.rating, 0) / ratings.length) * 10) / 10 : null;
      return { id: th.id, name: th.name, patientCount, avgRating: avgThRating };
    }));

    topTherapists.sort((a, b) => b.patientCount - a.patientCount);

    res.json({
      totalUsers, activeUsers, totalTherapists, totalSessions, avgMood, avgRating, activeThisWeek,
      sessionsByDay: sessionsByDay.map(s => ({ date: s.date, count: parseInt(s.dataValues.count) })),
      topTherapists: topTherapists.slice(0, 5),
    });
  } catch (error) {
    console.error('❌ Error fetching metrics:', error);
    res.status(500).json({ error: 'Could not fetch metrics.' });
  }
});

// ==========================================
// 🤝 MATCHING
// ==========================================
app.get('/api/therapist/profile', verificarToken, async (req, res) => {
  try {
    if (req.user.role !== 'therapist') return res.status(403).json({ error: 'Therapists only.' });
    let profile = await TherapistProfile.findOne({ where: { UserId: req.user.id } });
    if (!profile) profile = await TherapistProfile.create({ UserId: req.user.id });
    res.json(profile);
  } catch (error) {
    res.status(500).json({ error: 'Could not fetch profile.' });
  }
});

app.put('/api/therapist/profile', verificarToken, async (req, res) => {
  try {
    if (req.user.role !== 'therapist') return res.status(403).json({ error: 'Therapists only.' });
    const { specialties, approach, languages, bio, maxPatients, acceptingNew } = req.body;
    let profile = await TherapistProfile.findOne({ where: { UserId: req.user.id } });
    if (!profile) profile = await TherapistProfile.create({ UserId: req.user.id });
    await profile.update({ specialties, approach, languages, bio, maxPatients, acceptingNew });
    res.json({ message: 'Profile updated.', profile });
  } catch (error) {
    res.status(500).json({ error: 'Could not update profile.' });
  }
});

app.post('/api/matching/request', verificarToken, async (req, res) => {
  try {
    const userId = req.user.id;
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

    const moodLogs = await MoodLog.findAll({ where: { UserId: userId }, order: [['date', 'DESC']], limit: 14 });
    const avgMood  = moodLogs.length > 0
      ? (moodLogs.flatMap(m => [m.checkin_mood, m.checkout_mood]).filter(Boolean)
          .reduce((a, b) => a + b, 0) / moodLogs.length).toFixed(1)
      : 'No data';

    const therapistList = availableTherapists.map(t => ({
      id: t.id, name: t.name,
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

    const request = await MatchingRequest.create({ UserId: userId, answers, suggestions, status: 'pending' });

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

app.post('/api/matching/choose', verificarToken, async (req, res) => {
  try {
    const { requestId, therapistId } = req.body;
    const request = await MatchingRequest.findOne({ where: { id: requestId, UserId: req.user.id } });
    if (!request) return res.status(404).json({ error: 'Request not found.' });
    await request.update({ chosenTherapistId: therapistId, status: 'pending' });
    res.json({ message: 'Therapist chosen. Waiting for admin confirmation.' });
  } catch (error) {
    res.status(500).json({ error: 'Could not save choice.' });
  }
});

app.get('/api/admin/matching/pending', verificarAdmin, async (req, res) => {
  try {
    const { Op } = require('sequelize');
    const requests = await MatchingRequest.findAll({
      where: { status: 'pending', chosenTherapistId: { [Op.ne]: null } },
      order: [['createdAt', 'DESC']],
    });
    const enriched = await Promise.all(requests.map(async r => {
      const user      = await User.findByPk(r.UserId,            { attributes: ['id', 'name', 'email'] });
      const therapist = await User.findByPk(r.chosenTherapistId, { attributes: ['id', 'name'] });
      return { id: r.id, user: user?.toJSON(), chosenTherapist: therapist?.toJSON(), answers: r.answers, createdAt: r.createdAt };
    }));
    res.json(enriched);
  } catch (error) {
    res.status(500).json({ error: 'Could not fetch pending requests.' });
  }
});

app.post('/api/admin/matching/:id/confirm', verificarAdmin, async (req, res) => {
  try {
    const request = await MatchingRequest.findByPk(req.params.id);
    if (!request) return res.status(404).json({ error: 'Request not found.' });
    if (!request.chosenTherapistId) return res.status(400).json({ error: 'No therapist chosen yet.' });
    await User.update({ therapistId: request.chosenTherapistId }, { where: { id: request.UserId } });
    await request.update({ status: 'confirmed' });
    res.json({ message: 'Therapist assigned successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Could not confirm assignment.' });
  }
});

// ==========================================
// 🌐 FRONTEND
// ==========================================
const path = require('path');
app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist', 'index.html'));
});

// ==========================================
// 🚀 SERVIDOR
// ==========================================
const PORT = process.env.PORT || 8080;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Elevation está en el aire en el puerto ${PORT}`);
});

server.keepAliveTimeout = 65000;
server.headersTimeout   = 66000;

module.exports = app;