# Elevation — Onboarding del Usuario Final
> Documentado: 30 de marzo de 2026
> Autor: Claude (Tech Lead AI) + Mauro Roldán

---

## ¿Qué es el onboarding de Elevation?

Cuando un usuario se registra en Elevation por primera vez, no va directo al chat. Pasa por un flujo de onboarding que permite a la plataforma entender qué necesita esa persona y cómo acompañarla mejor.

Este onboarding define:
1. Las áreas de bienestar de interés
2. Los temas específicos que quiere trabajar
3. Si prefiere trabajar solo con la IA o también con un terapeuta
4. La demanda o intención principal con la que llega a Elevation

---

## El flujo paso a paso

### Paso 1 — Bienvenida
```
┌────────────────────────────────────────┐
│                                        │
│  Bienvenido/a a Elevation              │
│                                        │
│  Antes de empezar, quéremos conocerte  │
│  un poco para acompañarte mejor.       │
│  Solo tomará 2 minutos.                │
│                                        │
│  [Empezar]                             │
└────────────────────────────────────────┘
```

### Paso 2 — Áreas de bienestar
Selección múltiple — el usuario elige todas las que le interesan:

```
¿En qué áreas de tu vida querés trabajar?
(Podés elegir varias)

🦴 Bienestar psicológico
   Emociones, ansiedad, autoestima, relaciones

🏋️ Bienestar físico
   Cuerpo, hábitos, sueño, energía

💛 Bienestar sexual
   Sexualidad, intimidad, vínculo, deseo

🎯 Desarrollo personal
   Metas, disciplina, motivación, propósito

👩‍👩‍👦 Relaciones y vínculos
   Pareja, familia, amistades, comunicación

💼 Bienestar laboral
   Estrés laboral, límites, equilibrio vida-trabajo
```

### Paso 3 — Temas específicos
Según lo que eligió en el paso 2, se muestran temas relevantes:

```
¿Qué querés explorar en tu bienestar psicológico?

— Manejar la ansiedad y el estrés
— Mejorar mi autoestima
— Procesar una pérdida o duelo
— Entender mis emociones
— Mejorar mis relaciones
— Superar miedos o bloqueos
— Otro (campo libre)
```

### Paso 4 — Intención principal
```
¿Qué te trajo a Elevation hoy?
(Escribílo con tus palabras — esto es solo para nosotros)

[Campo de texto libre]

Esto nos ayuda a personalizar tu experiencia.
Nadie más que vos y tu terapeuta (si tenés uno) lo verán.
```

### Paso 5 — Preferencia de acompañamiento
```
¿Cómo querés trabajar en Elevation?

🤖 Solo con la IA de Elevation
   Conversaciones privadas, disponibles 24/7
   Sin terapeuta asignado

👩‍⚕️ Con un terapeuta + la IA
   Un profesional te acompaña y guía tu proceso
   La IA trabaja bajo el enfoque de tu terapeuta

🤔 No sé todavía
   Empiezo con la IA y después decido
```

### Paso 6 — Resumen y confirmación
```
Esto es lo que sabemos de vos:

🎯 Tu interés principal: Bienestar psicológico
📝 Querés trabajar: Ansiedad, autoestima
🤖 Preferencia: Empezar con la IA

Podés cambiar esto en cualquier momento
desde tu perfil.

[¡Empezar mi camino de bienestar!]
```

---

## Qué hace Elevation con esta información

### Personaliza el primer mensaje de la IA
El primer mensaje que recibe el usuario no es genérico. Elevation usa sus respuestas del onboarding para generar un saludo personalizado:

```
"Hola, me alegra que estés aquí. Entiendo que querés trabajar
en tu bienestar psicológico, especialmente en la ansiedad.
Ese es un camino valioso. ¿Por dónde querés empezar?"
```

### Alimenta el matching con terapeutas
Si el usuario elige trabajar con terapeuta, las áreas e intereses del onboarding se usan para sugerir los terapeutas más adecuados según su especialidad.

### Alimenta las recomendaciones de bienestar
La IA usa el perfil del onboarding para generar recomendaciones más relevantes a lo largo del tiempo.

---

## Modelo de datos — UserProfile

```js
const UserProfile = sequelize.define('UserProfile', {
  UserId:          { type: DataTypes.INTEGER, allowNull: false, unique: true },
  wellnessAreas:   { type: DataTypes.JSONB,   allowNull: true },
  // ['psychological', 'physical', 'sexual', 'personal_dev', 'relationships', 'work']
  specificTopics:  { type: DataTypes.JSONB,   allowNull: true },
  // ['anxiety', 'self_esteem', 'grief', ...]
  mainIntention:   { type: DataTypes.TEXT,    allowNull: true },
  // Texto libre del usuario
  preferenceMode:  { type: DataTypes.STRING,  allowNull: true },
  // 'ai_only' | 'with_therapist' | 'undecided'
  onboardingDone:  { type: DataTypes.BOOLEAN, defaultValue: false },
  onboardingAt:    { type: DataTypes.DATE,    allowNull: true },
});
```

---

## Cuándo se muestra el onboarding

```
Usuario se registra
  → onboardingDone === false
  → Redirect a /onboarding antes del checkin
  → Completa el onboarding
  → onboardingDone = true
  → Nunca vuelve a verlo (a menos que lo resetee desde perfil)
```

---

## En qué sprint va esto

**Sprint 5** — el onboarding requiere tener primero el sistema de usuarios y roles completo (Sprint 4). Una vez que tenemos la base, el onboarding se construye sobre ella.

---
*Documentado: 30 de marzo de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
