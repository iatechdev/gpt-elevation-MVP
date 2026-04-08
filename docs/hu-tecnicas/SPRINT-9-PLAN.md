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
| HU-067 | Videollamada Daily.co integrada | 8 | Alto | Pendiente |
| HU-068 | Google Calendar sync | 5 | Alto | Pendiente |

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
- Boton "+ Nuevo prompt" visible para ambos roles
- Superadmin crea y activa directo via POST /api/admin/prompt
- Admin propone via POST /api/admin/prompt/propose (requiere aprobacion)
- Key predefinido: elevation_system_prompt (Elevation — Prompt General)
- Panel "Contenido activo" al seleccionar prompt — muestra texto desencriptado con colapso/expansion
- Fix BD: UPDATE status = 'active' para elevation_system_prompt que estaba en 'approved'

### LoginPage — Design system tokens — COMPLETADO
- Todos los colores hardcodeados migrados a tokens.ts
- inputStyle extraido como constante local
- Sin cambios funcionales

### Auth — Ciclo de vida de usuario definido e implementado — COMPLETADO
Definicion de estados:
- Activo (active: true): puede hacer login normalmente
- Desactivado (active: false): NO puede hacer login, SI puede reactivarse registrandose de nuevo
- Eliminado (destroy()): borrado fisico permanente, solo superadmin

Cambios en backend/routes/auth.js:
- POST /api/register: si email existe con active=false, reactiva el usuario con nuevos datos (nombre + password)
- POST /api/login: bloquea usuarios con active=false con mensaje que indica como reactivarse
- Validacion de campos vacios en register

### Eliminacion de usuarios — COMPLETADO
- DELETE /api/admin/usuarios/:id — solo superadmin
- Protecciones: no puede eliminar su propio usuario, no puede eliminar otro superadmin
- Frontend: boton "Eliminar permanentemente" solo visible para superadmin en panel lateral
- Modal de confirmacion con triple friccion: muestra nombre+email, requiere escribir nombre exacto para habilitar boton

### Mood labels — COMPLETADO
- Textos de emociones actualizados en es.ts y en.ts
- ES: Muy mal / No tan bien / Neutral / Bien / Muy bien
- EN: Very bad / Not so good / Neutral / Good / Very good
- Subido directamente al repo por Claude

---

## Pendiente Sprint 9

### Proximo a trabajar

1. HU-067 — Videollamada Daily.co (8 pts) — requiere DAILY_API_KEY lista
2. HU-068 — Google Calendar sync (5 pts)

### Deuda tecnica pendiente
- GCS_KEY_FILE apunta a ./gcs-credentials.json — resolver con Secret Manager
- backend/message.js (minuscula) es archivo zombie — limpiar en proximo sprint
- Seguridad BD: evaluar mover instancia a us-central1 para usar Cloud SQL Proxy correctamente

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

---

*Actualizado: 8 de abril de 2026 (sesion tarde) — Claude (Tech Lead AI) + Mauro Roldan*
