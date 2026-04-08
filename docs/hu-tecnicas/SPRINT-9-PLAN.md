# Sprint 9 — Videollamadas + Planes + Limitacion de usuarios

> Estado: EN PROGRESO
> Fecha inicio: 6 de abril de 2026
> Documentado por: Claude (Tech Lead AI) + Mauro Roldan

---

## Contexto

Sprint 8 cerrado con 17/20 puntos (DT-002 en progreso con Alejo).

Las grandes features pendientes son:
1. Videollamadas con Daily.co
2. Google Calendar sync
3. Sistema de planes y limitacion de usuarios por plan
4. Modal matching completo

---

## HUs del Sprint 9

| HU | Descripcion | Pts | Prioridad | Estado |
|---|---|---|---|---|
| HU-077 | Sistema de planes y limitacion de usuarios | 5 | Critico | COMPLETADO |
| HU-073 | Modal matching completo | 2 | Normal | COMPLETADO |
| HU-067 | Videollamada Daily.co integrada | 8 | Alto | COMPLETADO |
| HU-068 | Google Calendar sync | 5 | Alto | Pendiente |

**Puntos completados Sprint 9: 15/20**

---

## DEPLOY + LOGIN 100% FUNCIONAL EN PRODUCCION ✅ (08/04/2026)

**URL:** https://elevation-mvp-747531656650.us-central1.run.app

### Variables de entorno Cloud Run (configuracion final correcta)
| Variable | Valor |
|---|---|
| ANTHROPIC_API_KEY | sk-ant-... |
| DB_USER | postgres |
| DB_PASS | ... |
| DB_HOST | /cloudsql/eleveation-490611:us-south1:elevation-bd |
| DB_NAME | elevation |
| DB_PORT | 5432 |
| JWT_SECRET | ... |
| PROMPT_ENCRYPTION_KEY | ... |
| GCS_BUCKET_NAME | elevation-therapist-docs |
| GCS_KEY_FILE | ./gcs-credentials.json |
| FRONTEND_URL | https://elevation-mvp-747531656650.us-central1.run.app |
| DAILY_API_KEY | pendiente — Alejo gestiona con cliente |

### Conexion Cloud SQL
- Instancia registrada en Cloud Run: `eleveation-490611:us-south1:elevation-bd`
- Conexion via Cloud SQL Auth Proxy (socket unix — sin IP publica expuesta)
- DB_HOST usa el path del socket: `/cloudsql/eleveation-490611:us-south1:elevation-bd`
- **IMPORTANTE:** La BD esta en `us-south1`, no en `us-central1` — el path debe reflejar esto

### Stack de deploy (comandos definitivos)
```cmd
git pull origin feature/mvp-elevation
gcloud builds submit --config cloudbuild.yaml --project eleveation-490611
gcloud run deploy elevation-mvp --image gcr.io/eleveation-490611/elevation-mvp --platform managed --region us-central1 --allow-unauthenticated --project eleveation-490611
```

---

## Avances sesion 06/04/2026

### AdminPrompts.tsx — COMPLETADO
### AdminMetrics.tsx — COMPLETADO
### Flujo completo prompts terapeuta — COMPLETADO
### Manifiesto Etico — COMPLETADO
### Deuda naming App.tsx + AdminSidebar — COMPLETADO

---

## Avances sesion 07-08/04/2026

### HU-077 — Sistema de planes y solicitudes — COMPLETADO
### HU-073 — Modal matching completo — COMPLETADO
### Errores TS — CORREGIDOS

---

## Avances sesion 08/04/2026 (tarde)

### AdminPrompts — Creacion de prompts desde admin/superadmin — COMPLETADO
### LoginPage — Design system tokens — COMPLETADO
### Auth — Ciclo de vida de usuario — COMPLETADO
### Eliminacion de usuarios — COMPLETADO
### Mood labels — COMPLETADO

---

## Avances sesion 08/04/2026 (noche)

### BUG CRITICO — Chat caido en produccion — RESUELTO
- Error: AuthenticationError 401 invalid x-api-key en /api/chat
- Causa: ANTHROPIC_API_KEY invalida/vencida en Cloud Run
- Solucion: regenerar key en console.anthropic.com + redeploy con nueva revision en Cloud Run
- Chat funcionando correctamente post-fix

### HU-067 — Videollamada Daily.co — COMPLETADO
Archivos entregados:
- `backend/routes/sessions.js` — 3 endpoints nuevos:
  - POST /api/sessions/therapist/:id/start — crea sala Daily.co (mock si no hay DAILY_API_KEY)
  - POST /api/sessions/therapist/:id/end — cierra sesion, guarda nota + mood, genera recomendacion IA
  - GET /api/sessions/user/:id/join — retorna meetingUrl al paciente (valida ownership)
