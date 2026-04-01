# Elevation — Handoff de Sesión
> Última actualización: 1 de abril de 2026
> Para usar al inicio de cada nueva conversación con Claude

---

## CÓMO ARRANCAR UNA NUEVA SESIÓN

Decile esto a Claude al abrir una nueva conversación:

---

*"Hola Claude, somos el equipo de Elevation. Soy Mauro Roldán, Tech Lead del proyecto. Trabajamos juntos en el desarrollo del MVP de Elevation, una plataforma de bienestar integral. Antes de arrancar necesito que leas estos archivos del repositorio `iatechdev/gpt-elevation-MVP` para ponerte en contexto:*

*1. `docs/hu-tecnicas/SPRINT-STATUS.md` (rama main) — estado actual del proyecto*
*2. `docs/hu-tecnicas/HU-045-gestion-usuarios-backoffice.md` (rama main) — la HU que vamos a desarrollar hoy*
*3. `docs/hu-tecnicas/VISION-PRODUCTO.md` (rama main) — visión del producto*

*Nuestro flujo de trabajo:*
- *Vos (Claude) sos el Tech Lead AI — definís arquitectura, revisás código, tomás decisiones*
- *Yo aplico los cambios en VS Code y pruebo en el browser*
- *Trabajamos archivo por archivo, uno a la vez*
- *Comunicación en español colombiano informal*
- *Rama de desarrollo: `feature/mvp-elevation`*
- *Rama de docs: `main`*

*Por favor leé esos tres archivos y confirmame que estás listo para arrancar con HU-045."*

---

## ESTADO ACTUAL DEL PROYECTO

### Sprint 4 — EN CURSO

| HU | Nombre | Estado |
|---|---|---|
| HU-044 | Refactor backoffice rutas /admin | ✅ COMPLETADA |
| HU-045 | Gestión y creación de usuarios | 🔄 SIGUIENTE |
| HU-046 | Rol therapist + dashboard básico | 📋 Documentada |
| HU-047 | Dashboard de métricas | 📋 Documentada |
| HU-048 | Contenido páginas públicas + precios | 📋 Documentada |

### Lo que está funcionando en local
- Login con JWT y roles (user / admin / superadmin)
- Al hacer login: admin/superadmin → `/admin/dashboard`, user → `/app/checkin`
- Backoffice con header fijo + sidebar con lógica de rol
- Sidebar muestra "Usuarios" solo para superadmin
- 5 páginas placeholder: Dashboard, Prompts, Content, Users, Metrics
- Chat con IA (Claude Haiku), check-in/check-out emocional
- Sistema de versionado de prompts con aprobación
- Landing editable desde backoffice

### Stack técnico
- **Frontend:** React + TypeScript + Vite — rama `feature/mvp-elevation`
- **Backend:** Express + Sequelize + PostgreSQL
- **IA:** Anthropic Claude API (claude-3-haiku-20240307)
- **Deploy:** Google Cloud Run (elevation-490611)
- **Repo:** github.com/iatechdev/gpt-elevation-MVP

### Archivos clave del Sprint 4 creados
```
frontend/src/layouts/AdminLayout.tsx
frontend/src/components/AdminSidebar.tsx
frontend/src/pages/admin/AdminDashboard.tsx
frontend/src/pages/admin/AdminPrompts.tsx
frontend/src/pages/admin/AdminContent.tsx
frontend/src/pages/admin/AdminUsers.tsx
frontend/src/pages/admin/AdminMetrics.tsx
```

### Archivos modificados en Sprint 4
```
frontend/src/App.tsx — rutas /admin/* con guards
frontend/src/pages/LoginPage.tsx — redirect por rol post-login
```

---

## REGLAS DE TRABAJO

1. **Un archivo a la vez** — nunca dar múltiples archivos juntos
2. **Código completo** — siempre el archivo completo, no diffs parciales
3. **Probar antes de continuar** — Mauro prueba en el browser después de cada cambio
4. **Decisiones primero, código después** — explicar el porqué antes de implementar
5. **Documentar en main antes de implementar** — toda HU documentada en `docs/hu-tecnicas/`
6. **El humano siempre en el loop** — lección del BUG-001
7. **Claude.ai define, Mauro aplica** — no delegamos ejecución ciega a herramientas

---

## DISEÑO SYSTEM (resumen)

```css
--elevation-bg:        #f9f9f7;  /* Fondo principal */
--elevation-surface:   #FAF8F4;  /* Cards */
--elevation-olive:     #6B7D5C;  /* CTA principal */
--elevation-olive-lt:  #A8B5A2;  /* Accents */
--elevation-olive-bg:  #EAF0E6;  /* Fondos sutiles */
--elevation-text-1:    #1C1917;  /* Texto principal */
--elevation-text-2:    #78716C;  /* Texto secundario */
--elevation-teal:      #0d9488;  /* Mensajes IA */
--admin-bg:            #F5F3EF;  /* Fondo backoffice */
--admin-sidebar:       #EDEAE4;  /* Sidebar backoffice */

/* Tipografía */
Títulos: Playfair Display, font-weight 300
UI: Inter, 400/500/600
IA: Noto Serif italic

/* Componentes */
Border: 0.5px solid #E7E5E4
Border-radius cards: 1rem
Border-radius botones: 0.85rem
Sombra: 0 2px 12px rgba(26,28,27,0.06)
```

---

## DOCUMENTACIÓN DISPONIBLE EN REPO (rama main)

### Producto
- `docs/hu-tecnicas/VISION-PRODUCTO.md`
- `docs/hu-tecnicas/JUNTA-ELEVATION-ETICA.md`
- `docs/hu-tecnicas/ONBOARDING-USUARIO.md`

### Sprint 4
- `docs/hu-tecnicas/SPRINT-STATUS.md` ← leer siempre al inicio
- `docs/hu-tecnicas/HU-044-refactor-backoffice-rutas-admin.md` ✅
- `docs/hu-tecnicas/HU-045-gestion-usuarios-backoffice.md` ← siguiente
- `docs/hu-tecnicas/HU-046-rol-therapist-dashboard.md`
- `docs/hu-tecnicas/HU-048-sistema-contenido-paginas-publicas.md`

### Diseño
- `docs/hu-tecnicas/DESIGN-SYSTEM.md`
- `docs/mockups/` ← mockups Sprint 4 de Manus
- `docs/mockups/sprint5-6/` ← mockups Sprint 5 y 6 de Manus

---

## SOBRE EL REPOSITORIO

- **Rama activa de desarrollo:** `feature/mvp-elevation`
- **Rama de documentación:** `main`
- **Los docs en main NO están en local** — hacer `git fetch + pull main` si se necesitan
- **Commits van a `feature/mvp-elevation`**
- **Al final del Sprint 4 → Pull Request de feature → main**

---
*Actualizado: 1 de abril de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
