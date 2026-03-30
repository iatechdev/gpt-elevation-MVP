# HU-048 — Sistema de contenido expandido — todas las páginas públicas editables

> Sprint 4 | Must Have | 5 puntos
> Documentada: 30 de marzo de 2026
> Aprobada por Mauro Roldán

---

## Contexto

Hoy solo la landing home tiene contenido editable desde el backoffice (HU-039). Esta HU expande ese sistema para cubrir todas las páginas públicas, incluyendo la página de precios con control total sobre planes, precios y promociones.

**Decisiones clave:**
- Tanto admin como superadmin pueden editar el contenido de las páginas
- Se usa el mismo modelo `LandingContent` existente, expandido con el campo `page`
- Un solo sistema de contenido para todas las páginas — no modelos separados
- Los precios y promociones son contenido editable, no hardcodeados

---

## Descripción

Como admin o superadmin, quiero poder editar el contenido de todas las páginas públicas de Elevation desde el backoffice, incluyendo textos, precios de los planes y promociones activas, sin necesidad de hacer un deploy.

---

## Cambio en el modelo LandingContent

Agregar campo `page` al modelo existente:

```js
const LandingContent = sequelize.define('LandingContent', {
  page:       { type: DataTypes.STRING(50),  allowNull: false, defaultValue: 'home' }, // NUEVO
  key:        { type: DataTypes.STRING,      allowNull: false },
  lang:       { type: DataTypes.STRING(5),   allowNull: false },
  value:      { type: DataTypes.TEXT,        allowNull: false },
  updated_by: { type: DataTypes.STRING,      allowNull: true },
}, {
  indexes: [{ unique: true, fields: ['page', 'key', 'lang'] }]  // ← actualizar unique
});
```

**Migración BD requerida:**
Los registros existentes de home deben tener `page: 'home'`. Sequelize lo asigna automáticamente con `defaultValue` al hacer `sync({ alter: true })`.

---

## Páginas y keys editables

### page: 'home' (ya existe)
```
hero_title, hero_subtitle, cta_primary, cta_final_title, cta_final_subtitle
hero_badge, step1_title, step1_desc, step2_title, step2_desc, step3_title, step3_desc
```

### page: 'pricing' (nuevo)
```
# Sección hero
pricing_title           → 'Elige tu camino'
pricing_subtitle        → 'Sin compromisos. Cancelá cuando quieras.'

# Plan Free
plan_free_name          → 'Free'
plan_free_price         → '0'
plan_free_period        → '/ mes'
plan_free_cta           → 'Empezar gratis'
plan_free_feature_1     → '10 conversaciones por mes'
plan_free_feature_2     → 'Check-in emocional diario'
plan_free_feature_3     → 'Historial 7 días'
plan_free_feature_4     → 'Soporte básico'

# Plan Pro
plan_pro_name           → 'Pro'
plan_pro_price          → '9.99'
plan_pro_period         → '/ mes'
plan_pro_badge          → 'MÁS POPULAR'
plan_pro_cta            → 'Comenzar prueba gratuita'
plan_pro_feature_1      → 'Conversaciones ilimitadas'
plan_pro_feature_2      → 'Check-in + Check-out emocional'
plan_pro_feature_3      → 'Historial completo'
plan_pro_feature_4      → 'Estadísticas emocionales'
plan_pro_feature_5      → 'Soporte prioritario'

# Promoción activa (opcional)
promo_active            → 'true' | 'false'
promo_text              → '¡50% off el primer mes!'
promo_expires           → '2026-04-30'

# Nota al pie
pricing_note            → 'Sin tarjeta de crédito para Free...'
```

---

## API — cambios en endpoints existentes

### GET /api/landing-content?lang=es&page=home
Agregar parámetro `page` (opcional, default: 'home' para backwards compatibility)

### GET /api/landing-content?lang=es&page=pricing
Retorna todos los keys de la página de precios

### PUT /api/landing-content
Body ahora incluye `page`:
```json
{ "page": "pricing", "key": "plan_pro_price", "lang": "es", "value": "7.99" }
```
Acceso: admin y superadmin (ambos pueden editar contenido)

---

## Frontend — PricingPage.tsx

Actualmente los planes están hardcodeados en el componente. Con esta HU se convierten en datos dinámicos:

```tsx
// Al montar, fetchea contenido de pricing
useEffect(() => {
  fetch(`${BACKEND}/api/landing-content?lang=${lang}&page=pricing`)
    .then(r => r.json())
    .then(data => setPricingContent(data))
    .catch(() => setPricingContent(null)) // fallback a defaults hardcodeados
}, [lang])

const get = (key: string, fallback: string) => pricingContent?.[key] ?? fallback

// Promoción activa
const promoActive = get('promo_active', 'false') === 'true'
const promoText   = get('promo_text', '')
```

---

## Frontend — AdminContenido.tsx

Panel con tabs por página:

```
[Home] [Precios] [... futuras páginas]
```

### Tab Home
- Mismos campos que ya existían en el panel admin del Sprint 3
- Tabs ES / EN dentro del tab Home

### Tab Precios
- Sección: Textos generales (título, subtítulo)
- Sección: Plan Free (nombre, precio, período, CTA, features)
- Sección: Plan Pro (nombre, precio, período, badge, CTA, features)
- Sección: Promoción activa (toggle on/off, texto, fecha de vencimiento)
- Tabs ES / EN para cada sección
- Botón Guardar por campo individual

---

## Lógica de promoción

```tsx
// En PricingPage.tsx
const promoActive  = get('promo_active', 'false') === 'true'
const promoExpires = get('promo_expires', '')
const promoVigente = promoActive && (!promoExpires || new Date(promoExpires) > new Date())

{promoVigente && (
  <div style={{ background: '#FEF3C7', ... }}>
    {get('promo_text', '')}
  </div>
)}
```

---

## Criterio de aceptación

- [ ] Admin edita precio del plan Pro → PricingPage muestra el nuevo precio sin deploy
- [ ] Admin activa una promoción → aparece el banner en PricingPage
- [ ] Admin desactiva la promoción → desaparece el banner
- [ ] Admin edita feature del plan Free en EN → solo afecta la versión en inglés
- [ ] Si la BD falla → PricingPage usa los defaults hardcodeados sin romper
- [ ] LandingPage (home) sigue funcionando igual (backwards compatibility con `page: 'home'`)
- [ ] AdminContenido tiene tabs por página: Home y Precios

---

## Nota de migración

Sequelize agrega el campo `page` con `defaultValue: 'home'` automáticamente al hacer `sync({ alter: true })`. Los registros existentes quedan con `page: 'home'` sin intervención manual. El índice único cambia de `[key, lang]` a `[page, key, lang]`.

**Riesgo:** el cambio de índice único puede requerir eliminar el índice viejo manualmente si Sequelize no lo hace automáticamente. Verificar en staging antes de aplicar en producción.

---
*Documentado: 30 de marzo de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
