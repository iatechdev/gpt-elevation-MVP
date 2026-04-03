# HU-073 — Modal de Matching desde Dashboard y Onboarding

> Sprint 8 | Must Have | 4 puntos
> Documentada: 3 de abril de 2026
> Aprobada por: Mauro Roldán
> Depende de: HU-072 (Onboarding), HU-060 (Matching backend)

---

## Contexto

El botón "Buscar mi terapeuta" ya existe en:
- `UserDashboard.tsx` — widget "Próxima sesión" cuando no tiene terapeuta
- `MyTherapist.tsx` — estado sin terapeuta
- `Onboarding.tsx` — paso 5, opción A

Hoy el botón no hace nada funcional. Esta HU implementa el modal completo
de matching que se abre desde cualquiera de estos puntos.

---

## Flujo del modal

```
1. Usuario hace clic en "Buscar mi terapeuta"
2. Se abre modal con 3 preguntas:
   - ¿Qué querés trabajar? (chips de selección)
   - ¿Qué enfoque preferís? (chips de selección)
   - ¿En qué idioma? (chips de selección)
3. Usuario hace clic en "Buscar →"
4. POST /api/matching/request → retorna hasta 3 terapeutas
5. Modal muestra cards de terapeutas con nombre, especialidades, bio
6. Usuario elige uno → POST /api/matching/choose
7. Modal muestra confirmación "¡Terapeuta elegido! El equipo lo confirmará pronto."
8. Modal cierra → dashboard se actualiza
```

---

## UI — Modal

```
┌─────────────────────────────────────────┐
│  Encontremos tu terapeuta ideal    [✕]  │
│                                         │
│  ¿Qué querés trabajar?                  │
│  [Ansiedad] [Relaciones] [Hábitos]      │
│  [Autoconocimiento] [Otro]              │
│                                         │
│  ¿Qué enfoque preferís?                 │
│  [Reflexivo] [Estructurado]             │
│  [Espiritual] [Práctico]               │
│                                         │
│  ¿En qué idioma?                        │
│  [Español] [Inglés] [Ambos]             │
│                                         │
│  [Buscar →]                             │
└─────────────────────────────────────────┘

── Resultados ──
┌─────────────────────────────────────────┐
│ [M]  Mauro Roldán                       │
│      Mindfulness · TCC                  │
│      "Mi enfoque es..."                 │
│      [Elegir este terapeuta]            │
└─────────────────────────────────────────┘
```

---

## Endpoints reutilizados (ya existen)

```
POST /api/matching/request
Body: { answers: { area, style, language } }
Retorna: { requestId, suggestions: [{ therapistId, therapistName, score, reason }] }

POST /api/matching/choose
Body: { requestId, therapistId }
Retorna: { message }
```

---

## Archivos a modificar

- `frontend/src/pages/UserDashboard.tsx` — conectar botón al modal
- `frontend/src/pages/MyTherapist.tsx` — conectar botón al modal
- `frontend/src/pages/Onboarding.tsx` — paso 5 opción A abre modal
- `frontend/src/components/MatchingModal.tsx` — componente nuevo reutilizable

## Decisión técnica

Crear `MatchingModal.tsx` como componente independiente para poder
reutilizarlo desde los 3 puntos de entrada sin duplicar código.

---

## Criterios de aceptación

- [ ] Modal abre desde UserDashboard, MyTherapist y Onboarding (paso 5)
- [ ] Usuario puede seleccionar preferencias y buscar
- [ ] Se muestran hasta 3 terapeutas compatibles con su perfil
- [ ] Usuario puede elegir un terapeuta
- [ ] Confirmación visible tras la elección
- [ ] Dashboard se actualiza para reflejar el terapeuta elegido
- [ ] Si no hay terapeutas disponibles: mensaje apropiado

---
*Documentada: 3 de abril de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
