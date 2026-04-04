# DT-006 — Refactorización server.js

> Estado: LISTO PARA EJECUTAR
> Sprint: 8
> Responsable: Mauro Roldán + Claude (Tech Lead AI)
> Documentado: 4 de abril de 2026

---

## Objetivo

Convertir `backend/server.js` (~500 líneas, monolítico) en un archivo de bootstrap puro (~60 líneas).
Eliminar todo el código duplicado en los routers existentes.
Resultado: arquitectura limpia, sin lógica de negocio repetida en ningún lugar.

---

## Diagnóstico completo — Código duplicado encontrado

### 1. Funciones de encriptación (crypto)

| Archivo | Funciones | Estado |
|---|---|---|
| `server.js` | `encriptar`, `desencriptar` | Fuente original — se mueve a `utils/crypto.js` |
| `backend/routes/sessions.js` | `encriptar`, `desencriptar` | **DUPLICADO** — se elimina, se importa desde utils |
| `backend/routes/therapistRoutes.js` | `encrypt`, `decrypt` (mismo código, nombres en inglés) | **DUPLICADO** — se elimina, se importa desde utils |
| `backend/routes/adminUsers.js` | — | ✅ Limpio |

### 2. Cliente Anthropic

| Archivo | Instancia | Estado |
|---|---|---|
| `server.js` | `new Anthropic({ apiKey: ... })` | Fuente original — se mueve a `utils/anthropic.js` |
| `backend/routes/therapistRoutes.js` | `new Anthropic({ apiKey: ... })` | **DUPLICADO** — se elimina, se importa desde utils |
| `backend/routes/sessions.js` | — | ✅ Limpio |
| `backend/routes/adminUsers.js` | — | ✅ Limpio |

### 3. Middlewares JWT

| Archivo | Estado |
|---|---|
| `server.js` | `verificarToken`, `verificarAdmin`, `verificarSuperAdmin` — se mueven a `middlewares/auth.js` |
| Todos los routers | No tienen middlewares propios — los reciben aplicados en el montaje desde server.js ✅ |

---

## Estructura de archivos a crear

```
backend/
  middlewares/
    auth.js              ← verificarToken, verificarAdmin, verificarSuperAdmin
  utils/
    crypto.js            ← encriptar, desencriptar (AES-256-CBC, exportadas)
    anthropic.js         ← cliente Anthropic singleton, exportado
  routes/
    auth.js              ← POST /api/register, POST /api/login + loginLimiter
    chat.js              ← POST /api/chat, GET /api/messages
    mood.js              ← POST /api/mood/checkin, /checkout, GET /api/mood/history
    ratings.js           ← POST /api/rating, GET /api/rating/avg
    recommendations.js   ← POST /api/recommendations/generate, GET /api/recommendations, PUT /:id/seen
    progress.js          ← GET /api/user/progress, PUT /api/user/onboarding-complete
    matching.js          ← rutas user + rutas admin (matching)
    landingContent.js    ← GET /api/landing-content, PUT /api/landing-content
    adminMetrics.js      ← GET /api/admin/metrics
    adminPrompts.js      ← todos los endpoints de /api/admin/prompt* y /api/superadmin/prompt*
```

---

## Reglas de refactorización (no negociables)

1. **Sin cambios en endpoints** — mismas rutas, mismos métodos HTTP, mismos status codes, misma estructura de respuesta
2. **Sin lógica de negocio en server.js** — solo imports, cors, middlewares, montaje de routers, puerto
3. **utils/crypto.js es la única fuente de verdad** para encriptar/desencriptar — ningún router lo implementa por su cuenta
4. **utils/anthropic.js es la única instancia de Anthropic** — singleton exportado, todos los routers que lo necesitan lo importan
5. **middlewares/auth.js es la única fuente de verdad** para los middlewares JWT
6. Los middlewares se aplican en `server.js` al montar la ruta, no dentro de los routers
7. `sessions.js` y `therapistRoutes.js` se actualizan para eliminar sus duplicados — no se cambia ninguna lógica de negocio, solo los imports

---

## Orden de ejecución (router por router, validar antes de continuar)

### Paso 0 — Crear los 3 utils base
Estos no rompen nada — son archivos nuevos que nadie usa todavía.

