# Prompt Maestro para Manus — Elevation Platform
> Generado: 30 de marzo de 2026
> Uso: Pegar completo en Manus para diseñar la experiencia de usuario y arquitectura de datos

---

# PROMPT PARA MANUS

Eres un experto en diseño de producto digital, arquitectura de datos y experiencia de usuario. Voy a darte el contexto completo de un producto llamado **Elevation** para que me ayudes a diseñar la experiencia de usuario, las pantallas, el modelo de datos y la arquitectura de backoffice.

---

## QUÉ ES ELEVATION

Elevation es una **plataforma de bienestar integral** que acompaña a las personas en su camino hacia la salud mental y el equilibrio emocional. Tiene tres pilares:

1. **Elevation IA** — una IA empática disponible 24/7 que acompaña, escucha y genera recomendaciones de bienestar personalizadas
2. **Terapeutas humanos especializados** — profesionales validados académicamente con diferentes corrientes terapéuticas (mayéutica, TCC, DBT, tantra, motivación, mindfulness, etc.)
3. **El usuario protagonista** — dueño de su proceso, con acceso a su historial emocional, reportes de progreso y recomendaciones

**Stack técnico:**
- Frontend: React + TypeScript + Vite (SPA)
- Backend: Express + Sequelize + PostgreSQL
- IA: Anthropic Claude API
- Deploy: Google Cloud Run
- Videollamadas: Daily.co o Jitsi Meet (iframe embebido)
- Calendario: Google Calendar API

---

## ROLES DE USUARIO

### 1. `user` — Usuario final de Elevation
- Hace check-in emocional antes de cada sesión
- Chatea con la IA de Elevation
- Puede tener un terapeuta asignado
- Hace check-out emocional y califica la sesión
- Tiene acceso a su historial emocional y reportes de progreso
- Ve recomendaciones de bienestar generadas por la IA

### 2. `therapist` — Terapeuta
- Validado académicamente por la Junta de Elevation
- Tiene su propia corriente terapéutica y prompt personalizado
- Ve el progreso emocional de sus pacientes asignados
- Puede agregar notas clínicas e historia clínica
- Agenda sesiones (integrado con Google Calendar)
- La IA usa su prompt cuando atiende a sus pacientes

### 3. `admin` — Administrador
- Usuario interno del equipo (NO usa Elevation como usuario)
- Al hacer login va directo al backoffice
- Puede: crear usuarios (user/therapist), editar contenido de páginas, ver métricas, proponer cambios de prompt
- NO puede: aprobar prompts, crear admins, cambiar roles privilegiados

### 4. `superadmin` — Superadministrador
- Máximo poder del sistema
- Todo lo del admin más: aprobar/rechazar prompts, crear cualquier usuario, gestionar roles
- Único que puede activar terapeutas en la plataforma

### 5. `junta` — Miembro de la Junta de Elevation
- Órgano de validación ética y académica
- Valida certificaciones académicas de terapeutas
- Revisa prompts desde perspectiva ética (el superadmin los revisa técnicamente)
- Mantiene el Manifiesto Ético de la plataforma
- Puede suspender terapeutas que violen los principios éticos

---

## DESIGN SYSTEM — OBLIGATORIO RESPETAR

### Filosofía de diseño
Estilo Muji / japonés minimalista. Calma, espacio, tipografía elegante. Sin ruido visual. Cada elemento tiene un propósito. El diseño debe reforzar el estado emocional de calma y confianza.

### Paleta de colores
```css
/* Fondos */
--elevation-bg:        #f9f9f7;  /* Fondo principal */
--elevation-surface:   #FAF8F4;  /* Cards, modales */
--elevation-border:    #E7E5E4;  /* Borde sutil */
--elevation-border-md: #D6D2C4;  /* Borde medio */

/* Marca */
--elevation-olive:     #6B7D5C;  /* CTA principal */
--elevation-olive-lt:  #A8B5A2;  /* Accents secundarios */
--elevation-olive-bg:  #EAF0E6;  /* Fondos sutiles */

/* Texto */
--elevation-text-1:    #1C1917;  /* Texto principal */
--elevation-text-2:    #78716C;  /* Texto secundario */
--elevation-text-3:    #A8A29E;  /* Placeholders */

/* IA y sistema */
--elevation-teal:      #0d9488;  /* Mensajes IA */
--elevation-teal-bg:   #F0FDFA;
--elevation-teal-dark: #065f46;

/* Estados */
--elevation-success:   #059669;
--elevation-warning:   #92400E;
--elevation-warning-bg:#FEF3C7;
--elevation-error:     #DC2626;

/* Backoffice (ligeramente diferente) */
--admin-bg:      #F5F3EF;
--admin-sidebar: #EDEAE4;
```

