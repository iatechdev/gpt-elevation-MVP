[QA-Claude] PLAN DE PRUEBAS — PR #305 (ES-221: registro sin oráculo de cuenta inactiva, tiempo equivalente, límite por IP 30/h)

Cabeza a probar: abe3cd3e6aac23d6182153a87611bd62bd27497a. Hoy el PR está BLOCKED y la CI en curso (solo `evaluation` verde): no ejecuto hasta ver CI 4/4 y CLEAN sobre la cabeza exacta, y tu «Ejecuta». Backend + docs; sin cambios de pantalla (diff de frontend/ = 0, lo compruebo).

**Lo que leí en el diff (y que condiciona el plan)**
- `registerLimiter` (30/h por IP, `REGISTER_RATE_LIMIT_MAX` solo fuera de producción y Railway) va ANTES de `validateBody`: cuenta también 400 y 201.
- `bcrypt.hash` se calcula siempre antes de `findUserByEmail`; «inactiva» devuelve el mismo 400. (Nota: la propuesta 12230 decía «DECOY_HASH»; el PR calcula el hash real, que cuesta lo mismo. No lo objeto, lo declaro.)
- **Riesgo que quiero probar con datos:** `server.js:44` pone `trust proxy` en `false` salvo `TRUST_PROXY_HOPS`. Si en Railway no está definida, todo el tráfico comparte la IP del proxy: los 30/h serían GLOBALES (6 personas del piloto + cualquiera que sondee agotarían el cupo → registro caído una hora). El PR lo declara «no verificado en Railway»; yo lo demuestro localmente en R6 y te pido confirmar por nombre que la variable existe en staging y producción.
- El cliente ya mapea 429 a `landing.access.rate_limit` (`frontend/src/access/session.ts:66`).

**Entorno:** servidor REAL (backend de la cabeza fusionado con main) + PostgreSQL desechable local con migraciones reales, datos sintéticos `@example.invalid`, 0 IA, 0 costo. Nada contra staging ni producción. Mis scripts que registran por `/api/register` correrán con `REGISTER_RATE_LIMIT_MAX` alto (solo local).

| ID | Qué | Esperado |
|---|---|---|
| R1 | Inactiva = activa: status, cuerpo y cabeceras (sin Date/RateLimit) iguales; con mayúsculas y espacios (ES-306); no reactiva, no cambia contraseña, no crea cuentas; 400 ES/EN | idénticos |
| R2 | Regresión de lo que no cambia: login con clave correcta de inactiva = 403 como hoy; recuperar contraseña e invitaciones sin cambios; «nuevo» sigue 201 | igual que main |
| R3 | Orden aceptación → hash → correo: mismo cuerpo `terms_required` para existente / inactivo / nuevo; política de contraseña y forma del correo responden igual para existente y nuevo | iguales |
| R4 | Tiempo (solo local, pareado y alternado, n=40 por camino: duplicado activo, duplicado inactivo, nuevo), PR frente a main. Reporto mediana, p90 y razón con intervalo. **Propuesta de umbral (la apruebas tú):** razón mediana dup/nuevo en PR entre 0,8 y 1,25; y muestro que main la incumple (sirve de control de que la prueba detecta el hueco) | umbral propuesto |
| R5 | Límite: 429 exactamente en la petición 31 (cuentan 201 y 400); cuerpo ES/EN; cabeceras `RateLimit-*` (reinicio ≈ 3600 s); sin 500; login, recuperar y demás rutas no se ven afectados; piloto de 6 tras la misma IP con 24 previas → 6×201; `REGISTER_RATE_LIMIT_MAX` ignorado con `NODE_ENV=production` y con `RAILWAY_ENVIRONMENT_ID` (arranco el servidor real con cada una); valores inválidos (0, −3, 1.5, abc, vacío) → 30 | según PR |
| R6 | Proxy/IP: (a) sin `TRUST_PROXY_HOPS` y X-Forwarded-For distintos → UN solo cubo compartido (cuantifico el bloqueo global); (b) con `TRUST_PROXY_HOPS=1` y un cliente que falsea el XFF a la izquierda → no evade el límite; (c) con =1 y XFF distintos por cliente (como Railway) → cubos separados | documento el comportamiento; (a) sin definir = hallazgo para Infra |
| R7 | Concurrencia: 10 registros simultáneos del mismo correo → 1 cuenta, sin 500; 40 simultáneos distintos → exactamente 30 admitidos y 10 con 429 (sin carrera en el contador) | sin 500, conteo exacto |
| R8 | Rendimiento: ahora TODO registro paga bcrypt (también los duplicados). Con una ráfaga de 30 registros duplicados, latencia de `/api/health` y de un login legítimo (p50/p95) frente a la línea base; pool de conexiones | **umbral propuesto:** p95 de `/api/health` < 1 s durante la ráfaga (a aprobar) |
| R9 | Mutaciones (siete): quitar `registerLimiter`; limitador después de `validateBody`; hash después de la consulta; reintroducir el 403 de inactiva; respetar el env en producción; aceptación después de la consulta del correo; max sin validar. Cada una debe ser detectada por las pruebas del PR y/o por mi guion | detectadas |
| R10 | Regresión: backend `npm test` en la cabeza y en main (**verifico si ES-87 y P1-8 ya fallan en main**, el PR dice «no verificado»); PostgreSQL real es-221, es-220, es-259, es-282, es-301, es-306; leo el diff de los 5 archivos de prueba cambiados (aserciones conservadas, ninguna debilitada) | verde o igual que main |
| R11 | Seguridad de entradas del registro: 25 cuerpos hostiles (reuso mi lote de #295) con el límite en juego → 400/429, 0 cuentas, 0 × 500; el mensaje no repite lo enviado | 0 × 500 |
| R12 | Higiene: diff sin secretos ni datos personales; `docs/DESPLIEGUE-RAILWAY.md` dice lo mismo que el código (30/h, en memoria, por réplica, `TRUST_PROXY_HOPS`) | coherente |
| R13 | Pantalla mínima (la única que toco, sin cambiar nada): con el límite en 2 local, el formulario real de registro muestra el aviso de límite ES y EN al tercer intento, sin errores de consola | aviso visible |

**Fuera de alcance / no se podrá verificar:** Railway real (valor de `TRUST_PROXY_HOPS`, IP vista detrás del proxy), más de una réplica (límite y contadores son por proceso), tiempo en Railway, enumeración residual «ya registrado» vs «nuevo» (decisión de Mauricio, opción A, hasta ES-12), barrido distribuido con muchas IPs, correo de verificación.

**Criterio de salida:** R1–R7, R9–R12 sin Crítico/Alto abierto; R4 y R8 dentro de los umbrales que apruebes; R6a documentado y comunicado. Un 500 por entrada inválida, un bypass del límite con XFF falsificado o la reactivación de una cuenta inactiva = no se aprueba.

**Pido:** (1) «Ejecuta» y aprobación de los umbrales de R4 y R8; (2) confirmar por nombre que `TRUST_PROXY_HOPS` existe en staging y producción (no el valor de secretos; este no lo es, pero basta el nombre y si es 1); (3) CI 4/4 y CLEAN sobre la cabeza.
