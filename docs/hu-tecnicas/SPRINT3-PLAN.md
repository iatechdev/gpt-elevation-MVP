# Elevation — Plan Sprint 3
> Documentado: 25 de marzo de 2026 | Decisión arquitectónica aprobada por Mauro Roldán

---

## 🎯 Objetivo principal del Sprint 3

Separar la **landing pública de marketing** de la **app protegida**, mejorando seguridad y conversión. Hoy la app expone el login directamente como primera pantalla — eso debe cambiar.

---

## 🏗️ Arquitectura objetivo

### Estructura de rutas (React Router)

```
/                 → Landing pública (sin autenticación requerida)
/login            → Login / Registro
/app              → App protegida — requiere token válido
/app/checkin      → Check-in de ánimo
/app/chat         → Chat con Elevation IA
```

### Flujo de usuario

```
Usuario nuevo:
Landing (/) → Empezar → /login (registro) → /app/checkin → /app/chat

Usuario existente:
/login → /app/chat (si ya hizo checkin hoy)

Bot / atacante:
Solo ve la landing pública — el login está en ruta separada y protegida por rate limiting
```

---

## 🔐 Beneficios de seguridad

| Problema actual | Solución Sprint 3 |
|---|---|
| Login expuesto como primera pantalla | Landing pública como puerta de entrada |
| Bots pueden atacar /login directo sin fricción | Rate limiting + CAPTCHA opcional en /login |
| No hay contexto para usuarios nuevos | Landing explica el producto antes del registro |
| SEC-001: User Enumeration | Mensaje genérico + rate limiting por IP |

---

## 📱 Landing pública — Secciones (basado en prototipo aprobado)

Referencia visual: prototipo Google AI Studio (Gemini) aprobado por Mauro Roldán el 25/03/2026.

### Sección 1 — Hero
- Badge: *"Soporte Emocional con IA"*
- Título: *"Encuentra tu calma interior en cada conversación"*
- Subtítulo: *"Elevation es tu compañero privado de IA para la claridad mental..."*
- CTAs: **Iniciar Conversación** | Ver cómo funciona
- Imagen: fotografía lifestyle (persona en calma/naturaleza)

### Sección 2 — El Proceso (3 pasos)
- **Check-in** — Comparte cómo te sientes
- **Charla Guiada** — Diálogo terapéutico basado en evidencia
- **Reflexiona y Crece** — Sigue tus tendencias emocionales

### Sección 3 — ¿Por qué elegir Elevation?
- 🔒 Privado y Seguro — conversaciones encriptadas
- ⏰ Disponibilidad 24/7
- 🧬 Basado en Evidencia — TCC, DBT, mindfulness

### Sección 4 — CTA Final
- Fondo verde esmeralda
- *"¿Listo para encontrar tu enfoque?"*
- Botones: **Empezar** | Ver precios
- Nota: *"Sin tarjeta de crédito. Cancela en cualquier momento."*

### Sección 5 — Footer
- Logo + tagline
- Columnas: Producto / Recursos / Empresa
- Disclaimer legal de salud mental

---

## 🛠️ Stack técnico

- **Routing:** React Router v6 (`react-router-dom`)
- **Estilos:** Tailwind CSS (ya instalado) + estilos inline consistentes con design system actual
- **Animaciones:** CSS transitions (sin dependencias nuevas para MVP)
- **Imágenes:** Unsplash free tier o assets propios
- **CMS:** Backoffice propio (panel admin) — el contenido de la landing se gestiona desde el mismo backoffice de Elevation, no se requiere CMS externo para el MVP

---

## 📋 Historias de Usuario Sprint 3

### Must Have
| HU | Nombre | Puntos | Descripción |
|---|---|---|---|
| HU-036 | Landing pública | 8 | Página de marketing en ruta `/` con todas las secciones del prototipo |
| HU-037 | Refactor de rutas | 5 | React Router — separar `/`, `/login`, `/app` |
| HU-038 | SEC-001 fix — Mensaje genérico login | 2 | Unificar errores de login + rate limiting por IP |

### Should Have
| HU | Nombre | Puntos | Descripción |
|---|---|---|---|
| HU-039 | Gestión de contenido landing desde backoffice | 5 | Admin puede editar textos clave de la landing desde el panel |
| HU-040 | Página de precios | 3 | Sección de planes/precios enlazada desde la landing |
| HU-022 | Calificación con estrellas | 2 | Pendiente desde Sprint 1 |
| HU-021 | Check-out de ánimo (persistir en BD) | 3 | Completar tabla mood_logs |

### Nice to Have
| HU | Nombre | Puntos | Descripción |
|---|---|---|---|
| HU-041 | Soporte multi-idioma (ES/EN) | 5 | i18n básico para landing |
| HU-035 | Polling automático badge superadmin | 2 | Pendiente desde Sprint 2 |
| HU-023 | Búsqueda de reflexiones | 3 | Pendiente desde Sprint 1 |

---

## 🔧 Decisiones técnicas tomadas

1. **La landing vive en el mismo repo** — no se crea un proyecto separado. Más fácil de mantener y deployar en conjunto en Cloud Run.
2. **El CMS es el backoffice propio** — no se integra Contentful, Sanity ni Webflow. El admin puede editar textos desde el panel de Elevation.
3. **El login NO es la primera pantalla** — la landing actúa como puerta de entrada y contexto para usuarios nuevos.
4. **Seguridad por capas:** Landing pública → Login con rate limiting → App protegida con JWT.

---

## 📅 Timeline sugerido Sprint 3

```
Día 1-2: HU-037 Refactor rutas (React Router)
Día 2-3: HU-036 Landing pública (hero + 3 secciones)
Día 3:   HU-038 SEC-001 fix
Día 4:   HU-039 Gestión contenido desde backoffice
Día 4-5: HU-040 Página de precios + pruebas
Día 5:   Deploy + QA completo
```

---
*Documentado: 25 de marzo de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
