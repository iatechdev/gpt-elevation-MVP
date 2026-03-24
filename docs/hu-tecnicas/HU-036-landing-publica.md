# HU-036 — Landing pública

> Sprint 3 | Must Have | 8 puntos  
> Aprobada por Mauro Roldán — 24 marzo 2026

---

## Descripción

Como usuario nuevo, quiero llegar a una landing pública en `/` que me explique qué es Elevation y me invite a registrarme, antes de ver cualquier pantalla de login o app.

---

## Criterios de aceptación

- [ ] Ruta `/` renderiza la landing sin requerir autenticación
- [ ] Sección Hero: badge + título + subtítulo + 2 CTAs
- [ ] Sección Proceso: 3 pasos numerados
- [ ] Sección Beneficios: íconos + texto (Privado, 24/7, Basado en evidencia)
- [ ] Sección CTA final con fondo olive
- [ ] Footer con logo + disclaimer legal de salud mental
- [ ] Fondo animado `BreathingBackground` presente en toda la pantalla
- [ ] Textos disponibles en ES y EN (ver HU-041)
- [ ] Totalmente responsive: mobile (375px) y desktop (1100px)
- [ ] Imagen hero desde Unsplash (free tier)
- [ ] Al hacer click en CTA principal → navega a `/login`

---

## Diseño

### Paleta aplicada
| Token | Valor | Uso |
|---|---|---|
| Primary | `#6B7D5C` | CTAs, step numbers, badge |
| Secondary | `#A8B5A2` | Elementos secundarios |
| Background | `#F4F1EC` | Fondo general |
| Surface | `#FAF8F4` | Sección pasos, footer |
| Text primary | `#2F2F2F` | Títulos |
| Text secondary | `#7A7A7A` | Subtítulos, cuerpo |
| Accent | `#D6D2C4` | Divisores |

### Tipografía
- Títulos: `Playfair Display` 700 (serif)
- Cuerpo: `Inter` 400

### Layout mobile (375px)
```
[Topbar: Logo | Nav link]
[Hero image — 200px height, Unsplash]
[Badge]
[H1 — 24px]
[Subtítulo — 14px]
[CTA primario — full width]
[CTA ghost — full width]
[Divisor]
[Sección proceso — 3 steps verticales]
[CTA block — fondo olive]
[Footer]
```

### Layout desktop (1100px)
```
[Topbar: Logo | Nav links | CTA button]
[Hero grid 2col: texto izq | imagen der]
[Sección proceso — 3 cards en fila]
[CTA block — flex row: texto + botón]
[Footer — 3 columnas]
```

---

## Textos

### ES
- Badge: `"Soporte emocional con IA"`
- H1: `"Encuentra tu calma interior"`
- Sub: `"Tu compañero privado para la claridad mental y el bienestar emocional."`
- CTA1: `"Iniciar conversación"`
- CTA2: `"Cómo funciona"`
- Step 1: `"Check-in"` — `"Comparte cómo te sentís hoy."`
- Step 2: `"Charla guiada"` — `"Diálogo basado en evidencia."`
- Step 3: `"Reflexioná"` — `"Seguí tus tendencias emocionales."`
- CTA final: `"¿Listo para empezar?"` — `"Sin tarjeta de crédito."`
- Disclaimer: `"No reemplaza atención profesional de salud mental."`

### EN
- Badge: `"AI emotional support"`
- H1: `"Find your inner calm"`
- Sub: `"Your private companion for mental clarity and emotional wellbeing."`
- CTA1: `"Start a conversation"`
- CTA2: `"How it works"`
- Step 1: `"Check-in"` — `"Share how you feel today."`
- Step 2: `"Guided conversation"` — `"Evidence-based dialogue."`
- Step 3: `"Reflect"` — `"Track your emotional patterns."`
- CTA final: `"Ready to begin?"` — `"No credit card required."`
- Disclaimer: `"Does not replace professional mental health care."`

---

## Archivos a crear

```
frontend/src/pages/LandingPage.tsx       ← pantalla completa
frontend/src/components/BreathingBackground.tsx  ← fondo animado (compartido)
frontend/src/i18n/es.ts                  ← textos ES (ver HU-041)
frontend/src/i18n/en.ts                  ← textos EN (ver HU-041)
```

---

## Dependencias

- HU-037 (rutas) debe estar completa antes de esta HU
- HU-041 (i18n) se trabaja en paralelo
- `BreathingBackground.tsx` es compartido con todas las pantallas

---

## Definición de hecho

- [ ] Componente renderiza sin errores en dev y build
- [ ] Responsive validado en Chrome DevTools (375px y 1280px)
- [ ] Fondo animado visible y suave en ambos tamaños
- [ ] Switcher ES/EN funciona sin recargar página
- [ ] Sin console errors ni warnings
- [ ] Deploy en Cloud Run responde 200 en `/`

---
*Documentado: 24 de marzo de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
