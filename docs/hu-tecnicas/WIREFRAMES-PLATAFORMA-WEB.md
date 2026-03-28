# Elevation — Wireframes Plataforma Web
> Documentado: 28 de marzo de 2026

---

## Landing Page (/)

```
┌────────────────────────────────────────────────────────────────┐
│ ELEVATION              [Precios]   [ES|EN]  [Iniciar →]        │  Header sticky
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ╔═══════════════════════╗    ┌──────────────────────────┐   │
│   ║                       ║    │                          │   │
│   ║  [Badge: privado IA]  ║    │   Imagen hero Unsplash   │   │  Hero
│   ║                       ║    │   (futuro: editable)     │   │
│   ║  Encuentra tu         ║    │                          │   │
│   ║  calma interior       ║    └──────────────────────────┘   │
│   ║                       ║                                    │
│   ║  Tu compañero         ║                                    │
│   ║  privado para...      ║                                    │
│   ║                       ║                                    │
│   ║  [Iniciar →] [Cómo]   ║                                    │
│   ╚═══════════════════════╝                                    │
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│  EL PROCESO                                                     │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │  Proceso
│  │     1       │  │     2       │  │     3       │            │
│  │ Check-in    │  │  Conversá   │  │  Reflexioná │            │
│  │ emocional   │  │  con la IA  │  │  y cerrá    │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│  🔒 Privado      ⏰ 24/7          🧬 Evidencia                  │  Beneficios
│  y seguro        disponible       científica                    │
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│         ¿Listo para empezar?                                   │  CTA Final
│         Sin tarjeta de crédito                                 │
│         [Iniciar conversación]                                 │
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│ ELEVATION    disclaimer privacidad    © 2026                   │  Footer
└────────────────────────────────────────────────────────────────┘
```

---

## Login Page (/login)

```
┌────────────────────────────────────────────────────────────────┐
│                         ELEVATION                              │
│                    BreathingBackground                         │
│                                                                 │
│              ┌──────────────────────────────┐                  │
│              │                              │                  │
│              │  Bienvenido de vuelta        │                  │
│              │                              │                  │
│              │  [email________________]     │                  │
│              │  [contraseña___________]     │                  │
│              │                              │                  │
│              │  [    Ingresar    ]           │                  │
│              │                              │                  │
│              │  ¿No tenés cuenta? Registrate│                  │
│              │                              │                  │
│              └──────────────────────────────┘                  │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

## Check-in Page (/app/checkin)

```
┌────────────────────────────────────────────────────────────────┐
│                         ELEVATION                              │
│                    BreathingBackground                         │
│                                                                 │
│                    CHECK-IN EMOCIONAL                          │
│                                                                 │
│              ¿Cómo llegás hoy?                                 │
│              Tomá un momento antes de empezar                  │
│                                                                 │
│    ┌────┐  ┌────┐  ┌────┐  ┌────┐  ┌────┐                    │
│    │ 😞 │  │ 😔 │  │ 😐 │  │ 🙂 │  │ 😊 │                    │
│    │ Mal│  │Trst│  │Nrml│  │Bien│  │Genl│                    │
│    └────┘  └────┘  └────┘  └────┘  └────┘                    │
│                                                                 │
│              [    Continuar    ] ← deshabilitado               │
│              hasta selección                                   │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

## Chat Page (/app/chat)

```
┌────────────────────────────────────────────────────────────────┐
│              ELEVATION              [ES|EN] [🔧] [→|]          │  Header fijo 60px
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ELEVATION ·                                                   │
│  Hola, estoy aquí para acompañarte.                            │  Mensaje IA
│  ¿Qué querés explorar hoy?                   (Noto Serif ital) │
│                                                                 │
│                            ┌────────────────────────────────┐  │
│                            │ Hola, estoy un poco ansioso    │  │  Mensaje usuario
│                            │ por el trabajo...              │  │  (bubble derecho)
│                            └────────────────────────────────┘  │
│                                                                 │
│  ELEVATION ·                                                   │
│  Entiendo, la ansiedad laboral puede ser                       │
│  abrumadora. ¿Qué está pasando específicamente?               │
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│  Escribí lo que querés explorar... (Shift+Enter nueva línea)  [→]│  Input fijo
└────────────────────────────────────────────────────────────────┘
```

---

## Pricing Page (/precios)

```
┌────────────────────────────────────────────────────────────────┐
│ ELEVATION              [ES|EN]              [Iniciar →]        │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│                    Elige tu camino                             │
│               Sin compromisos. Cancelá cuando quieras.         │
│                                                                 │
│    ┌───────────────────────┐  ┌───────────────────────────┐   │
│    │                       │  │  ★ MÁS POPULAR            │   │
│    │  FREE                 │  │                           │   │
│    │  $0 / mes             │  │  PRO                      │   │
│    │                       │  │  $9.99 / mes              │   │
│    │  ✓ 10 conversaciones  │  │                           │   │
│    │  ✓ Check-in diario    │  │  ✓ Conversaciones ilimit. │   │
│    │  ✓ Historial 7 días   │  │  ✓ Check-in + Check-out   │   │
│    │  ✓ Soporte básico     │  │  ✓ Historial completo     │   │
│    │                       │  │  ✓ Estadísticas emocional.│   │
│    │  [Empezar gratis]     │  │  ✓ Soporte prioritario    │   │
│    │                       │  │                           │   │
│    │                       │  │  [Comenzar prueba gratis] │   │
│    └───────────────────────┘  └───────────────────────────┘   │
│                                                                 │
│    Sin tarjeta de crédito para Free. Cancelá Pro cuando quieras│
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

## Modal Check-out + Estrellas

```
┌────────────────────────────────────────┐
│                CHECK-OUT               │
│                                        │
│         ¿Cómo te vas?                  │
│    Tomá un momento antes de cerrar     │
│                                        │
│   😞   😔   😐   🙂   😊              │
│   ( )  ( )  ( )  (●)  ( )             │
│                                        │
│  ¿Cómo fue la conversación?            │
│  ★   ★   ★   ★   ☆   ← hover         │
│  Muy buena                             │
│                                        │
│  [  Cerrar sesión  ]  [Saltar]         │
└────────────────────────────────────────┘
```

---
*Documentado: 28 de marzo de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
