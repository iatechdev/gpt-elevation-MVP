[QA-Claude] QA aprobado — head 16439e28b4d8fadc760b8bd1439d70da2b7df25c

**Veredicto: APROBADO** — PR #305 (ES-221), cabeza nueva con el semáforo del hash (2 a la vez, cola de 20, 503 `server_busy`). **Anula y reemplaza** mi informe CAMBIOS REQUERIDOS sobre `abe3cd3e` (E305-1 queda resuelto). Plan R1–R13 (Jira ES-221, 12284) más los añadidos de Infra (12285 y su mensaje: R14 cola llena, cliente ante 503, cola que se vacía). CI 4/4 y CLEAN verificados con gh sobre la cabeza exacta, también justo antes de publicar. Servidor REAL (cabeza fusionada con main, fast-forward) + PostgreSQL desechable con migraciones, datos sintéticos, 0 IA, nada contra staging ni producción.

| Caso | Resultado |
|---|---|
| R1–R3 | **Cumplen** (sin cambios respecto a mi informe anterior): inactiva = activa (400, mismo cuerpo y cabeceras, también MAYÚSCULAS y espacios; no reactiva ni cambia la contraseña); login con clave correcta de inactiva = 403 como hoy; recuperar contraseña igual; orden aceptación → hash → correo (mismo cuerpo `terms_required` para existente, inactiva y nueva) |
| R4 tiempo (local, pareado, n=40) | **Cumple.** Medianas dup activo / dup inactivo / nuevo = 143,9 / 142,0 / 147,0 ms (p90 194 / 199 / 200); razones 0,98 y 0,97 (umbral 0,8–1,25). En main eran 0,02 |
| R5 límite | **Cumple.** 429 exactamente en la petición 31 (cuentan 201 y 400), cuerpo ES/EN, `RateLimit-Limit 30`, reinicio 3596 s; el piloto de 6 tras una IP con 24 previas = 6 × 201 y la 31 = 429; el env se ignora en producción y Railway (medido en la corrida anterior, código del límite idéntico) |
| R7 concurrencia | **Cumple.** 10 registros simultáneos del mismo correo = 1 cuenta, sin 500; 40 simultáneos con 10 consumidos = 20 admitidos y 20 con 429 |
| **R8 rendimiento** | **Cumple el umbral aprobado.** `/api/health` p95 durante una ráfaga de 30 simultáneos: 200,3 / 251,6 / 257,4 ms con 30 correos nuevos y 205,3 / 245,8 ms con 30 duplicados (umbral < 1 s; antes ≈ 3,1–3,2 s). La ráfaga completa tarda 5,3–5,8 s; un login legítimo durante ella, 0,5–1,0 s; 0 × 500 (los rechazos son 503) |
| **R14 cola llena** | **Cumple.** 150 registros simultáneos desde 6 IPs (25 cada una): 17 × 201, 6 × 400, **127 × 503 `server_busy`**, 0 × 500; cuerpo estable ES/EN idéntico para un correo existente y uno nuevo (sin oráculo); cuentas creadas = respuestas 201; `/api/health` p95 256 ms; los 503 cuentan contra el cupo de IP como cualquier petición (la IP que mandó 25 recibe 429 en la 31). Rechazo rápido: 503 en ≈ 0,7–0,9 s; las admitidas esperan como máximo 4,4 s (con la cola de 100 llegaban a 25 s: E305-6 resuelto). Una ráfaga de 30 desde UNA IP = 22 × 201 y 8 × 503 |
| R14 piloto | 6 personas tras la MISMA IP registrándose a la vez = 6 × 201 (la cola las absorbe) |
| R14 recuperación | un registro legítimo tras la tormenta entra en 369 ms (corrida anterior con la misma lógica) y la mediana de 5 registros normales vuelve a < 1,5 s: la cola se vacía |
| R14 cliente ante un 503 | **Aceptable.** El formulario real muestra el aviso genérico «No se pudo completar el acceso. Inténtalo de nuevo.» / «Access could not be completed. Please try again.», el botón no queda bloqueado, axe = 0, sin errores de página (`frontend/src/access/session.ts`: 503 cae en `landing.access.failed`). Medido en el formulario con la respuesta 503 simulada; el cliente no cambió en este PR |
| R9 mutaciones del semáforo (6) | **6/6 detectadas.** Por las pruebas del PR y/o mi guion: cupo que no se libera (prueba PostgreSQL del PR y mi guion, ambos se cuelgan), concurrencia 1000 (5 fallas unitarias y R8 = 3.053 ms), hash fuera del semáforo (1 falla unitaria y R8 = 3.055 ms), 503 que responde 500 (1 falla unitaria y mi guion), cola por defecto 100 (2 fallas unitarias) y **cola sin tope** (solo mi guion; la prueba unitaria del PR no termina limpiamente: 5 pasan y ninguna falla reportada, resultado no concluyente) |
| R10 regresión | backend `npm test` **711/711**; PostgreSQL real: es-221 6/6, es-220 1/1, es-259 3/3, es-282 7/7, es-301 10/10, es-306 16/16. La falla de CI de la cabeza anterior (ES-282: literales `.invalid` en `scripts/es221-r8.cjs`) está corregida y la prueba no se tocó |
| R11–R12 | 22 entradas hostiles: 400/429, 0 cuentas indebidas, `role` no escala, 0 × 500 salvo `name` de 5.000 caracteres (E305-2, también en main); sin secretos; `frontend/` sin cambios |

