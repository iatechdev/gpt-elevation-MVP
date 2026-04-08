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

### Causas raiz resueltas (cronologia del debugging)
1. `backend/message.js` en minuscula — Linux es case-sensitive, Windows no
   - Fix: crear `backend/Message.js` con M mayuscula
2. `VITE_BACKEND_URL` en cloudbuild.yaml tenia URL vieja de Cloud Run
   - Fix: actualizar a `https://elevation-mvp-747531656650.us-central1.run.app`
3. `DB_HOST` configurado con region incorrecta `us-central1` en lugar de `us-south1`
   - Fix: cambiar a `/cloudsql/eleveation-490611:us-south1:elevation-bd`

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

## Pendiente Sprint 9

### Proximo a trabajar

1. HU-067 — Videollamada Daily.co (8 pts) — requiere cuenta Daily.co y DAILY_API_KEY
2. HU-068 — Google Calendar sync (5 pts)

### BD — Pendiente (ejecutar en Cloud SQL Studio)
```sql
INSERT INTO "PromptVaults" (key, content, version, status, "isActive", "createdAt", "updatedAt")
VALUES (
  'elevation_system_prompt',
  'You are Elevation, an empathetic emotional wellness companion. You listen actively, ask reflective questions, and provide warm support. You never replace professional therapy but you accompany the user with care.',
  1, 'active', true, NOW(), NOW()
);
```

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

---

*Actualizado: 8 de abril de 2026 — Claude (Tech Lead AI) + Mauro Roldan*
