# Rendimiento en ejecución del chat — noviembre 2026 (ES-199 · PERF-05)

Medición con `frontend/scripts/perf-runtime.cjs` sobre el build de producción servido en local, CPU ×4 (móvil de gama media), 390 px, español, datos sintéticos (mensajes de ~400 caracteres), 40 pulsaciones por corrida y **mediana de 3 corridas**. Mide lo que tarda el navegador en procesar cada pulsación en el cuadro de mensaje hasta que React confirma el render (el evento `input` es discreto y se confirma de forma síncrona). Las cifras salen de ese script; no hay cifras estimadas.

## 1. Hallazgo

`usePersonalChat` guarda el texto del cuadro de mensaje (`input`) en el mismo estado que `ChatPage`. Cada pulsación volvía a pintar `ChatPage` y, con ella, **todas** las burbujas del historial (`messages.map` sin memoización). El coste por pulsación crecía con la conversación.

## 2. Corrección (solo donde la medición la justifica)

Una sola: la burbuja se extrae a `ChatBubble` (`memo`, props primitivas: rol, texto y las dos etiquetas). Solo la última burbuja del asistente (la que lleva el aviso de respuesta cortada) se repinta. Sin cambio de marcado, de estilos ni de comportamiento: el script `es199-check.cjs` (200 mensajes, ES/EN × 390/1360, axe) da el mismo resultado sobre main y sobre esta rama. No hay virtualización ni paginación, así que no cambia lo que ve la persona: **exento de la puerta de diseño**.

## 3. Antes y después

| Mensajes | p50 antes → después (ms) | p95 antes → después (ms) | Tareas largas > 50 ms (antes → después) |
| --- | --- | --- | --- |
| 10 | 13,9 → 15,7 | 27,7 → 30,8 | 0 → 1 |
| 100 | 18,3 → 16,5 | 32,2 → 30,3 | 1 → 0 |
| 500 | 43,2 → 21,9 | 76,8 → 37,3 | 10 → 1 |
| 1000 | 54,1 → 29,5 | 79,9 → 50,3 | 29 → 6 |

Con 10 y 100 mensajes no hay diferencia fuera del ruido (~14–18 ms es el piso fijo de la pantalla: cabecera, controles y panel de contexto; con 10 mensajes, 13,9 y 15,7 ms son indistinguibles entre corridas). La mejora aparece al crecer la conversación: con 500 mensajes la pulsación pasa de 43 a 22 ms (p50) y las tareas largas de 10 a 1; con 1000, de 54 a 30 ms y de 29 a 6. Con tres corridas por tamaño, las diferencias pequeñas no son concluyentes.

## 4. Lo que NO se hizo y por qué
- **Mover `input` a un estado local del cuadro de mensaje** (quitaría el coste restante de repintar `ChatPage`): exige separar `input` de `usePersonalChat`, que lo usa para enviar, para la protección de borrador y para vaciarlo al expirar la sesión. Es un cambio de diseño del hook con riesgo de regresión de privacidad; queda propuesto, no aplicado.
- **Virtualizar la lista de mensajes**: con 1000 mensajes la pulsación queda en ~30 ms (p50); no se justifica por la medición y complicaría el teclado y los lectores de pantalla.
- **Streaming**: el frontend no usa streaming (no hay `EventSource` ni lectura de flujo); la respuesta llega completa. El criterio «el streaming no vuelve a pintar el historial» no aplica hoy.
- **Skill Map y listas de administración**: NO se perfilaron a fondo. Skill Map tiene TBT 172 ms con 18 habilidades en PERF-01 y no hay evidencia de un problema de interacción; de la administración no verifiqué cómo se pagina cada lista. Sin evidencia no se memoiza («sin memoizar por costumbre»). Un ticket aparte puede perfilarlos con datos abundantes.
- **TBT/INP de la carga del chat**: no cambian con este ajuste (el trabajo es de la interacción, no de la carga); la línea base de carga sigue en `baseline-2026-11.md` (TBT 290 ms). INP no se mide en laboratorio: se usa el tiempo por pulsación.

## 5. Limitaciones
- Servidor sintético, localhost, un equipo, solo Chromium, CPU ×4 simulada. La conversación sintética no incluye texto largo con saltos de línea ni respuestas muy largas.
- No se midió el envío real de un mensaje (llama a IA; fuera de los límites de esta medición).
- Privacidad: no se añade ningún almacenamiento; el cambio es solo de render.
