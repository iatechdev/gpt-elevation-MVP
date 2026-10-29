# ES-121 · PR #99 · head 79e13423f7db4b05ce4cf06ce1ad04eab369977e — evidencia [QA-Claude]
Entorno: merge local con main, Postgres embebido (qa121), 5 servidores reales (presupuesto alto, sin presupuesto, bajo, proveedor caído y lento), IA simulada, datos sintéticos con canarios. Backend 455/455 (una corrida intermedia con 1 fallo no identificado; la siguiente 455/455).
- `backend-79e1342.jsonl`: es121-real-db.mjs, 29 correctas / 2 con hallazgo. Mutaciones (M1–M5): sin consentimiento por fuente, sin filtro de riesgo en el chat, sin comprobar la cita, sin validar la habilidad, turno ajeno sin propietario → 5/5 detectadas.
- Cumple: consentimiento independiente por fuente y del puente (403 con `purpose`, 0 llamadas a la IA), lectura solo de lo propio (sin respuestas del asistente ni de otras personas), riesgo excluido, IDs ajenos y borrados 404, 20 entradas inválidas → 400, 21 casos de salida del modelo sin 500, inyección en el chat descartada, `skillKey` privado ligado al token de la vista previa, `GET /api/career-context` solo al titular y sin contenido, payload cifrado, `inConversation` correcto y aislado, revocar la fuente no borra lo autorizado y revocar el puente sí, sin presupuesto 503, proveedor caído 502, lento controlado, presupuesto bajo 429, logs y `AiUsages` sin contenido.
## Hallazgos
| ID | Sev. | Qué pasa |
|---|---|---|
| ES121-QA-01 | Alto | Disponibilidad bajo concurrencia: detalle y reproducción solo en Jira (ver ES-121). |
| ES121-QA-02 | Medio | El filtro de la salida frena «empleabilidad» y términos clínicos, pero 9 de 9 frases de promesa de empleo, contratación, salario u oferta de trabajo (ES/EN) lo atraviesan; la regla del producto es no prometer empleabilidad. |
| ES121-QA-03 | Bajo (observación) | El `token` de la propuesta no lo consume ningún endpoint de este PR (la ligadura real la da la vista previa de ES-25). |
| ES121-QA-04 | Bajo (observación) | Un insight cuyo texto obedece una inyección pasa si cita una frase real del mismo mensaje (se valida la cita, no que el texto la respalde); la persona debe autorizarlo uno a uno. |
## No verificado
Calidad con Claude real y robustez de la inyección con ataques reales (muestra con Claude real no autorizada), fuente «hoja de vida» (fuera del PR), producción.
