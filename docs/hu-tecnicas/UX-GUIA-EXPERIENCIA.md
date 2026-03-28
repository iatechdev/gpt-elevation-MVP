# Elevation — Guía de Experiencia de Usuario
> Documentado: 28 de marzo de 2026

---

## Principios de diseño de Elevation

### 1. Calma ante todo
Cada pantalla debe transmitir serenidad. Sin animaciones agresivas, sin colores vibrantes, sin elementos que compitan por atención. El usuario viene a encontrar calma — la interfaz debe acompañar eso.

### 2. Fricción mínima en el camino emocional
El flujo check-in → chat → check-out debe sentirse fluido y natural. No más de 2 clicks para llegar al chat. El check-out no debe sentirse como una obligación sino como un cierre natural.

### 3. Privacidad visible
El usuario debe sentir en todo momento que sus conversaciones son privadas. Señales sutiles de encriptación, sin anuncios, sin tracking visible.

### 4. Bilingüe por defecto
Cada pantalla tiene versión ES y EN. El switch de idioma siempre visible, nunca intrusivo.

---

## Flujos de usuario

### Flujo A — Usuario nuevo
```
Landing (/) 
  → CTA "Iniciar conversación" 
  → Login → Registro 
  → Check-in emocional (/app/checkin)
  → Chat con Elevation (/app/chat)
  → Check-out (modal al hacer logout)
  → Calificación con estrellas (opcional en modal checkout)
  → Redirect a /login
```

### Flujo B — Usuario recurrente
```
Landing (/) o directo a /login
  → Login
  → Check-in emocional (obligatorio, 1 por día)
  → Chat
  → Check-out + Calificación
```

### Flujo C — Admin
```
Login 
  → Chat (con ícono de llave en header)
  → Panel admin slide-in (Sprint 3) 
  → [Sprint 4] Redirige a /admin/dashboard
```

### Flujo D — Superadmin
```
Login
  → /admin/dashboard
  → Navegación: Prompts | Contenido | Usuarios | Métricas
```

### Flujo E — Terapeuta (Sprint 4)
```
Login
  → /therapist/dashboard
  → Lista de pacientes asignados
  → Ver historial emocional de paciente
  → Ver tendencias y reportes
```

---

## Pantallas actuales (Sprint 3)

### Landing Page (/)
**Secciones:** Topbar | Hero | Proceso (3 pasos) | Beneficios | CTA Final | Footer
**Estado emocional objetivo:** Confianza, calma, curiosidad
**CTA principal:** "Iniciar conversación" → /login
**Elementos clave:** Imagen hero Unsplash, fondo animado BreathingBackground, switch ES/EN

### Login Page (/login)
**Estado emocional objetivo:** Seguridad, privacidad
**Elementos clave:** Formulario minimal, mensaje de error genérico (SEC-001), link a registro

### Check-in Page (/app/checkin)
**Estado emocional objetivo:** Introspección, apertura
**Elementos clave:** 5 emojis de estado de ánimo, botón continuar (deshabilitado hasta selección)
**UX:** El usuario debe tomarse un segundo para reconocer cómo se siente antes de chatear

### Chat Page (/app/chat)
**Estado emocional objetivo:** Escucha, presencia
**Elementos clave:** Mensajes IA en Noto Serif itálica, input minimal, scroll suave
**UX:** La IA habla diferente al usuario (tipografía distinta, borde teal)

### Check-out Modal
**Estado emocional objetivo:** Cierre, reflexión
**Elementos clave:** 5 emojis + 5 estrellas (opcionales), botón "Saltar"
**UX:** No obligatorio pero sí invitante. El modal aparece al querer cerrar sesión.

### Pricing Page (/precios)
**Estado emocional objetivo:** Claridad, confianza
**Elementos clave:** 2 planes (Free y Pro), sin precios confusos, CTA claro

---

## Pantallas Sprint 4 — Backoffice

### Admin Dashboard (/admin/dashboard)
**Audiencia:** admin, superadmin
**Contenido:**
- Cards de métricas: usuarios activos, sesiones hoy, rating promedio
- Gráfico de sesiones por día (última semana)
- Lista de versiones de prompts pendientes de aprobación
- Acceso rápido a secciones

**UX:** Diseño diferente al chat — más denso en información, sidebar de navegación, header fijo con nombre de admin.

### Admin Prompts (/admin/prompts)
**Audiencia:** admin (proponer), superadmin (aprobar/rechazar)
**Contenido:**
- Prompt activo actual (versión y fecha)
- Editor para proponer nueva versión
- Lista de versiones pendientes con botones aprobar/rechazar
- Historial de versiones con opción rollback

### Admin Contenido (/admin/contenido)
**Audiencia:** superadmin únicamente
**Contenido:**
- Tabs ES / EN
- Campos de texto editables (hero_title, hero_subtitle, ctas)
- [Sprint 4] Upload de imagen hero
- Preview de cómo se ve en la landing

### Admin Usuarios (/admin/usuarios)
**Audiencia:** superadmin únicamente
**Contenido:**
- Tabla de usuarios con: nombre, email, rol, fecha registro, última sesión, estado
- Filtros por rol y estado
- Acciones: cambiar rol, activar/desactivar
- Click en usuario → ver estadísticas detalladas

### Admin Métricas (/admin/metricas)
**Audiencia:** superadmin únicamente
**Contenido:**
- KPIs: usuarios totales, sesiones totales, rating promedio, mood improvement rate
- Gráfico: mood check-in vs checkout por día
- Gráfico: sesiones por día
- Tabla: top usuarios por actividad

### Therapist Dashboard (/therapist/dashboard)
**Audiencia:** therapist únicamente
**Contenido:**
- Lista de pacientes asignados con último mood registrado
- Click en paciente → historial emocional + ratings
- Gráfico de tendencia emocional del paciente
- Notas del terapeuta (Sprint futuro)

---

## Interacciones y microanimaciones

### Principios de animación
- Duración máxima: 300ms
- Easing: ease-out para entradas, ease-in para salidas
- Sin animaciones en loop (excepto BreathingBackground)
- Las transiciones deben sentirse como respiración, no como rebote

### Interacciones definidas
| Elemento | Interacción | Animación |
|---|---|---|
| Botón CTA | Hover | Background opacity 0.85 |
| Modal checkout | Entrada | Fade-in + scale 0.95→1 |
| Panel admin | Apertura | Slide desde derecha 300ms |
| Emojis check-in | Selección | Border teal + scale 1.05 |
| Estrellas | Hover | Scale 1.2 + color change |
| Mensajes chat | Aparición | Fade-in desde abajo |
| Cards admin | Hover | Box-shadow suave |

---

## Accesibilidad
- Contraste mínimo 4.5:1 para texto sobre fondo
- Todos los botones tienen estado focus visible
- Inputs con labels descriptivos
- Mensajes de error claros y específicos
- No depender solo del color para comunicar estado

---
*Documentado: 28 de marzo de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
