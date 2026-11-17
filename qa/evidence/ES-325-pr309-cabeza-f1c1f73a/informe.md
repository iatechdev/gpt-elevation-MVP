[QA-Claude] QA aprobado — head f1c1f73a1d144b5305b31ff9abf541ce305c0d8a

**Veredicto: APROBADO (con observaciones medidas)** — PR #309 (ES-325 / E273-1). Plan S1–S11 aprobado por Infra (Jira ES-325, 12311 y su «Ejecuta», umbral S9 aprobado y límite de borde de banda y frontera suprimida↔publicada aceptado como declarado). CI 4/4 y CLEAN verificados con gh sobre la cabeza exacta, también justo antes de publicar. Servidor REAL (cabeza fusionada con main) + PostgreSQL desechable con migraciones, personas sintéticas creadas por la API real, 0 IA, nada contra staging ni producción. Solo backend: no hay pantallas que revisar.

| Caso | Resultado |
|---|---|
| S1 alcance | 3 archivos de backend (`utils/pilotFeedback.js`, `routes/pilotFeedback.js` solo comentario, `es-173-postgres.cjs`); 0 cambios en frontend, textos, respuestas individuales ni permiso |
| S2 contrato | **Cumple.** Respuesta `{ minPeople, metrics[] }`; `ready` con `counts` solo `eligible/responded/positive`, cada uno `{min,max}` enteros; **sin `missing`** en ninguna parte; suprimida sin `counts`; `activation` y `experiment` siguen `not_available`; sin identidad, correo, nombre ni respuestas individuales |
| S3 bandas | **Cumple.** Con 5, 6, 9, 10, 11 y 14 personas reales el JSON es exactamente `floor(n/5)*5 … +4` (p. ej. 7 elegibles, 6 respondidas y 3 positivas → 5–9 / 5–9 / 0–4) |
| S4 supresión | **Cumple.** En 110 estados base (elegibles 5/6/9/10, respondidas 5…elegibles, positivas 0…respondidas, listening) el JSON publicado coincide EXACTAMENTE con el modelo: publicada solo con elegibles ≥ 5, respondidas ≥ 5 y 0 < positivas < respondidas. En utility: 5 «yes» (todas positivas) → suprimida; 4 «yes» y 1 «no» → publicada; «not_explored» no cuenta como respondida; 5 «no» (positive = 0) → suprimida |
| **S5 diferencias** | Medido; **lo visible es solo lo declarado.** (a) Cambiar una respuesta sin cambiar su signo (p. ej. positiva → positiva con otra categoría de ayuda) NO cambia nunca lo publicado (0/96). (b) Toda transición visible coincide con un cambio del modelo (borde de banda o frontera de supresión): 110 estados, 0 formas inesperadas. (c) **Cuánto queda visible** (una acción de una persona; `PR` frente a `main` = control, donde casi todo es visible): ver tabla siguiente |
| S6 acceso | **Cumple.** Usuario, profesional y terapeuta → 403; administrador y superadministrador → 200 con `Cache-Control: no-store`; token falso → 401; POST/PUT/DELETE sobre el agregado → 404 (sin escritura, sin 500); parámetros `userId/raw/exact/missing` no cambian nada. Sin token → 403 (igual que en main: es la conducta de `verificarAdmin`, no del PR) |
| S7 respuestas y permiso | **Sin cambios.** La firma de 13 llamadas (GET/PUT/DELETE de `/api/me/pilot-feedback`, concesión y revocación del permiso, ventana inválida, sin `requestId`) es **idéntica a main**: mismos códigos y mismas claves; revocar el permiso no borra lo respondido; retirar la respuesta deja `withdrawn` con `answers: null` |
| S8 robustez | **Cumple.** 12 personas × 12 cambios de permiso mientras consulto el agregado (14 consultas durante la tormenta): invariantes `responded ≤ eligible` y `positive ≤ responded` intactos, sin negativos ni NaN, 0 × 500 |
| S9 rendimiento | **Cumple el umbral aprobado.** Con 200 personas sintéticas (150 respondieron, 100 positivas): p50 49,4 ms, p95 53,7 ms (n=30; umbral < 500 ms). Una sola consulta SQL (leído en el código) |
| S10 mutaciones (6) | **6/6 detectadas** por la prueba del PR (es-173, 2–4 fallas cada una) y por mi guion: sin supresión con positive = 0, sin supresión con positive = responded, `BAND = 1` (exacto), `missing` de vuelta, `round` en vez de `floor`, umbral de personas 3 |
| S11 regresión | backend `npm test` **711/711**; PostgreSQL real: es-173 14/14, es-175 15/15, es-274 11/11, es-306 16/16, es-221 6/6, es-301 10/10. `frontend/` sin cambios |