### Tipografía
```css
/* Títulos */
font-family: 'Playfair Display', serif;
font-weight: 300 | 400; /* NUNCA bold en títulos */

/* Cuerpo e interfaz */
font-family: 'Inter', sans-serif;
font-weight: 400 | 500 | 600;

/* Mensajes IA y contenido emocional */
font-family: 'Noto Serif', serif;
font-style: italic;
```

### Escala tipográfica
```
10px — Labels, badges, microtext
11px — Texto admin pequeño
13px — Texto secundario
14px — Botones, inputs
16px — Cuerpo principal
22px — Títulos de sección
28-48px — Títulos hero (clamp)
```

### Componentes clave
```css
/* Botón primario */
background: #6B7D5C; color: #FAF8F4;
border: none; border-radius: 0.85rem;
padding: 0.85rem 2rem; font-size: 0.95rem;

/* Botón secundario */
background: transparent; color: #6B7D5C;
border: 0.5px solid #A8B5A2; border-radius: 0.85rem;

/* Card */
background: #FAF8F4; border: 0.5px solid #D6D2C4;
border-radius: 1rem; padding: 2rem;

/* Input */
border: 0.5px solid #D6D2C4; border-radius: 0.5rem;
background: #FAF8F4; padding: 0.6rem 0.75rem;
font-size: 13px; color: #1C1917;
/* Focus: border-color: #6B7D5C */

/* Header sticky */
background: rgba(249,249,247,0.85);
backdrop-filter: blur(16px);
border-bottom: 1px solid rgba(231,229,228,0.5);

/* Sombras: muy sutiles */
box-shadow: 0 2px 12px rgba(26,28,27,0.06);

/* Iconos SVG inline, stroke-width: 1.5, sin librerías */
```

### Responsive
- Backoffice: principalmente desktop (sidebar 240px + contenido flex-1)
- Plataforma de usuario: mobile-first
- Breakpoints: mobile <640px | tablet 640-1024px | desktop >1024px

---

## LO QUE NECESITO QUE DISEÑES

### 1. EXPERIENCIA DEL USUARIO FINAL

#### 1.1 Onboarding (primer registro)
Flujo paso a paso al registrarse por primera vez:

**Paso 1 — Bienvenida**
Pantalla cálida de bienvenida con mensaje personalizado y botón para empezar.

**Paso 2 — Áreas de bienestar**
Selección múltiple de áreas de interés:
- Bienestar psicológico (emociones, ansiedad, autoestima)
- Bienestar físico (cuerpo, hábitos, sueño)
- Bienestar sexual (sexualidad, intimidad, deseo)
- Desarrollo personal (metas, disciplina, propósito)
- Relaciones y vínculos (pareja, familia, comunicación)
- Bienestar laboral (estrés, equilibrio vida-trabajo)

**Paso 3 — Temas específicos**
Según áreas elegidas, mostrar temas relevantes (selección múltiple).

**Paso 4 — Intención principal**
Campo de texto libre: "¿Qué te trajo a Elevation hoy?"

**Paso 5 — Preferencia de acompañamiento**
- Solo con la IA de Elevation
- Con un terapeuta + la IA
- No sé todavía

**Paso 6 — Resumen y confirmación**
Mostrar resumen de lo seleccionado con opción de editar.

**Modelo de datos `UserProfile`:**
```js
{
  UserId:          INTEGER (FK Users),
  wellnessAreas:   JSONB,    // ['psychological', 'physical', 'sexual', ...]
  specificTopics:  JSONB,    // ['anxiety', 'self_esteem', 'grief', ...]
  mainIntention:   TEXT,     // texto libre
  preferenceMode:  STRING,   // 'ai_only' | 'with_therapist' | 'undecided'
  onboardingDone:  BOOLEAN,
  onboardingAt:    DATE
}
```

#### 1.2 Panel del usuario (post-login)
Pantallas que el usuario ve después del onboarding:

- **Check-in emocional** — obligatorio al inicio de cada sesión (5 emojis)
- **Chat con Elevation** — conversación con la IA
- **Check-out + estrellas** — modal al cerrar sesión
- **Mi progreso** — historial emocional, tendencias, recomendaciones de la IA
- **Mi terapeuta** — información del terapeuta asignado, próxima sesión, historial de citas

