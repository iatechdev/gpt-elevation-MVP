# Elevation — Contexto del proyecto para Claude Code

## ¿Qué es Elevation?
Aplicación web de apoyo emocional con IA. Permite a los usuarios hacer check-in emocional, chatear con una IA empática (Elevation), y hacer check-out al finalizar. Incluye calificación de sesiones, landing pública y panel de administración.

## Stack técnico
- **Frontend:** React + TypeScript + Vite — `frontend/`
- **Backend:** Express.js + Sequelize + PostgreSQL — `backend/`
- **IA:** Claude claude-3-haiku-20240307 (Anthropic SDK)
- **Deploy:** Google Cloud Run — proyecto `elevation-490611`
- **URL producción:** https://elevation-ia-747531656650.us-central1.run.app

## Estructura del repositorio
```
gpt-elevation-MVP/
├── backend/
│   ├── server.js          ← Servidor principal Express
│   ├── database.js        ← Conexión PostgreSQL
│   ├── User.js            ← Modelo usuarios
│   ├── Message.js         ← Modelo mensajes chat
│   ├── MoodLog.js         ← Modelo check-in/check-out emocional
│   ├── SessionRating.js   ← Modelo calificación estrellas
│   ├── LandingContent.js  ← Modelo contenido landing editable
│   ├── promptVault.js     ← Sistema de versionado de prompts
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.tsx                    ← Router principal
│   │   ├── main.tsx                   ← Entry point
│   │   ├── pages/
│   │   │   ├── LandingPage.tsx        ← Landing pública /
│   │   │   ├── LoginPage.tsx          ← Login /login
│   │   │   ├── CheckinPage.tsx        ← Check-in /app/checkin
│   │   │   ├── ChatPage.tsx           ← Chat + panel admin /app/chat
│   │   │   └── PricingPage.tsx        ← Precios /precios /pricing
│   │   ├── components/
│   │   │   ├── BreathingBackground.tsx ← Fondo animado Canvas API
│   │   │   ├── ProtectedRoute.tsx      ← Guard JWT
│   │   │   └── AdminRoute.tsx          ← Guard admin/superadmin
│   │   └── i18n/
│   │       ├── context.tsx             ← LanguageContext
│   │       ├── LanguageProvider.tsx    ← Provider ES/EN
│   │       ├── useLanguage.ts          ← Hook
│   │       ├── es.ts                   ← Textos español
│   │       └── en.ts                   ← Textos inglés
│   └── package.json
├── docs/hu-tecnicas/      ← Documentación técnica (rama main)
├── Dockerfile
└── CLAUDE.md              ← Este archivo
```

## Ramas de trabajo
- `feature/mvp-elevation` — rama de desarrollo activa (TODO el código)
- `main` — solo documentación técnica en `docs/hu-tecnicas/`

## Reglas de trabajo
1. Trabajar archivo por archivo, paso a paso
2. Nunca hacer push ni commits sin aprobación explícita de Mauro Roldán
3. Documentación técnica siempre en `docs/hu-tecnicas/` rama `main`
4. Instalar nuevas dependencias con `--legacy-peer-deps` (conflicto conocido DT-001)
5. No agregar librerías de animación — usar CSS puro + Canvas API

## Design System — Filosofía Muji
- **Fondo:** `#f9f9f7` (warm white)
- **Olive primary:** `#6B7D5C`
- **Sage secondary:** `#A8B5A2`
- **Text primary:** `#1C1917`
- **Text secondary:** `#78716C`
- **Accent teal:** `#0d9488` (mensajes IA, acentos)
- **Tipografía:** Inter (cuerpo), Playfair Display (títulos), Noto Serif (chat IA)
- **Principio:** sin sombras fuertes, sin gradientes agresivos, espaciado generoso

## Comandos útiles
```bash
# Arrancar backend
cd backend && node server.js

# Arrancar frontend
cd frontend && npm run dev

# Build producción
cd frontend && npm run build

# Instalar dependencias frontend
cd frontend && npm install --legacy-peer-deps

# Deploy Cloud Run
gcloud run deploy elevation-ia --source . --region us-central1 --allow-unauthenticated
```

## Estado actual — Sprint 3 CERRADO (36/36 puntos)
Todas las HUs del Sprint 3 completadas:
- ✅ HU-036 Landing pública estilo Muji
- ✅ HU-037 Refactor rutas React Router v6
- ✅ HU-038 SEC-001 mensaje genérico login + rate limiting
- ✅ HU-039 Gestión contenido landing desde backoffice
- ✅ HU-040 Página de precios ES/EN
- ✅ HU-041 Bilingüe ES/EN
- ✅ HU-042 BreathingBackground fondo animado
- ✅ HU-021 Check-out de ánimo + MoodLogs en BD
- ✅ HU-022 Calificación con estrellas + SessionRatings en BD

## Sprint 4 — Backlog
- HU-043: Gestión de imágenes y videos en landing (Cloudinary vs GCS — decisión pendiente)
- DT-001: Limpieza de dependencias frontend (vite@8 vs @tailwindcss/vite@4.2.1)
- HU-023: Búsqueda de reflexiones por palabra clave
- HU-035: Polling automático badge superadmin

## Roles de usuario
- `user` — usuario normal, accede a /app/checkin y /app/chat
- `admin` — puede ver y proponer cambios de prompts
- `superadmin` — puede aprobar/rechazar prompts, editar contenido landing

## Variables de entorno requeridas (backend/.env)
```
ANTHROPIC_API_KEY=
JWT_SECRET=
DATABASE_URL=
FRONTEND_URL=
ADMIN_EMAILS=
DB_PASS=
PORT=8080
```

## Notas importantes
- El `frontend/dist` está en `.gitignore` — el build lo hace el Dockerfile en Cloud Run
- `react-router-dom` instalado con `--legacy-peer-deps` pero no registrado formalmente en `package.json` (DT-001)
- El panel admin está integrado en `ChatPage.tsx` como slide-in desde la derecha
- `BreathingBackground` es un componente Canvas API reutilizable — no usar librerías de animación