**Cuánto queda visible (S5, medido)** — porcentaje de acciones de UNA persona que cambian lo publicado, sobre todos los estados publicables de cada tamaño (cada estado cuenta igual; no es una distribución realista de respuestas):

| Acción | Piloto (6 elegibles) PR · main | Cohortes de 5 a 40 PR · main |
|---|---|---|
| Primera respuesta (positiva / negativa) | 33 % / 17 % · 100 % | 37 % / 23 % · 100 % |
| Cambiar de positiva a negativa (o al revés) | 45 % · 100 % | 28 % · 100 % |
| Retirar la respuesta (positiva / negativa) | 55 % / 45 % · 100 % | 37 % / 24 % · 100 % |
| Revocar el permiso con respuesta (positiva / negativa) | 55 % / 45 % · 100 % | 50 % / 40 % · 100 % |
| Revocar el permiso sin respuesta | 0 % · 100 % | 21 % · 100 % |
| Cambiar la respuesta sin cambiar el signo | 0 % · 0 % | 0 % · 0 % |

(Medido directamente en 110 estados base con el servidor real: cambiar de positiva a negativa 40 %, retirar 45 %, revocar el permiso 64 % en PR frente a 100 % en main en cada una; coincide con el modelo.)

**Hallazgos**
| ID | Sev. | Evidencia | Sugerencia |
|---|---|---|---|
| E309-1 | Observación (límite declarado y aceptado por Infra; lo cuantifico) | Con el tamaño del piloto (6 personas) las bandas de 5 son gruesas: entre el 45 % y el 55 % de los cambios de una sola persona (cambiar de signo, retirar, revocar con respuesta) siguen moviendo lo publicado, por cruzar el borde de una banda o la frontera suprimida↔publicada. La mitigación quita el conteo exacto y `missing` (de 100 % de cambios visibles a ≈ 50 %), pero **no** impide que quien conoce a las demás cinco personas deduzca la respuesta de la sexta. Con cohortes grandes baja a ≈ 25–40 % | si el piloto debe proteger a cada persona de las demás, el control real es no publicar el agregado mientras haya pocas personas (p. ej. exigir más respondientes) o el retraso/instantánea (punto 4, pendiente); decisión de producto, no de este PR |
| E309-2 | Observación | El contrato `counts` cambia de forma (números → `{min,max}`); ninguna pantalla real lo consume aún. `PilotMetricsPage` solo lee fixtures sintéticas y se debe adaptar y probar cuando se conecte | verificarlo al conectar la pantalla |
| E309-3 | Observación | El retraso o instantánea (punto 4 de ES-325) NO está incluido y la retención del agregado sigue pendiente de Alejo (declarado en el PR) | seguimiento en ES-325 |
| E309-4 | Observación | Sin token, `/api/admin/pilot-metrics` responde 403 y no 401 (idéntico en main) | sin acción en este PR |

**No verificado:** la pantalla real de métricas; el retraso o instantánea (no implementado); coaliciones que conocen a todas las demás personas y el borde exacto (límite declarado: cuantificado arriba, no eliminado); Railway y staging (no se tocaron); más de una réplica (no aplica: no hay estado); eliminación pendiente de cuenta como acción dentro de la rejilla (la prueba del PR la cubre con la consulta; yo probé desactivación y revocación).

Evidencia: PR de QA #6, `qa/integration/es325-metricas.cjs` y `qa/evidence/ES-325-pr309-cabeza-f1c1f73a/` (logs de cada corrida, control en main, mutaciones, modelo de visibilidad). **Puedes fusionar con CI 4/4 y CLEAN.** Cualquier cambio de head anula esta aprobación.
