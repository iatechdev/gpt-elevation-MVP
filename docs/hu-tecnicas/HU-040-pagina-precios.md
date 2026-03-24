# HU-040 — Página de precios

> Sprint 3 | Should Have | 3 puntos  
> Aprobada por Mauro Roldán — 24 marzo 2026

---

## Descripción

Como usuario nuevo, quiero ver una página de precios clara y tranquila que me explique los planes disponibles antes de registrarme.

---

## Criterios de aceptación

- [ ] Ruta `/precios` (ES) — `/pricing` (EN) accesible sin autenticación
- [ ] Muestra mínimo 2 planes (Free y Pro)
- [ ] Cada plan con: nombre, precio, lista de beneficios, CTA
- [ ] Diseño Muji: sin urgencia artificial, sin banners agresivos
- [ ] Fondo animado `BreathingBackground` presente
- [ ] Responsive mobile + desktop
- [ ] Plan recomendado destacado con borde sutil (no agresivo)
- [ ] Bilingüe ES/EN
- [ ] Link desde footer de la landing

---

## Diseño de planes

### Plan Free
- Precio: `$0 / mes`
- 10 conversaciones por mes
- Check-in emocional
- Historial 7 días
- CTA: `"Empezar gratis"`

### Plan Pro ⭐ (recomendado)
- Precio: `$9.99 / mes`
- Conversaciones ilimitadas
- Check-in + Check-out emocional
- Historial completo
- Estadísticas emocionales
- CTA: `"Comenzar prueba gratuita"`

---

## Layout

### Mobile
```
[Topbar]
[Título centrado]
[Card Plan Free]
[Card Plan Pro — borde olive sutil]
[Nota: "Sin tarjeta de crédito"]
[Footer]
```

### Desktop
```
[Topbar]
[Título + subtítulo centrado]
[Grid 2 columnas: Free | Pro]
[Nota centrada]
[Footer]
```

---

## Textos

### ES
- Título: `"Elige tu camino"`
- Subtítulo: `"Sin compromisos. Cancelá cuando quieras."`

### EN
- Título: `"Choose your path"`
- Subtítulo: `"No commitments. Cancel anytime."`

---

## Archivos a crear

```
frontend/src/pages/PricingPage.tsx
```

## Archivos modificados

```
frontend/src/App.tsx          ← agregar ruta /precios y /pricing
frontend/src/i18n/es.ts       ← textos de precios en ES
frontend/src/i18n/en.ts       ← textos de precios en EN
```

---

## Definición de hecho

- [ ] Página accesible sin login desde `/precios` y `/pricing`
- [ ] Responsive validado
- [ ] Fondo animado presente
- [ ] CTAs navegan a `/login`
- [ ] Bilingüe funcionando

---
*Documentado: 24 de marzo de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
