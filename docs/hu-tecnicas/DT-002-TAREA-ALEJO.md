# DT-002 — Tarea para Alejo: i18n Backoffice y Therapist

> Asignado a: Alejo
> Supervisado por: Mauro Roldán
> Sprint: 8 | 3 puntos
> Rama: `feature/mvp-elevation`

---

## ¿Qué hay que hacer?

La plataforma Elevation tiene un sistema de idiomas (español / inglés) que ya funciona en las vistas del usuario normal. Pero las vistas del **administrador** y del **terapeuta** todavía tienen los textos escritos directamente en el código (hardcodeados), sin pasar por el sistema de idiomas.

Tu tarea es conectar esas vistas al sistema de idiomas existente, siguiendo exactamente el mismo patrón que ya se usa en las otras vistas.

---

## ¿Cómo funciona el sistema de idiomas?

El sistema usa un hook llamado `useLanguage()`. Así se usa en cualquier componente:

**Paso 1 — Importar el hook al inicio del archivo:**
```tsx
import { useLanguage } from '../../i18n/useLanguage'
```

**Paso 2 — Llamar el hook dentro del componente:**
```tsx
const { t, lang } = useLanguage()
```

**Paso 3 — Reemplazar los textos fijos por la función `t()`:**
```tsx
// Antes (hardcodeado — MAL):
<h1>Admin Dashboard</h1>

// Después (con i18n — BIEN):
<h1>{t('admin_dashboard')}</h1>
```

La función `t('clave')` busca la clave en los archivos de traducción y retorna el texto en el idioma activo.

---

## Archivos de traducción

Las traducciones viven en dos archivos. Hay que agregar las claves nuevas en **ambos**:

- `frontend/src/i18n/es.ts` — textos en español
- `frontend/src/i18n/en.ts` — textos en inglés

**Ejemplo de cómo agregar una clave nueva:**

En `es.ts`, al final de la sección Admin, agregás:
```ts
admin_dashboard: 'Panel de Administración',
admin_total_users: 'Total usuarios',
```

En `en.ts`, lo mismo pero en inglés:
```ts
admin_dashboard: 'Admin Dashboard',
admin_total_users: 'Total users',
```

⚠️ Las claves deben ser **exactamente iguales** en los dos archivos. Solo cambia el texto, nunca la clave.

---

## Claves nuevas que hay que agregar

Agregá estas claves al final de la sección `// Admin` en `es.ts` y `en.ts`:

### Claves para las vistas Admin

| Clave | Español | Inglés |
|---|---|---|
| `admin_dashboard` | Panel de Administración | Admin Dashboard |
| `admin_platform_overview` | Resumen de la plataforma | Platform Overview |
| `admin_total_users` | Total usuarios | Total users |
| `admin_active_users` | Usuarios activos | Active users |
| `admin_therapists` | Terapeutas | Therapists |
| `admin_total_sessions` | Total sesiones | Total sessions |
| `admin_active_week` | Activos esta semana | Active this week |
| `admin_avg_mood` | Ánimo promedio | Avg mood |
| `admin_avg_rating` | Calificación promedio | Avg rating |
| `admin_session_activity` | Actividad de sesiones | Session activity |
| `admin_top_therapists` | Top terapeutas | Top therapists |
| `admin_alerts` | Alertas | Alerts |
| `admin_pending_prompts` | Prompts pendientes | Pending prompts |
| `admin_therapists_without_profile` | Terapeutas sin perfil | Therapists without profile |
| `admin_ethical_manifesto` | Manifiesto ético | Ethical manifesto |
| `admin_review` | Revisar | Review |
| `admin_users` | Usuarios | Users |
| `admin_content` | Contenido | Content |
| `admin_metrics` | Métricas | Metrics |
| `admin_prompts` | Prompts | Prompts |
| `admin_no_alerts` | Sin alertas activas | No active alerts |
| `admin_patients` | Pacientes | Patients |

### Claves para las vistas Therapist