- `frontend/src/pages/therapist/SessionRoom.tsx` — sala completa: iframe Daily.co + sidebar notas en vivo (auto-save 2s) + timer + modal checkout con mood selector
- `frontend/src/pages/user/SessionRoom.tsx` — vista paciente: iframe + estados (esperando/conectando)
- `frontend/src/App.tsx` — rutas nuevas: /therapist/session/:id (fuera de TherapistLayout — full screen) + /app/session/:id
- `frontend/src/pages/therapist/TherapistDashboard.tsx` — seccion "Proximas sesiones" + boton "Iniciar sesion" en card de paciente
- `frontend/src/pages/therapist/TherapistPatient.tsx` — boton "Agendar sesion" + modal con datetime-local + selector duracion (30/45/50/60/90 min)

Logica del boton videollamada en UserDashboard:
- status in_progress → boton verde "Entrar a videollamada" activo → navega a /app/session/:id
- scheduled + menos de 15 min → boton amarillo "La sesion esta por comenzar" → navigable
- scheduled + mas de 15 min → mensaje informativo, sin boton clickeable

DAILY_API_KEY: modo mock activo (genera URL simulada) hasta que Alejo entregue key real del cliente.
Cuando llegue la key: agregarla en Cloud Run como variable DAILY_API_KEY y hacer redeploy.

### DT-002 — i18n backoffice y terapeuta — COMPLETADO (merge commit Alejo 28c2088)
- 49 claves nuevas en es.ts y en.ts (Admin + Therapist)
- AdminDashboard, AdminUsers, AdminContent, AdminMetrics, AdminPrompts — useLanguage() aplicado
- TherapistDashboard, TherapistPatient — claves disponibles

### TherapistPatient.tsx — Design system tokens — COMPLETADO
- Migrado completamente a tokens.ts (colors, radius, shadow, spacing, typography)
- btnPrimaryStyle / btnSecondaryStyle importados desde tokens
- Textos traducidos al espanol (coherente con UX del terapeuta)
- Cards, inputs, selects y modales con estilos unificados del DS

### Dominio elevation-ia.com — EN PROCESO
- Dominio comprado en GoDaddy
- Pendiente: configurar Domain Mapping en Cloud Run + registros DNS en GoDaddy
- Guia entregada: registros A + AAAA de Google + CNAME www

---

## Pendiente Sprint 9

### Proximo a trabajar
1. HU-068 — Google Calendar sync (5 pts) — requiere Google OAuth configurado en GCP
2. Dominio elevation-ia.com — configuracion DNS + Domain Mapping Cloud Run
3. DAILY_API_KEY — agregar cuando Alejo entregue key del cliente

### Deuda tecnica pendiente
- GCS_KEY_FILE apunta a ./gcs-credentials.json — resolver con Secret Manager
- backend/message.js (minuscula) es archivo zombie — limpiar en proximo sprint
- Seguridad BD: evaluar mover instancia a us-central1 para usar Cloud SQL Proxy correctamente
- i18n terapeuta: aplicar claves DT-002 en componentes (claves ya existen en es.ts/en.ts)

---

## Decisiones de arquitectura confirmadas

- VITE_BACKEND_URL (no VITE_API_URL) — variable de entorno del frontend
- Board = rol etico independiente, no superadmin
- Planes pricing: Basico $0 / Esencial $12 / Plus $29 / Pro $59 USD
- Naming: archivos, rutas URL y codigo fuente siempre en ingles
- Linux es case-sensitive — todos los require() deben coincidir exactamente con el nombre del archivo
- DB en us-south1 — DB_HOST debe usar `/cloudsql/eleveation-490611:us-south1:elevation-bd`
- Cloud SQL Auth Proxy via socket (no IP publica) — seguro para produccion
- Deploy: Cloud Build + Cloud Run, imagen en gcr.io/eleveation-490611/elevation-mvp
- Usuario desactivado puede reactivarse registrandose con el mismo email
- Eliminacion fisica solo para superadmin, con confirmacion por nombre exacto
- SessionRoom del terapeuta va fuera de TherapistLayout (pantalla completa sin sidebar)
- DAILY_API_KEY ausente activa modo mock automaticamente — no rompe el flujo
- Matching: admin aprueba la asignacion, terapeuta ve nuevo paciente en su lista
- Dominio: elevation-ia.com (GoDaddy) → Cloud Run Domain Mapping con HTTPS automatico de Google

---

*Actualizado: 8 de abril de 2026 (sesion noche) — Claude (Tech Lead AI) + Mauro Roldan*
