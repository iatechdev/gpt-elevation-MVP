# HU-039 — Gestión de contenido de landing desde backoffice

> Sprint 3 | Should Have | 5 puntos  
> Aprobada por Mauro Roldán — 24 marzo 2026

---

## Descripción

Como administrador, quiero poder editar los textos clave de la landing pública desde el panel de administración, sin necesidad de hacer un nuevo deploy.

---

## Criterios de aceptación

- [ ] Panel admin incluye nueva sección `"Contenido Landing"`
- [ ] Campos editables: Hero título, Hero subtítulo, CTA principal, texto CTA final
- [ ] Los cambios se guardan en base de datos (tabla `LandingContent`)
- [ ] La landing pública lee los textos desde la BD en cada carga (con cache de 5 minutos)
- [ ] Soporte para ES y EN por separado
- [ ] Solo superadmin puede editar el contenido de la landing
- [ ] Los cambios son inmediatos (sin necesidad de deploy)

---

## Base de datos

### Nueva tabla: `LandingContent`

```sql
CREATE TABLE LandingContent (
  id          SERIAL PRIMARY KEY,
  key         VARCHAR(100) NOT NULL,   -- ej: 'hero_title'
  lang        VARCHAR(5) NOT NULL,     -- 'es' | 'en'
  value       TEXT NOT NULL,
  updated_at  TIMESTAMP DEFAULT NOW(),
  updated_by  INTEGER REFERENCES Users(id),
  UNIQUE(key, lang)
);
```

### Keys iniciales
```
hero_title
hero_subtitle
cta_primary
cta_final_title
cta_final_subtitle
```

---

## API

```
GET  /api/landing-content?lang=es     → retorna todos los textos del idioma
PUT  /api/landing-content             → actualiza un campo (requiere superadmin)
```

### GET response
```json
{
  "hero_title": "Encuentra tu calma interior",
  "hero_subtitle": "Tu compañero privado...",
  "cta_primary": "Iniciar conversación",
  "cta_final_title": "¿Listo para empezar?",
  "cta_final_subtitle": "Sin tarjeta de crédito."
}
```

### PUT body
```json
{ "key": "hero_title", "lang": "es", "value": "Nuevo título" }
```

---

## Frontend — LandingPage.tsx

```tsx
// Al montar, hacer fetch de /api/landing-content?lang=currentLang
// Fallback: usar textos hardcodeados de i18n si la BD no responde
// Cache en memoria: no refetchear si se cambió de idioma en <5min
```

---

## Archivos modificados

```
backend/server.js            ← endpoints GET y PUT /api/landing-content
backend/LandingContent.js    ← modelo Sequelize nuevo
frontend/src/pages/LandingPage.tsx    ← consume API en lugar de i18n estático
frontend/src/pages/AdminPage.tsx      ← nueva sección "Contenido Landing"
```

---

## Definición de hecho

- [ ] Superadmin edita hero_title en ES → landing muestra el nuevo texto sin deploy
- [ ] Si la BD falla → la landing usa fallback de i18n sin romper
- [ ] Admin regular NO ve la sección de contenido landing
- [ ] Cambios en EN no afectan ES y viceversa

---
*Documentado: 24 de marzo de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