#### 1.3 Recomendaciones de bienestar
La IA genera recomendaciones después de cada sesión basadas en el progreso del usuario. El usuario las ve en "Mi progreso".

**Modelo de datos `WellnessRecommendation`:**
```js
{
  UserId:          INTEGER,
  therapistId:     INTEGER (nullable),
  content:         TEXT,      // la recomendación
  source:          STRING,    // 'ai' | 'therapist' | 'combined'
  approvedBy:      INTEGER,   // therapistId que aprobó (si aplica)
  approvedAt:      DATE,
  visibleToUser:   BOOLEAN,   // false hasta que el terapeuta apruebe
  createdAt:       DATE
}
```

---

### 2. EXPERIENCIA DEL TERAPEUTA

**Ruta:** `/therapist/dashboard`

#### 2.1 Dashboard principal
- Cards: pacientes activos, sesiones esta semana, mood promedio de pacientes, rating promedio
- Lista de pacientes con: nombre, último mood, tendencia emocional, próxima sesión
- Alertas: pacientes sin actividad más de 7 días

#### 2.2 Ficha del paciente
- Información del onboarding (áreas de interés, intención)
- Gráfico de tendencia emocional (check-in vs check-out por día)
- Historial de MoodLogs con emojis
- Ratings de sesiones
- Notas clínicas del terapeuta
- Recomendaciones de bienestar generadas por la IA (puede aprobar/editar)
- Documentos adjuntos (historia clínica)

#### 2.3 Prompt terapéutico
El terapeuta puede proponer su prompt (o usar un template de la Junta).
Flujo: propone → superadmin revisa técnicamente → Junta revisa éticamente → se activa.

#### 2.4 Calendario de pacientes
Integración Google Calendar: el terapeuta agenda sesiones, se crea el evento automáticamente. La videollamada usa Daily.co embebida en iframe.

**Modelos de datos:**
```js
// Notas clínicas
ClinicalNote {
  TherapistId: INTEGER,
  UserId:      INTEGER,
  content:     TEXT,
  sessionDate: DATE,
  isPrivate:   BOOLEAN  // true = solo el terapeuta la ve
}

// Documentos adjuntos
ClinicalDocument {
  UserId:      INTEGER,
  TherapistId: INTEGER,
  fileName:    STRING,
  fileUrl:     TEXT,    // URL en Cloud Storage
  fileType:    STRING,
  uploadedBy:  INTEGER  // userId o therapistId
}

// Sesiones agendadas
TherapySession {
  TherapistId:     INTEGER,
  UserId:          INTEGER,
  scheduledAt:     DATE,
  durationMinutes: INTEGER,
  googleEventId:   STRING,
  meetUrl:         TEXT,
  status:          STRING  // 'scheduled' | 'completed' | 'cancelled'
}
```

---

### 3. EXPERIENCIA DEL BACKOFFICE (admin y superadmin)

**Ruta:** `/admin/dashboard`
**Layout:** Header fijo (60px) + Sidebar (240px) + Contenido principal (flex-1)

#### 3.1 Dashboard principal
- KPIs: usuarios activos, sesiones hoy, rating promedio, % mejora emocional
- Gráfico de sesiones por día (últimos 7 días)
- Versiones de prompts pendientes de aprobación
- Accesos rápidos por rol

#### 3.2 Gestión de prompts (`/admin/prompts`)
- Prompt activo de Elevation (versión y fecha)
- Lista de prompts de terapeutas con sus estados
- Versiones pendientes con botones aprobar/rechazar (solo superadmin)
- Historial de versiones con rollback
- Templates de prompts de la Junta

**Modelo de datos (extensión del PromptVault existente):**
```js
PromptVault {
  key:              STRING,   // 'elevation_system_prompt' | 'therapist_prompt_{id}'
  contentEncrypted: TEXT,
  version:          INTEGER,
  status:           STRING,   // 'active' | 'pending_review' | 'pending_ethics' | 'approved' | 'rejected' | 'archived'
  isActive:         BOOLEAN,
  promptType:       STRING,   // 'system' | 'therapist' | 'template'
  therapistId:      INTEGER,  // nullable, solo para prompts de terapeuta
  proposed_by:      STRING,
  approved_by:      STRING,   // superadmin (aprobación técnica)
  ethics_approved_by: STRING, // miembro de la Junta (aprobación ética)
  ethics_approved_at: DATE,
  approved_by:      STRING,
  rejected_by:      STRING,
  rejection_note:   TEXT
}
```