```
backend/middlewares/auth.js    ← extraer de server.js
backend/utils/crypto.js        ← extraer de server.js
backend/utils/anthropic.js     ← extraer de server.js
```

### Paso 1 — Actualizar routers existentes para usar los utils
Eliminar código duplicado en los routers que ya existen.

```
backend/routes/sessions.js       ← reemplazar encriptar/desencriptar propias por import de utils/crypto.js
backend/routes/therapistRoutes.js ← reemplazar encrypt/decrypt + new Anthropic() propios por imports de utils/
```

**Validar:** Probar endpoints de sessions y therapist antes de continuar.

### Paso 2 — Crear nuevos routers (uno por uno)

Orden recomendado por riesgo (menor a mayor):

1. `landingContent.js` — sin auth, más fácil de probar
2. `mood.js` — lógica simple, solo DB
3. `ratings.js` — lógica simple, solo DB
4. `progress.js` — lógica simple, solo DB
5. `auth.js` — crítico (login), probar muy bien
6. `chat.js` — usa Anthropic
7. `recommendations.js` — usa Anthropic
8. `adminMetrics.js` — solo lectura admin
9. `adminPrompts.js` — el más complejo del backoffice
10. `matching.js` — el más largo (~100 líneas, usa Anthropic)

### Paso 3 — Reescribir server.js como bootstrap puro

Una vez que todos los routers están creados y validados.

---

## server.js final — Estructura objetivo

```js
require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const { connectDB, sequelize } = require('./database');
const setupAssociations        = require('./associations');

const { verificarToken, verificarAdmin, verificarSuperAdmin } = require('./middlewares/auth');

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  optionsSuccessStatus: 200,
}));
app.use(express.json());

// DB
connectDB().then(() => {
  setupAssociations(sequelize);
  sequelize.sync({ alter: true })
    .then(() => console.log('✅ Tablas sincronizadas en PostgreSQL.'))
    .catch(err => console.error('❌ Error sincronizando tablas:', err));
});

// Rutas públicas
app.use('/api',              require('./routes/auth'));
app.use('/api/landing-content', require('./routes/landingContent'));

// Rutas usuario
app.use('/api',                   verificarToken, require('./routes/chat'));
app.use('/api/mood',              verificarToken, require('./routes/mood'));
app.use('/api',                   verificarToken, require('./routes/ratings'));
app.use('/api/recommendations',   verificarToken, require('./routes/recommendations'));
app.use('/api/user',              verificarToken, require('./routes/progress'));
app.use('/api/matching',          verificarToken, require('./routes/matching'));
app.use('/api/sessions',          verificarToken, require('./routes/sessions'));
app.use('/api/therapist',         verificarToken, require('./routes/therapistRoutes'));

// Rutas admin
app.use('/api/admin/usuarios',    verificarAdmin, require('./routes/adminUsers'));
app.use('/api/admin/metrics',     verificarAdmin, require('./routes/adminMetrics'));  // nota: ruta correcta sin /api/ duplicado
app.use('/api/admin',             verificarAdmin, require('./routes/adminPrompts'));
app.use('/api/superadmin',        verificarSuperAdmin, require('./routes/adminPrompts'));
app.use('/api/admin/matching',    verificarAdmin, require('./routes/matching'));

// Frontend estático
const path = require('path');
app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist', 'index.html'));
});

const PORT = process.env.PORT || 8080;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Elevation está en el aire en el puerto ${PORT}`);
});
server.keepAliveTimeout = 65000;
server.headersTimeout   = 66000;

module.exports = app;
```

---

## Checklist de validación post-refactor

Probar en local antes de hacer push a `feature/mvp-elevation`:

- [ ] `POST /api/login` — retorna token y rol
- [ ] `POST /api/register` — crea usuario
- [ ] `GET /api/landing-content` — retorna contenido
- [ ] `POST /api/mood/checkin` — registra check-in
- [ ] `POST /api/chat` — responde con IA
- [ ] `GET /api/admin/metrics` — retorna métricas
- [ ] `GET /api/admin/prompts` — lista prompts
- [ ] `GET /api/therapist/pacientes` — lista pacientes
- [ ] `GET /api/sessions/therapist` — lista sesiones
- [ ] `POST /api/matching/request` — genera sugerencias IA

---

*Documentado: 4 de abril de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
