# Escenario de pruebas del barrido (ES-45) — cuentas y datos SINTÉTICOS [QA-Claude]
Lo crea `seed-escenario.mjs`; `verify-escenario.mjs` comprueba que funciona. Las contraseñas son aleatorias y se guardan solo en `credenciales-<entorno>.json` (archivo local, no versionado); no están en este documento, ni en Git, Jira o el chat.

| Clave | Cuenta | Rol | Qué tiene | Para qué sirve en el barrido |
|---|---|---|---|---|
| P1 | Lucía (docente → datos) | persona ES | contexto completo, 2 diarios, 1 evidencia, permisos de El Puente otorgados, vinculada a la terapeuta T1 con `therapist_sharing`; (con IA activa) hoja de vida y un chat | Recorrido principal: chat, diario, El Puente, Skill Map, análisis de IA, rutas, datos |
| P2 | Andrés (contador) | persona ES | contexto y 1 diario, sin permisos de IA | Poco contenido; permisos apagados por defecto; profesión no técnica |
| P3 | Sam (coordinator) | persona EN | contexto, 2 diarios, 1 evidencia, permisos de El Puente | Todo el recorrido en inglés |
| P4 | Nora (nueva) | persona ES | nada | Estados vacíos y primer uso |
| P5 | Beto | persona ES | contexto | Exportar datos y solicitar eliminación sin afectar a otras cuentas |
| P6 | Camila | persona ES | contexto completo, 2 diarios, 1 evidencia, permisos | Aislamiento: no debe ver nada de Lucía ni al revés |
| T1 | Teo | terapeuta | 1 persona vinculada (Lucía) | Panel, resumen con IA, notas; **no** ve chat ni diario |
| T2 | Tania | terapeuta | ninguna persona | Aislamiento: no ve a nadie ajeno |
| ADM | Ada | administración | rol `admin` | Catálogo de habilidades, contenido, planes, prompts, métricas |

Notas
- En staging el rol `admin` de Ada lo asigna Infra con una sola sentencia SQL generada en `PEDIR-A-INFRA-<entorno>.sql` (sin contraseñas); el resto se crea por la API.
- La solicitud de un profesional nuevo (landing) y el flujo de eliminación completo los hace la persona durante el barrido.
- El login admite 10 intentos por minuto y por IP: quien recorre el producto no debe superarlo.
- La IA (hoja de vida y chat de Lucía) solo se siembra si `QA_SEED_AI=1` (en un entorno real gasta tokens).
- Resultado local de la verificación: 26/26 pasos de siembra y 19/19 comprobaciones (ingreso de las 9 cuentas, permisos por rol, estado vacío de Nora, la terapeuta 1 ve a Lucía y la 2 no ve a nadie, Skill Map abre).
