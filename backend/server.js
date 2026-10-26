// backend/server.js
require('dotenv').config();
require('./config/jwt'); // Fail before database initialization or opening a port.
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const helmet  = require('helmet');

const { connectDB, sequelize } = require('./database');
const setupAssociations        = require('./associations');
const syncOptions              = require('./utils/syncOptions');

const {
  verificarToken,
  verificarAdmin,
  verificarSuperAdmin,
  verificarBoard,
  verificarTerapeuta,
} = require('./middlewares/auth');

const app = express();
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      // Existing React styles and Google Fonts; scripts remain same-origin only.
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https://images.unsplash.com'],
      connectSrc: ["'self'"],
      frameSrc: ["'self'", 'https://*.daily.co'],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
    },
  },
  xFrameOptions: { action: 'deny' },
  referrerPolicy: { policy: 'no-referrer' },
}));

// Detrás de un proxy (Railway) define TRUST_PROXY_HOPS=1; por defecto no se confía en X-Forwarded-For (evita falsear la IP del rate limit)
app.set('trust proxy', parseInt(process.env.TRUST_PROXY_HOPS, 10) || false);

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  optionsSuccessStatus: 200,
}));
app.use(express.json());

// Salud para el healthcheck de Railway (sin base de datos ni auth)
// commit: SHA corto del despliegue (lo inyecta Railway); permite comprobar qué versión corre tras un despliegue o una reversión
app.get('/api/health', (req, res) => {
  const commit = (process.env.RAILWAY_GIT_COMMIT_SHA || '').slice(0, 7);
  res.json(commit ? { status: 'ok', commit } : { status: 'ok' });
});

// ── Base de datos ─────────────────────────────────────────────────────────────
connectDB().then(() => {
  setupAssociations(sequelize);
  // `alter` solo con DB_SYNC_ALTER=true; por defecto solo crea las tablas que falten (migraciones: ES-59)
  sequelize.sync(syncOptions())
    .then(() => console.log('✅ Tablas sincronizadas en PostgreSQL.'))
    .catch(err => console.error('❌ Error sincronizando tablas:', err));
});

// ── Rutas públicas ────────────────────────────────────────────────────────────
app.use('/api',                 require('./routes/auth'));
app.use('/api/landing-content', require('./routes/landingContent'));
app.use('/api/pricing',         require('./routes/pricing'));
app.use('/api/plans',           require('./routes/plans'));           // HU-077 — lista pública de planes

// Manifest active version — consumed internally by chat.js (no auth required)
app.use('/api/manifest',        require('./routes/board'));

// ── Rutas usuario ─────────────────────────────────────────────────────────────
app.use('/api',                 verificarToken, require('./routes/chat'));
app.use('/api',                 verificarToken, require('./routes/session'));        // ES-18 — logout y logout-all
app.use('/api/consents',        verificarToken, require('./routes/consents'));       // ES-19 — consentimiento por propósito
app.use('/api/mood',            verificarToken, require('./routes/mood'));
app.use('/api',                 verificarToken, require('./routes/ratings'));
app.use('/api/recommendations', verificarToken, require('./routes/recommendations'));
app.use('/api/user',            verificarToken, require('./routes/progress'));
app.use('/api/user/plan',       verificarToken, require('./routes/plans'));          // HU-077 — plan del usuario
app.use('/api/plan-requests',   verificarToken, require('./routes/planRequests'));   // HU-077 — solicitudes usuario
app.use('/api/matching',        verificarToken, require('./routes/matching'));
app.use('/api/sessions',        verificarToken, require('./routes/sessions'));
app.use('/api/therapist/validation', verificarToken, require('./routes/validation'));
app.use('/api/therapist',       verificarTerapeuta, require('./routes/therapistRoutes'));

// ── Rutas admin ───────────────────────────────────────────────────────────────
app.use('/api/admin/usuarios',      verificarAdmin, require('./routes/adminUsers'));
app.use('/api/admin/metrics',       verificarAdmin, require('./routes/adminMetrics'));
app.use('/api/admin/matching',      verificarAdmin, require('./routes/matching'));
app.use('/api/admin/pricing',       verificarAdmin, require('./routes/pricing'));
app.use('/api/admin/plan-requests', verificarAdmin, require('./routes/planRequests')); // HU-077 — solicitudes admin

// adminPrompts maneja tanto rutas /admin como /superadmin internamente
const adminPromptsRouter = require('./routes/adminPrompts');
app.use('/api/admin',      verificarAdmin,      adminPromptsRouter);
app.use('/api/superadmin', verificarSuperAdmin, adminPromptsRouter);

// ── Rutas board (Ethics Board) ────────────────────────────────────────────────
app.use('/api/board',      verificarBoard,      require('./routes/board'));
app.use('/api/junta',      verificarSuperAdmin, require('./routes/validation'));

// ── Frontend estático ─────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist', 'index.html'));
});

// ── Servidor ──────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 8080;
// En Vercel (api/index.js) la app se exporta sin escuchar; el puerto solo se abre con `node server.js`.
if (require.main === module) {
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Elevation está en el aire en el puerto ${PORT}`);
  });

  server.keepAliveTimeout = 65000;
  server.headersTimeout   = 66000;
}

module.exports = app;