**Hallazgos**
| ID | Sev. | Evidencia | Sugerencia |
|---|---|---|---|
| E305-1 | **Resuelto** | R8: p95 de `/api/health` 200–257 ms (antes ≈ 3,1–3,2 s) | — |
| E305-6 | **Resuelto** | cola 100 → 20: espera máxima de una persona admitida 4,4 s (antes 25 s); rechazo 503 en < 1 s | — |
| E305-2 | Bajo (preexistente, también en main; fuera del PR) | `name` de 5.000 caracteres → 500 en `/api/register` | ticket aparte: validar longitud (≤ 255) con 400 |
| E305-3 | Requisito de lanzamiento | sin `TRUST_PROXY_HOPS` el cupo de 30/h y la cola de 20 son compartidos por TODO el tráfico (R6a, medido). Infra confirmó `=1` en staging; producción sin variables por ahora | añadir `TRUST_PROXY_HOPS=1` a las variables de producción antes del lanzamiento |
| E305-7 | Observación | con la cola de 20, una ráfaga simultánea de más de 22 registros hace que algunas personas legítimas reciban 503 en ese momento (de una sola IP, a lo sumo 30 por hora, ventana de ≈ 4 s); mantener la cola llena exige > 5 registros por segundo sostenidos, es decir cientos de IPs por hora | residual aceptable; el cliente muestra un aviso genérico y la persona reintenta |
| E305-8 | Observación | el login no pasa por el semáforo: durante una ráfaga de registros un login legítimo tarda 0,5–1,0 s (no se degrada más); `/api/health` no se ve afectado | sin acción |

**No verificado:** Railway real (tiempos, CPU, IP tras el proxy; las latencias son de un equipo Windows local con bcryptjs), más de una réplica (semáforo, límite y contadores son por proceso), la enumeración residual «ya registrado» vs «nuevo» (decisión de Mauricio, opción A, hasta ES-12), barrido con muchas IPs, producción y staging (no se tocaron), revisión humana del texto EN del aviso.

Evidencia: PR de QA #6, `qa/integration/es221-servidor.cjs`, `qa/e2e/es221-503-pantalla.cjs` y `qa/evidence/ES-221-pr305-cabeza-16439e28/` (logs de cada corrida, mutaciones, runners). **Puedes fusionar con CI 4/4 y CLEAN.** Cualquier cambio de head anula esta aprobación.