#### 3.3 Contenido de páginas (`/admin/contenido`)
TODO el contenido de las páginas públicas es editable desde acá. Nada quemado en el código.

Tabs por página:
- **Home** — hero, subtitulo, CTAs, pasos del proceso, beneficios
- **Precios** — planes, precios, features de cada plan, badge, promoción activa
- **Login** — textos del formulario
- **Onboarding** — textos de cada paso del onboarding
- **Manifesto Ético** — los principios éticos de la plataforma (editable por Junta)

Cada tab tiene sub-tabs ES / EN para el contenido bilingüe.

**Modelo de datos `LandingContent` (extendido):**
```js
LandingContent {
  page:       STRING(50),  // 'home' | 'pricing' | 'login' | 'onboarding' | 'manifesto'
  key:        STRING,      // 'hero_title' | 'plan_pro_price' | 'step1_text' | ...
  lang:       STRING(5),   // 'es' | 'en'
  value:      TEXT,
  updated_by: STRING,
  // UNIQUE: (page, key, lang)
}
```

**Keys importantes por página:**
```
page: 'home'
  hero_title, hero_subtitle, hero_badge
  cta_primary, cta_final_title, cta_final_subtitle
  step1_title, step1_desc, step2_title, step2_desc, step3_title, step3_desc
  benefit1_title, benefit1_desc, benefit2_title, benefit2_desc, benefit3_title, benefit3_desc

page: 'pricing'
  pricing_title, pricing_subtitle
  plan_free_price, plan_free_period, plan_free_cta
  plan_free_feature_1..4
  plan_pro_price, plan_pro_period, plan_pro_badge, plan_pro_cta
  plan_pro_feature_1..5
  promo_active (true|false), promo_text, promo_expires
  pricing_note

page: 'onboarding'
  welcome_title, welcome_subtitle
  step2_title, area_psychological, area_physical, area_sexual...
  step4_placeholder
  step5_ai_title, step5_ai_desc, step5_therapist_title, step5_therapist_desc

page: 'manifesto'
  principle_1_title, principle_1_body
  principle_2_title, principle_2_body
  ... (7 principios)
```

#### 3.4 Gestión de usuarios (`/admin/usuarios`)
- Tabla de usuarios con: nombre, email, rol, estado, sesiones, fecha registro
- Filtros: por rol, por estado, por terapeuta asignado
- Acción por usuario: cambiar rol, activar/desactivar, ver estadísticas, asignar terapeuta
- Botón "Crear usuario" con modal
- Admin crea: user, therapist. Superadmin crea: cualquier rol

**Extensión del modelo `User`:**
```js
User {
  // Existentes:
  name, email, password, role, loginAttempts, lockedUntil
  // Nuevos:
  active:          BOOLEAN,  // default true
  therapistId:     INTEGER,  // nullable, FK self-referential
  speciality:      STRING,   // solo para therapists
  academicTitle:   STRING,   // solo para therapists
  therapyStreams:  JSONB,    // ['mayeutica', 'tcc', 'tantra', ...]
  validatedByJunta: BOOLEAN, // false hasta que la Junta apruebe
  validatedAt:     DATE
}
```

#### 3.5 Métricas (`/admin/metricas`)
- Mood check-in vs check-out: ¿los usuarios mejoran después de chatear?
- Sesiones por día (gráfico de barras)
- Rating promedio de sesiones
- Usuarios nuevos por semana
- Terapeutas más activos
- Top áreas de bienestar más elegidas en el onboarding

#### 3.6 Validación de terapeutas (`/admin/terapeutas`) — solo Junta y Superadmin
- Lista de terapeutas pendientes de validación
- Ver certificaciones subidas
- Aprobar/rechazar con nota
- Ver prompts propuestos y dar feedback ético
- Templates de prompts disponibles

---

### 4. EL MANIFIESTO ÉTICO (editable desde backoffice)

El Manifiesto Ético de Elevation es un documento vivo que define los principios no negociables. Se guarda en `LandingContent` con `page: 'manifesto'` y es editable desde el backoffice por la Junta (con aprobación del superadmin).

Principios actuales (v1.0):
1. Autonomía del usuario
2. No manipulación
3. Transparencia
4. Privacidad absoluta
5. Evidencia y rigor académico
6. Diversidad de enfoques
7. Protección de poblaciones vulnerables

---

### 5. FLUJO DE VALIDACIÓN DE TERAPEUTAS