| Clave | Español | Inglés |
|---|---|---|
| `therapist_my_patients` | Mis pacientes | My patients |
| `therapist_assigned` | Asignados | Assigned |
| `therapist_active_week` | Activos esta semana | Active this week |
| `therapist_avg_mood` | Ánimo promedio | Avg mood |
| `therapist_avg_rating` | Calificación promedio | Avg rating |
| `therapist_prompt` | Mi prompt terapéutico | My therapeutic prompt |
| `therapist_no_prompt` | Sin prompt activo | No active prompt |
| `therapist_view_current` | Ver prompt actual | View current prompt |
| `therapist_create_prompt` | Crear prompt | Create prompt |
| `therapist_alerts` | Alertas | Alerts |
| `therapist_no_alerts` | Sin alertas activas | No active alerts |
| `therapist_view_history` | Ver historial | View history |
| `therapist_sessions` | Sesiones | Sessions |
| `therapist_improving` | Mejorando | Improving |
| `therapist_stable` | Estable | Stable |
| `therapist_declining` | Bajando | Declining |
| `therapist_inactive` | Sin actividad | Inactive |
| `therapist_notable_progress` | Progreso notable | Notable progress |
| `therapist_patient_history` | Historia del paciente | Patient history |
| `therapist_clinical_notes` | Notas clínicas | Clinical notes |
| `therapist_ai_summary` | Resumen IA | AI Summary |
| `therapist_save_note` | Guardar nota | Save note |
| `therapist_dashboard` | Panel del terapeuta | Therapist dashboard |

---

## Vistas a actualizar (7 archivos)

### 1. `frontend/src/pages/admin/AdminDashboard.tsx`
### 2. `frontend/src/pages/admin/AdminUsers.tsx`
### 3. `frontend/src/pages/admin/AdminPrompts.tsx`
### 4. `frontend/src/pages/admin/AdminContent.tsx`
### 5. `frontend/src/pages/admin/AdminMetrics.tsx`
### 6. `frontend/src/pages/therapist/TherapistDashboard.tsx`
### 7. `frontend/src/pages/therapist/TherapistPatient.tsx`

En cada uno de estos archivos hacés lo mismo:

1. Agregás el import del hook al inicio
2. Llamás el hook dentro del componente
3. Reemplazás los textos fijos por `t('clave')`

---

## Ejemplo completo de cómo queda un archivo

**Antes:**
```tsx
export function AdminDashboard() {
  return (
    <div>
      <h1>Admin Dashboard</h1>
      <p>Platform Overview</p>
    </div>
  )
}
```

**Después:**
```tsx
import { useLanguage } from '../../i18n/useLanguage'

export function AdminDashboard() {
  const { t } = useLanguage()

  return (
    <div>
      <h1>{t('admin_dashboard')}</h1>
      <p>{t('admin_platform_overview')}</p>
    </div>
  )
}
```

---

## Reglas importantes

1. **Nunca** escribas texto visible al usuario directamente en el JSX — siempre usá `t('clave')`
2. Si encontrás un texto que no tiene clave todavía, creás la clave nueva en `es.ts` y `en.ts`
3. No cambies la lógica del componente — solo los textos
4. Un archivo a la vez — aplicás, guardás, revisás en el browser que se ve bien, seguís con el siguiente
5. Antes de hacer push, mostráselo a Mauro para que revise

---

## Cómo verificar que funciona

1. Levantás el frontend: `cd frontend && npm run dev`
2. Iniciás sesión como admin en `localhost:5173`
3. En el header del admin hay un switch ES / EN
4. Cambiás el idioma y verificás que los textos cambian
5. Si algún texto no cambia, significa que todavía está hardcodeado — hay que encontrarlo y usar `t('clave')`

---

## Checklist de entrega

- [ ] Claves nuevas agregadas en `es.ts`
- [ ] Claves nuevas agregadas en `en.ts`
- [ ] `AdminDashboard.tsx` — sin textos hardcodeados
- [ ] `AdminUsers.tsx` — sin textos hardcodeados
- [ ] `AdminPrompts.tsx` — sin textos hardcodeados
- [ ] `AdminContent.tsx` — sin textos hardcodeados
- [ ] `AdminMetrics.tsx` — sin textos hardcodeados
- [ ] `TherapistDashboard.tsx` — sin textos hardcodeados
- [ ] `TherapistPatient.tsx` — sin textos hardcodeados
- [ ] Switch ES/EN funciona en todas las vistas
- [ ] Revisado por Mauro antes del push

---

*Documentado: 5 de abril de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
