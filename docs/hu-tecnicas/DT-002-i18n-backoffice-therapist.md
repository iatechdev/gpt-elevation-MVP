# DT-002 — i18n Completo: Backoffice y Therapist Views

> Sprint 7 | Should Have | 3 puntos
> Documentada: 3 de abril de 2026
> Aprobada por: Mauro Roldán

---

## Contexto

El sistema de i18n (ES/EN) funciona correctamente en las vistas de usuario (`UserDashboard`, `MyTherapist`, `LandingPage`, `LoginPage`). Las vistas de backoffice y terapeuta tienen todos los textos hardcodeados en inglés.

Esta deuda técnica extiende el sistema i18n existente (`useLanguage()`, `es.ts`, `en.ts`) a las vistas que aún no lo usan.

---

## Vistas a actualizar

**Backoffice admin:**
- `AdminDashboard.tsx`
- `AdminUsers.tsx`
- `AdminPrompts.tsx`
- `AdminContent.tsx`
- `AdminMetrics.tsx`

**Therapist:**
- `TherapistDashboard.tsx`
- `TherapistPatient.tsx`

---

## Claves a agregar en es.ts y en.ts

**Admin:**
```
admin_dashboard, admin_platform_overview, admin_total_users,
admin_active_users, admin_therapists, admin_total_sessions,
admin_active_week, admin_avg_mood, admin_avg_rating,
admin_session_activity, admin_top_therapists, admin_alerts,
admin_pending_prompts, admin_therapists_without_profile,
admin_ethical_manifesto, admin_review
```

**Therapist:**
```
therapist_my_patients, therapist_assigned, therapist_active_week,
therapist_avg_mood, therapist_avg_rating, therapist_prompt,
therapist_no_prompt, therapist_view_current, therapist_create_prompt,
therapist_alerts, therapist_no_alerts, therapist_view_history,
therapist_sessions, therapist_improving, therapist_stable,
therapist_declining, therapist_inactive, therapist_notable_progress
```

---

## Archivos a modificar

- `frontend/src/i18n/es.ts` — agregar claves admin + therapist
- `frontend/src/i18n/en.ts` — agregar claves admin + therapist
- `frontend/src/pages/admin/AdminDashboard.tsx` — usar `useLanguage()`
- `frontend/src/pages/admin/AdminUsers.tsx` — usar `useLanguage()`
- `frontend/src/pages/admin/AdminPrompts.tsx` — usar `useLanguage()`
- `frontend/src/pages/admin/AdminContent.tsx` — usar `useLanguage()`
- `frontend/src/pages/admin/AdminMetrics.tsx` — usar `useLanguage()`
- `frontend/src/pages/therapist/TherapistDashboard.tsx` — usar `useLanguage()`
- `frontend/src/pages/therapist/TherapistPatient.tsx` — usar `useLanguage()`

---

## Criterios de aceptación

- [ ] Todas las vistas admin responden al cambio de idioma ES/EN
- [ ] Todas las vistas therapist responden al cambio de idioma ES/EN
- [ ] No hay textos hardcodeados en ninguna de las vistas listadas
- [ ] El switch de idioma en el header del admin y therapist funciona

---
*Documentada: 3 de abril de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