```
1. Terapeuta llena formulario de solicitud (nombre, título, especialización, corrientes terapéuticas, documentos académicos)
2. Superadmin crea la cuenta del terapeuta con status: 'pending_validation'
3. La Junta recibe notificación y revisa:
   → Aprueba → status: 'pending_prompt'
   → Rechaza → notificación al terapeuta
4. Terapeuta propone su prompt (o elige un template de la Junta)
5. Revisión en paralelo:
   → Superadmin: revisa funcionamiento técnico → aprueba/rechaza
   → Junta: revisa ética → aprueba/rechaza
6. Ambos aprueban → status: 'active' → puede recibir pacientes
```

---

## LO QUE NECESITO QUE ENTREGUES

Quiero que me entregues todo lo siguiente, basado estrictamente en el Design System de Elevation descrito arriba:

### A. Diseño de pantallas (wireframes detallados o mockups)
Para cada pantalla listada, diseña la UI respetando:
- La paleta de colores de Elevation
- La tipografía (Playfair Display para títulos, Inter para UI, Noto Serif para contenido emocional)
- Los componentes definidos (botones, cards, inputs, badges)
- El layout correspondiente (mobile-first para usuarios, desktop para backoffice)

Pantallas prioritarias:
1. Onboarding (6 pasos) — mobile
2. Dashboard del terapeuta — desktop
3. Ficha del paciente (terapeuta) — desktop
4. Dashboard del backoffice (admin/superadmin) — desktop
5. Gestión de contenido de páginas — desktop
6. Panel de métricas — desktop
7. "Mi progreso" del usuario — mobile

### B. Modelo de datos completo
Diagrama entidad-relación con todos los modelos y sus relaciones:
- User (extendido)
- UserProfile
- MoodLog
- SessionRating
- Message
- PromptVault (extendido)
- LandingContent (extendido)
- WellnessRecommendation
- ClinicalNote
- ClinicalDocument
- TherapySession

### C. Arquitectura de la API
Endpoints organizados por dominio:
- `/api/user/*` — perfil, onboarding, progreso
- `/api/mood/*` — check-in, check-out, historial
- `/api/therapist/*` — pacientes, notas, sesiones
- `/api/admin/*` — usuarios, contenido, prompts
- `/api/junta/*` — validación de terapeutas, manifesto

### D. Lógica de contenido dinámico
Explicar cómo funciona el sistema de contenido editable:
- Cómo se guarda en BD (modelo LandingContent)
- Cómo el frontend lo consume con fallback a defaults hardcodeados
- Cómo el admin lo edita desde el backoffice
- Cómo funciona el sistema bilingüe (ES/EN)

### E. Flujos de usuario completos
Diagramas de flujo para:
- Flujo del usuario regular (registro → onboarding → check-in → chat → check-out)
- Flujo del terapeuta (login → dashboard → paciente → notas → sesión)
- Flujo de validación de terapeuta (solicitud → Junta → prompt → activación)
- Flujo de cambio de prompt (admin propone → superadmin aprueba técnico → Junta aprueba ético → activo)

---

## RESTRICCIONES IMPORTANTES

1. **Nada quemado en el código** — todo texto visible al usuario debe poder editarse desde el backoffice
2. **Fallback siempre** — si la BD falla, la app debe funcionar con defaults hardcodeados
3. **Privacidad del usuario** — el terapeuta NUNCA puede leer las conversaciones privadas del usuario con la IA sin consentimiento explícito
4. **El Manifiesto Ético protege todo** — cualquier funcionalidad que viole los 7 principios debe ser bloqueada
5. **Diseño coherente** — todas las pantallas deben sentirse parte de la misma familia visual
6. **Bilingüe** — toda la interfaz pública existe en ES y EN
7. **Mobile-first para usuarios, desktop para admins**

---

## CONTEXTO ADICIONAL IMPORTANTE

- La app ya tiene implementado: login con JWT, chat con IA (Claude Haiku), check-in/check-out emocional, calificación con estrellas, sistema de versionado de prompts con aprobación, landing editable (solo home por ahora)
- El Sprint 4 (en desarrollo) agrega: backoffice con rutas dedicadas, gestión de usuarios, terapeuta básico, métricas, contenido de todas las páginas
- Sprint 5 agrega: onboarding, historia clínica, recomendaciones IA, prompts por terapeuta
- Sprint 6 agrega: videollamadas (Daily.co en iframe), Google Calendar, reasignación de pacientes

---
*Generado: 30 de marzo de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
