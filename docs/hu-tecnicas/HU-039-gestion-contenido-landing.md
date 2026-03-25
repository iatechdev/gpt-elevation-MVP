# HU-039 — Gestión de contenido de landing desde backoffice

> Sprint 3 | Should Have | 5 puntos  
> Actualizada: 24 de marzo de 2026  
> Aprobada por Mauro Roldán

---

## Alcance Sprint 3 — Solo textos

Esta HU cubre únicamente la gestión de **textos** de la landing desde el backoffice.
La gestión de **imágenes y videos** fue separada intencionalmente a HU-043 (Sprint 4) para tomar decisiones de arquitectura de storage con tiempo suficiente.

---

## Descripción

Como superadmin, quiero poder editar los textos clave de la landing pública desde el panel de administración, sin necesidad de hacer un nuevo deploy. Los cambios deben reflejarse inmediatamente en la landing y soportar ambos idiomas (ES y EN).

---

## Campos editables

| Key | Descripción | ES default | EN default |
|---|---|---|---|
| `hero_title` | Título principal del hero | Encuentra tu calma interior | Find your inner calm |
| `hero_subtitle` | Subtítulo del hero | Tu compañero privado... | Your private companion... |
| `cta_primary` | Texto del botón principal | Iniciar conversación | Start a conversation |
| `cta_final_title` | Título del CTA final | ¿Listo para empezar? | Ready to begin? |
| `cta_final_subtitle` | Subtítulo del CTA final | Sin tarjeta de crédito. | No credit card required. |

---

## Base de datos

### Modelo: `LandingContent.js`

```js
const LandingContent = sequelize.define('LandingContent', {
  key:        { type: DataTypes.STRING,  allowNull: false },
  lang:       { type: DataTypes.STRING(5), allowNull: false },
  value:      { type: DataTypes.TEXT,    allowNull: false },
  updated_by: { type: DataTypes.STRING,  allowNull: true },
}, {
  indexes: [{ unique: true, fields: ['key', 'lang'] }]
});
```

### Lógica de fallback
- Si la BD no tiene un key → se usa el texto del i18n hardcodeado
- Si la BD falla completamente → la landing sigue funcionando con i18n
- Esto garantiza que la landing nunca quede en blanco por un error del admin

---

## API

### GET /api/landing-content?lang=es
- Público — sin autenticación requerida
- Retorna objeto con todos los keys del idioma solicitado
- Mezcla BD + defaults (BD tiene prioridad)

```json
{
  "hero_title": "Encuentra tu calma interior",
  "hero_subtitle": "Tu compañero privado...",
  "cta_primary": "Iniciar conversación",
  "cta_final_title": "¿Listo para empezar?",
  "cta_final_subtitle": "Sin tarjeta de crédito."
}
```

### PUT /api/landing-content
- Solo superadmin
- Body: `{ key, lang, value }`
- Upsert — crea si no existe, actualiza si ya existe

---

## Frontend — LandingPage.tsx

```tsx
// Al montar, fetchea contenido del idioma actual
// Fallback: usa t(key) del i18n si la API falla
useEffect(() => {
  fetch(`/api/landing-content?lang=${lang}`)
    .then(r => r.json())
    .then(data => setLandingContent(data))
    .catch(() => setLandingContent(null)) // usa i18n como fallback
}, [lang])

// En el render:
const getText = (key: string) => landingContent?.[key] ?? t(key)
```

---

## Frontend — AdminPage (sección nueva en ChatPage panel)

- Nueva sección en el panel admin: `"Contenido Landing"`
- Solo visible para `superadmin`
- Tabs ES / EN para editar cada idioma
- Un campo por key con label descriptivo
- Botón Guardar por campo (no un form gigante)
- Feedback visual de éxito/error por campo

---

## Archivos modificados

```
backend/LandingContent.js          ← nuevo modelo Sequelize
backend/server.js                  ← GET y PUT /api/landing-content
frontend/src/pages/LandingPage.tsx ← consume API + fallback i18n
frontend/src/pages/ChatPage.tsx    ← sección admin contenido landing
```

---

## Definición de hecho

- [ ] Superadmin edita `hero_title` en ES → landing muestra el nuevo texto sin deploy
- [ ] Superadmin edita `hero_title` en EN → solo afecta el idioma EN
- [ ] Si la BD falla → la landing usa el texto del i18n sin romper
- [ ] Admin regular NO ve la sección de contenido landing
- [ ] Cambios son inmediatos (sin cache agresivo)
- [ ] Tabla `LandingContents` creada en PostgreSQL

---

## Nota arquitectónica

La gestión de imágenes y videos fue separada a **HU-043** deliberadamente.
Razón: requiere decisiones de storage (Cloudinary vs GCS) que merecen análisis propio en Sprint 4 para no crear deuda técnica desde el inicio.

---
*Documentado: 24 de marzo de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
