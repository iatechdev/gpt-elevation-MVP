# ES-111 · PR #95 · head f3ecd55 — evidencia [QA-Claude]
Entorno: merge local de origin/main + #94 + #95, Postgres embebido (qa111), servidor REAL (ES-25 `/api/career-context`), Chromium (Playwright), datos sintéticos, Claude no interviene (0 llamadas).
- `ui-f3ecd55.jsonl`: es111-ui.cjs con el frontend construido CON `VITE_BRIDGE_INSIGHTS_FIXTURES=true` (33 correctas, 5 con hallazgo).
- `ui-vacio-f3ecd55.jsonl`: mismo script en modo `empty` (build SIN el interruptor): «Aún no hay insights», sin ejemplos, enlace a la Brújula, EN.
- Capturas en `capturas/`.
- Frontend: `npm test` 169/169, tsc, lint y build (ver comentario del PR).

## Hallazgos
| ID | Sev. | Qué pasa | Cómo reproducir |
|---|---|---|---|
| ES111-QA-01 | Alto | Detalle y reproducción solo en Jira (ver ES-111). | ver ES-111 |
| ES111-QA-02 | Medio | Concurrencia entre pestañas (detalle en ver ES-111). | ver ES-111 |
| ES111-QA-03 | Medio (accesibilidad) | El foco se pierde (queda en `<body>`) al cerrar la confirmación: con Escape/«Cancelar» no vuelve a «Autorizar cruce» (el botón se desmonta) y tras confirmar tampoco hay un destino de foco. | Teclado: Enter en «Autorizar cruce» → Escape; o Enter, Enter. |
| ES111-QA-04 | Bajo | Si la respuesta de «confirmar» se pierde después de guardar, el reintento usa otro `requestId` y crea una versión idéntica extra (v2 igual a v1). | Interceptar la respuesta de `/confirm` y reintentar. |
| ES111-QA-05 | Bajo (observación) | Un ejemplo autorizado (interruptor activo) se escribe en el contexto profesional REAL y en «Tu perfil profesional» no queda marcado como ejemplo; el interruptor no está documentado en `.env.example`. | Autorizar un ejemplo con el build con interruptor. |
| ES111-QA-06 | Bajo (observación) | Al mostrar el fragmento de otra tarjeta, el primero sigue visible (el plan esperaba difuminarlo al cambiar). No es fuga. | Ojo en tarjeta 1, ojo en tarjeta 2. |
| ES111-QA-07 | Bajo (observación) | Fondo medido del body rgb(249,249,247), no #FAFAF9 (igual que ES112-QA-02). | Estilo computado. |

## No verificado
Insights reales con origen de diario (no existen; el servidor no devuelve el origen por texto), lector de pantalla, otros navegadores, Railway, Claude real.

## Reverificación · head a4e982b
Merge local con main (+#94 ya incluido). Frontend 170/170, tsc y lint limpios. Script de navegador contra servidor real: 38 correctas, 1 observación abierta (B3d).
- ES111-QA-01/02 cerrados en el caso de pestaña desactualizada (B3b, B3c): no compone, actualiza y avisa; lo revocado no reaparece y lo autorizado se conserva.
- ES111-QA-03 (foco), QA-04 (mismo requestId al reintentar; 1 versión), QA-05 (ejemplos marcados + aviso + .env.example), QA-07 (fondo #FAFAF9 medido) cerrados.
- ES111-QA-08 (Medio, residual declarado por Dev): si otra sesión revoca justo entre la relectura y la confirmación, lo revocado vuelve a cruzar (B3d, reproducido interceptando la vista previa). Cierre completo = versión base en el servidor (ES-25); decide Mauricio.
- ES111-QA-06 (observación) sin cambios.
