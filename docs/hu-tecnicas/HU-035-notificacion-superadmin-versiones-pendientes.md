# HU-035 — Notificación en tiempo real al superadmin de versiones pendientes

**Épica:** EP-11 — Backoffice y Prompt Vault  
**Responsable:** Mauricio Roldán  
**Story Points:** 3  
**Prioridad:** Media  
**Estado:** 🔲 Pendiente  
**Sprint:** 2

---

## Historia de Usuario

**Como** Mauricio (superadmin),  
**quiero** ver una notificación visible en la app cuando Alejo propone un cambio al prompt,  
**para** no tener que abrir el panel admin manualmente para enterarme de que hay versiones pendientes de revisión.

---

## Contexto

Actualmente el badge de "⏳ pendientes" solo es visible cuando el superadmin **abre el panel admin**. Si el superadmin no abre el panel, nunca se entera de que hay una propuesta pendiente. Esto rompe el flujo de trabajo del equipo.

---

## Criterios de Aceptación

### CA-1 — Badge visible en el header del chat
- **Given** que soy superadmin y hay versiones `pending_review`
- **When** cargo la app o cuando llega una nueva propuesta
- **Then** veo un punto rojo o badge numérico sobre el ícono de administración en el header
- **And** el badge desaparece cuando no hay versiones pendientes

### CA-2 — Polling automático
- **Given** que soy superadmin y tengo la app abierta
- **When** Alejo propone un cambio desde su sesión
- **Then** en máximo 60 segundos mi app detecta la nueva versión pendiente y muestra el badge
- El polling se hace cada 60 segundos solo para usuarios con `role === 'superadmin'`

### CA-3 — Badge en el ícono del header
- El badge debe ser un punto rojo sobre el ícono de llave inglesa del header
- Si hay más de 1 pendiente, mostrar el número (ej: "2")
- El badge desaparece automáticamente cuando se aprueba o rechaza

---

## Diseño Técnico

### Frontend — polling cada 60 segundos (solo superadmin)

Agregar en `App.tsx`, dentro del `useEffect` de boot:

```typescript
// Polling de versiones pendientes para superadmin
if (role === 'superadmin') {
  const interval = setInterval(() => {
    loadVersions();
  }, 60000); // cada 60 segundos
  return () => clearInterval(interval);
}
```

### Badge visual en el header

```tsx
{/* Badge sobre ícono admin */}
<div style={{ position: 'relative' }}>
  <button onClick={...} title="Administración">
    {/* ícono llave inglesa */}
  </button>
  {pendingVersions.length > 0 && (
    <span style={{
      position: 'absolute', top: -2, right: -2,
      width: 16, height: 16, borderRadius: '50%',
      background: '#DC2626', color: 'white',
      fontSize: '9px', fontWeight: 700,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      {pendingVersions.length > 9 ? '9+' : pendingVersions.length}
    </span>
  )}
</div>
```

---

## Relación con HUs
- Depende de: **HU-034** (bug fix del propose) y **HU-033** (versionado base)
- Mejora directa de: **HU-033** CA-6 (notificaciones)

---

## Definition of Done
- [ ] Badge numérico visible en el header cuando hay versiones pendientes
- [ ] Polling cada 60 segundos solo para superadmin
- [ ] Badge desaparece al aprobar o rechazar todas las versiones
- [ ] No afecta el rendimiento ni genera requests innecesarios para usuarios `user` o `admin`

---
*Creada: 23 de marzo de 2026*  
*Autor: Claude (Tech Lead AI) + Mauricio Roldán*  
*Hallazgo durante pruebas de HU-033*
