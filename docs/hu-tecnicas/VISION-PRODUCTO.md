# Elevation — Visión del Producto
> Documentado: 30 de marzo de 2026
> Autor: Claude (Tech Lead AI) + Mauro Roldán

---

## ¿Qué es Elevation?

Elevation es una **plataforma de bienestar integral** que acompaña a las personas en su camino hacia la salud mental y el equilibrio emocional. Todo empieza desde la mente.

No es solo un chatbot de IA. No es solo una app de meditación. Es un ecosistema donde la inteligencia artificial, los terapeutas humanos especializados y el propio usuario trabajan juntos para construir bienestar sostenible.

---

## Los tres pilares de Elevation

### 1. Elevation IA — el acompañante siempre disponible
La IA de Elevation está disponible 24/7. Escucha, hace preguntas reflexivas, genera recomendaciones de bienestar y lleva un registro emocional del usuario. No reemplaza al terapeuta — lo complementa y lo prepara.

### 2. El terapeuta humano — la guía especializada
Cada terapeuta en Elevation tiene su propia corriente terapéutica y especialidad. La IA se adapta a esa corriente cuando el usuario trabaja con ese terapeuta. El terapeuta ve el progreso del usuario, genera notas clínicas y hace recomendaciones que la IA incorpora.

### 3. El usuario — el protagonista de su bienestar
El usuario no es un paciente pasivo. Tiene acceso a su propio historial emocional, sus reportes de progreso, las recomendaciones de la IA y las notas de su terapeuta. Es dueño de su proceso.

---

## Las corrientes terapéuticas de Elevation

Elevation no tiene una sola forma de acompañar. Cada terapeuta trae su corriente y la IA se adapta a ella. Ejemplos:

| Corriente | Cómo habla la IA | Enfoque |
|---|---|---|
| Mayéutica (socrática) | Preguntas que llevan al usuario a descubrir sus propias respuestas | Autoconocimiento profundo |
| Tantra y sexualidad | Conexión mente-cuerpo-energía, sin tabúes | Bienestar sexual y relacional |
| Disciplina y motivación | Lenguaje de acción, metas, accountability | Hábitos y rendimiento |
| Mindfulness | Presencia, respiración, observación sin juicio | Ansiedad y estrés |
| TCC (Terapia cognitivo-conductual) | Identificar patrones de pensamiento, reestructurar | Depresión, ansiedad |
| DBT | Regulación emocional, tolerancia al malestar | Emociones intensas |

Cada prompt de terapeuta define cómo habla la IA con los usuarios de ese terapeuta.

---

## Arquitectura de prompts — cómo funciona

### Prompt general de Elevation
Cuando un usuario no tiene terapeuta asignado, la IA usa el prompt general `elevation_system_prompt`. Este prompt define la personalidad base de Elevation: empática, sin juicios, reflexiva, no directiva.

### Prompt específico del terapeuta
Cada terapeuta tiene su propio prompt que define:
- Su corriente terapéutica
- Su forma de hablar
- Sus técnicas preferidas
- Los temas que puede y no puede abordar
- Cómo se articula con el prompt general

Cuando el usuario tiene terapeuta asignado, la IA usa **únicamente el prompt del terapeuta**. Ese prompt ya incorpora la base de Elevation más la especialidad del terapeuta.

### Flujo de aprobación del prompt del terapeuta
```
Terapeuta crea/propone su prompt
  → Superadmin lo revisa
  → Si aprueba → se activa para los usuarios de ese terapeuta
  → Si rechaza → terapeuta recibe nota y puede proponer ajustes
```

El mismo sistema de versionado y aprobación que ya existe en PromptVault se extiende para soportar prompts por terapeuta. La key sería: `therapist_prompt_{therapistId}`

### En el backend
```js
// Determinar qué prompt usar
const user = await User.findByPk(userId)
let systemPrompt

if (user.therapistId) {
  // Usuario tiene terapeuta → usar prompt del terapeuta
  systemPrompt = await getActivePrompt(`therapist_prompt_${user.therapistId}`)
}

// Fallback al prompt general si no hay prompt de terapeuta
if (!systemPrompt) {
  systemPrompt = await getActivePrompt('elevation_system_prompt')
}
```

---

## Las cuatro experiencias de Elevation

### Experiencia 1 — Usuario regular
**Ruta:** `/app/checkin` → `/app/chat` → check-out
**Ve:** Chat con Elevation, historial emocional, reportes de progreso, recomendaciones de la IA
**No ve:** Nada del backoffice ni del panel del terapeuta

### Experiencia 2 — Terapeuta
**Ruta:** `/therapist/dashboard`
**Ve:**
- Lista de pacientes asignados con último mood
- Historia clínica de cada paciente
- Historial emocional (check-ins, check-outs, ratings)
- Recomendaciones de la IA para cada paciente
- Calendario de sesiones
- Su propio prompt terapéutico (puede proponer cambios)
- Pacientes reasignados con su historia clínica previa

### Experiencia 3 — Admin
**Ruta:** `/admin/dashboard`
**Ve:** Métricas, lista de usuarios, contenido de páginas públicas, prompts
**Puede:** Crear usuarios (user/therapist), editar contenido, proponer cambios de prompt
**No puede:** Aprobar prompts, crear admins, cambiar roles privilegiados

### Experiencia 4 — Superadmin
**Ruta:** `/admin/dashboard`
**Ve:** Todo lo que ve el admin más gestión completa
**Puede:** Todo — aprobar prompts, crear cualquier usuario, gestionar roles, ver todas las métricas

---

## Roadmap de sprints

### Sprint 4 — Base administrativa (en curso)
- HU-044: Backoffice con rutas `/admin` dedicadas
- HU-045: Gestión y creación de usuarios
- HU-046: Rol therapist básico — dashboard con lista de pacientes e historial emocional
- HU-047: Dashboard de métricas ejecutivas
- HU-048: Contenido todas las páginas públicas + precios + promociones

### Sprint 5 — Plataforma clínica
- HU-049: Prompts por terapeuta — arquitectura y flujo de aprobación
- HU-050: Historia clínica del cliente (historial emocional + notas del terapeuta + resumen IA)
- HU-051: Recomendaciones de bienestar generadas por IA — visibles para cliente y terapeuta
- HU-052: Panel de reportes del cliente (diario emocional, progreso, recomendaciones)
- HU-053: Documentos adjuntos en historia clínica

### Sprint 6 — Integración y calendario
- HU-054: Integración Google Calendar para terapeutas
- HU-055: Reasignación de pacientes por especialidad
- HU-056: Informe de avance y resultados por paciente
- HU-057: Recomendaciones cruzadas IA + terapeuta (flujo de aprobación)

### Sprint 7 — Bienestar expandido
- HU-058: El usuario elige su corriente de bienestar (si no tiene terapeuta)
- HU-059: Biblioteca de corrientes terapéuticas disponibles
- HU-060: Matching usuario-terapeuta por necesidad y especialidad

---

## Principios de diseño del producto

1. **Todo empieza desde la mente** — el bienestar integral tiene su base en la salud mental
2. **La IA acompaña, el terapeuta guía, el usuario decide** — ningún componente reemplaza al otro
3. **Privacidad no negociable** — las conversaciones son encriptadas, los datos del usuario son suyos
4. **Calma en cada pantalla** — el diseño refuerza el estado emocional que queremos generar
5. **Evidencia + intuición** — cada corriente terapéutica está respaldada por práctica real
6. **Accesible para todos** — bilingüe, sin jerga clínica innecesaria, sin barreras

---
*Documentado: 30 de marzo de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
