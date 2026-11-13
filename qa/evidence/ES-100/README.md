# ES-100 · PR #78 · head 8287d8b — evidencia [QA-Claude]
Entorno: merge local con main (incluye #74), Postgres embebido (qa78), servidor real con `DATA_RIGHTS_ENABLED=true`, Chromium (Playwright), datos sintéticos; las salas de videollamada se simulan (sin Daily). Frontend `npm test` 191/191, tsc, lint y build limpios.
- `ui-8287d8b.jsonl`: es100-ui.cjs, 19 correctas / 5 con hallazgo. Capturas en `capturas/`.
- Cumple: M6 (sin desborde a 320/375/768/1440 en ES y EN, 48 combinaciones, con nombres normales); teclado con foco visible; etiqueta «Nota clínica»; interruptor `role=switch` con Espacio; diálogo modal con foco atrapado, Esc y foco de regreso; desvincular cancela sesiones futuras, retira la autorización y el segundo terapeuta no hereda; «sin acceso»; ES/EN sin restos; sin XSS con nombres hostiles; solo el propio origen; textos sin diagnóstico ni «paciente».

## Hallazgos
| ID | Sev. | Qué pasa | Cómo reproducir |
|---|---|---|---|
| ES100-QA-01 | Medio | B4 sigue abierto para los errores del servidor: `localizeServerError` solo traduce mensajes «es / en»; los reales del backend son solo en inglés y salen tal cual en la interfaz en español («Session not found.», «Could not join session.», «Could not start session.», «Meeting URL not available yet.», «AI usage limit reached.», «Could not generate summary.»). | Simular esas respuestas (cuerpos copiados de `sessions.js` y `therapistRoutes.js`) en la sala o en «Generar resumen». |
| ES100-QA-02 | Medio | B4 «botones < 44 px» sigue abierto: ES/EN 35×21 y 36×21 (cabecera), «← Volver» 56×20, «Entrar a videollamada» 158×33, enlace «¿Querés cambiar…» 194×20, «Finalizar sesión» 144×39. | Medir en panel, ficha, Mi terapeuta y sala del terapeuta. |
| ES100-QA-03 | Medio | B4 contraste: sigue habiendo texto < 4.5:1 (EN 4.00, «Sesiones» 4.02, fechas 4.33, «Total sesiones» 4.33, «Crear prompt» 4.46; en Mi terapeuta «ELEVATION» 2.39, «Perfil no completado» 2.52). El subtítulo del rol sí quedó bien. No comparado con main: parte puede ser previa a este PR. | Medir a 375 px. |
| ES100-QA-04 | Bajo | Un nombre largo sin espacios (38 y 54 caracteres) desborda a 320 px (panel) y a 320/375 px (ficha hasta 497 px). Con nombres normales no pasa. | Persona o terapeuta con un nombre de una sola palabra larga. |

## No verificado
Salas con Daily real, lectores de pantalla, tema oscuro, comparación de los contrastes con main, mutaciones (no aplican a este PR de interfaz), staging.

## Reverificación · head 1c2a34c
Merge local con main. Frontend 191/191, tsc, lint y build limpios. Script de navegador contra servidor real: 23 correctas, 1 observación (`ui-1c2a34c.jsonl`).
- QA-01 cerrado (errores del servidor en español en salas y resumen; 429/502/500 y los mensajes reales de sesiones). QA-02 cerrado (0 controles < 44 px en las seis pantallas). QA-04 cerrado (nombres de 38 y 54 caracteres sin desborde).
- QA-03 casi cerrado: sin textos < 4.5:1 en panel, Mi terapeuta ni salas; queda la ficha de la persona con 4.33–4.46 («Total sesiones», «Ánimo promedio», «Calif. promedio», «Agendar sesión»). Origen: el token global `textMuted` (#78716C) de `styles/tokens.ts`, usado también fuera de este PR. Bajo, seguimiento.
