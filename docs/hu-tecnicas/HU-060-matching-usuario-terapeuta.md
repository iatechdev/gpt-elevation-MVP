# HU-060 — Matching Usuario-Terapeuta

> Sprint 7 | Must Have | 5 puntos
> Documentada: 3 de abril de 2026
> Aprobada por: Mauro Roldán
> Depende de: HU-061 (User Dashboard), HU-071 (Vista Mi terapeuta)

---

## Contexto

Hoy el admin asigna manualmente el terapeuta a cada usuario desde el backoffice. Esta HU implementa el flujo de matching inteligente donde el usuario elige su terapeuta según sus preferencias y necesidades.

El botón "Buscar mi terapeuta" ya existe en el dashboard y en la vista Mi terapeuta — esta HU le da funcionalidad real.

---

## Flujo del usuario

```
1. Usuario hace clic en "Buscar mi terapeuta" (dashboard o /app/my-therapist)
2. Se abre modal de matching
3. Usuario responde 3 preguntas de preferencias:
   - ¿Qué buscás trabajar? (ansiedad / relaciones / autoconocimiento / hábitos / otro)
   - ¿Qué enfoque preferís? (reflexivo / estructurado / espiritual / práctico)
   - ¿En qué idioma preferís sesionar? (español / inglés / ambos)
4. El sistema muestra los terapeutas que mejor coinciden (máx 3)
5. Usuario ve card de cada terapeuta con: nombre, especialidades, enfoque, idiomas, bio corta
6. Usuario elige uno → se guarda therapistId en su perfil
7. Modal cierra, dashboard muestra el nuevo terapeuta
```

---

## UI — Modal de matching

```
┌─────────────────────────────────────────────┐
│  Encontremos tu terapeuta ideal             │
│                                             │
│  ¿Qué buscás trabajar?                      │
│  [Ansiedad] [Relaciones] [Autoconocimiento] │
│  [Hábitos]  [Otro]                          │
│                                             │
│  ¿Qué enfoque preferís?                     │
│  [Reflexivo] [Estructurado]                 │
│  [Espiritual] [Práctico]                    │
│                                             │
│  ¿En qué idioma?                            │
│  [Español] [Inglés] [Ambos]                 │
│                                             │
│  [Buscar →]                                 │
└─────────────────────────────────────────────┘

── Resultados ──
┌──────────────────────────────────────────┐
│ [M]  Mauro Roldán                        │
│      Mindfulness · TCC                   │
│      "Mi enfoque es..."                  │
│      [Elegir este terapeuta]             │
└──────────────────────────────────────────┘
```

---

## Backend

### Endpoint 1 — Buscar terapeutas compatibles
```
POST /api/matching/search
Body: { topics: string[], approach: string, language: string }
Retorna: [{ id, name, email, profile: { specialties, approach, languages, bio } }]
```

Lógica de matching (simple para MVP):
- Filtra terapeutas activos con TherapistProfile
- Prioriza por coincidencia de idioma (exacta)
- Prioriza por coincidencia de approach en specialties
- Máximo 3 resultados

### Endpoint 2 — Confirmar selección
```
POST /api/matching/select
Body: { therapistId: number }
Actualiza: User.therapistId del usuario autenticado
Retorna: { message, therapistName }
```

---

## Criterios de aceptación

- [ ] Modal de matching abre desde dashboard y desde /app/my-therapist
- [ ] Usuario puede seleccionar sus preferencias (topics, approach, language)
- [ ] Sistema muestra máx 3 terapeutas compatibles con su perfil
- [ ] Usuario puede elegir un terapeuta y queda asignado
- [ ] Dashboard y Mi terapeuta se actualizan tras la selección
- [ ] Si no hay terapeutas compatibles: mensaje apropiado

---
*Documentada: 3 de abril de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
