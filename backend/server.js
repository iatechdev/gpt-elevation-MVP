// backend/server.js
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const { connectDB, sequelize } = require('./database');
const setupAssociations        = require('./associations');

const {
  verificarToken,
  verificarAdmin,
  verificarSuperAdmin,
  verificarBoard,
} = require('./middlewares/auth');

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  optionsSuccessStatus: 200,
}));
app.use(express.json());

// ── Base de datos ─────────────────────────────────────────────────────────────
connectDB().then(() => {
  setupAssociations(sequelize);
  sequelize.sync({ alter: true })
    .then(() => console.log('✅ Tablas sincronizadas en PostgreSQL.'))
    .catch(err => console.error('❌ Error sincronizando tablas:', err));
});

// ── Rutas públicas ────────────────────────────────────────────────────────────
app.use('/api',                 require('./routes/auth'));
app.use('/api/landing-content', require('./routes/landingContent'));
app.use('/api/pricing',         require('./routes/pricing'));

// Manifest active version — consumed internally by chat.js (no auth required)
app.use('/api/manifest',        require('./routes/board'));

// ── Rutas usuario ─────────────────────────────────────────────────────────────
app.use('/api',                 verificarToken, require('./routes/chat'));
app.use('/api/mood',            verificarToken, require('./routes/mood'));
app.use('/api',                 verificarToken, require('./routes/ratings'));
app.use('/api/recommendations', verificarToken, require('./routes/recommendations'));
app.use('/api/user',            verificarToken, require('./routes/progress'));
app.use('/api/matching',        verificarToken, require('./routes/matching'));
app.use('/api/sessions',        verificarToken, require('./routes/sessions'));
app.use('/api/therapist',       verificarToken, require('./routes/therapistRoutes'));
app.use('/api/therapist/validation', verificarToken, require('./routes/validation'));

// ── Rutas admin ───────────────────────────────────────────────────────────────
app.use('/api/admin/usuarios',  verificarAdmin,      require('./routes/adminUsers'));
app.use('/api/admin/metrics',   verificarAdmin,      require('./routes/adminMetrics'));
app.use('/api/admin/matching',  verificarAdmin,      require('./routes/matching'));
app.use('/api/admin/pricing',   verificarAdmin,      require('./routes/pricing'));

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
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Elevation está en el aire en el puerto ${PORT}`);
});

server.keepAliveTimeout = 65000;
server.headersTimeout   = 66000;

module.exports = app;