# Peticiones al backend por pantalla — noviembre 2026 (ES-200 · PERF-06)

Inventario con `frontend/scripts/perf-requests.mjs` sobre `main` (29a31e9e): Chromium contra el build de producción y el servidor sintético de PERF-01, con **120 ms de retraso fijo en cada respuesta de `/api/**`** para que las cascadas se vean en los tiempos de inicio. Mide el frontend, no la latencia de Railway ni de Supabase; las respuestas son sintéticas (los kB son de ese servidor, no de datos reales). Cada cifra sale de ese script.

«Oleada» = grupo de peticiones que empiezan antes de que termine la primera del grupo. `[1, 4, 1]` = la sesión, luego 4 en paralelo, luego 1 más (cascada).

## 1. Inventario

| Pantalla | Peticiones (distintas) | Oleadas en paralelo | Duplicadas | Respuesta (kB) | Cascada evitable |
| --- | --- | --- | --- | --- | --- |
| Landing | 2 (2) | [2] | ninguna | 0,0 | No |
| Entrar | 1 (1) | [1] | ninguna | 0,0 | No |
| Mi espacio | 6 (6) | [1, 4, 1] | ninguna | 0,1 | Sí: `my-therapist` esperaba a `upcoming` (corregido en este PR) |
| Chat | 4 (4) | [1, 3] | ninguna | 0,1 | No (solo sesión → datos) |
| Skill Map | 3 (3) | [1, 2] | ninguna | 10,4 | No (solo sesión → datos) |
| Panel profesional | 6 (6) | [1, 5] | ninguna | 0,2 | No (solo sesión → datos) |
| Evidencias | 3 (3) | [1, 2] | ninguna | 0,0 | No (solo sesión → datos) |
| Diario | 2 (2) | [1, 1] | ninguna | 0,0 | No (solo sesión → datos) |
| Progreso | 2 (2) | [1, 1] | ninguna | 0,0 | No (solo sesión → datos) |
| Mi plan | 4 (4) | [1, 3] | ninguna | 0,0 | No (solo sesión → datos) |
| Mi profesional | 2 (2) | [1, 1] | ninguna | 0,0 | No (solo sesión → datos) |
| Check-in | 1 (1) | [1] | ninguna | 0,0 | No (solo sesión → datos) |
| Administración | 3 (3) | [1, 2] | ninguna | 0,0 | No (solo sesión → datos) |

Hechos: (1) **ninguna pantalla repite la misma petición**; (2) todas las pantallas autenticadas empiezan con `GET /api/session` (la compuerta de rol) y solo después piden sus datos: es un orden necesario (la compuerta verifica antes de pintar) y no se toca; (3) el panel de la persona tenía una cascada real y evitable (`/api/sessions/user/my-therapist` esperaba a que terminara `/api/sessions/user/upcoming` sin depender de ella); (4) Check-in no pide datos al cargar.

## 2. Qué se corrigió

- **Panel de la persona (`UserDashboard`)**: las cinco lecturas (progreso, próxima sesión, profesional, recomendaciones, plan) salen a la vez; la del profesional ya no está encadenada. Tras emparejar con un profesional se refrescan las dos (próxima sesión y profesional), como antes. Todas las lecturas llevan una señal de cancelación: al salir de la pantalla se cancelan y no actualizan estado. Antes ninguna se cancelaba.
- **Prueba en navegador** (`es200-check.cjs`): con 300 ms de latencia las cinco lecturas empiezan con dispersión < 150 ms; el control con el `UserDashboard` de main da 326 ms (cascada) y falla. Al salir de la pantalla se cancelan lecturas en vuelo (en main no).
- Tiempo hasta el contenido útil del panel: la cascada eliminada ahorra una latencia de lectura (un viaje de ida y vuelta al backend) por construcción; con 120 ms de retraso simulado la última respuesta llegó en 1015 → 984 ms (mediana de 3 y 5 corridas; **dentro del ruido de la medición**, ±70 ms).

## 3. Hallazgo que NO se pudo corregir aquí (y por qué)

Entre que termina `GET /api/session` y arrancan las lecturas de datos pasan unos **400 ms sin actividad de red ni tareas largas** (p. ej. chat: sesión termina a ~420 ms, bloque de la pantalla cargado a ~447 ms, primeras lecturas a ~861 ms). Con un temporizador instrumentado se ven en esa ventana `setTimeout` de 160–290 ms creados por React: es la **limitación de parpadeo de Suspense** (tras mostrar el aviso «Cargando...», React retiene la pantalla nueva hasta ~300 ms). Se probaron dos remedios y **ninguno mejora la medición**:
1. Pedir el bloque de la pantalla actual al arrancar (en paralelo a la sesión): sin diferencia (mediana de 5 corridas, ±70 ms de ruido).
2. Bajar el bloque y las pantallas de la compuerta ANTES del primer pintado: sin diferencia o ligeramente peor.
Ambos se descartaron y no están en este PR. Quitar la espera exigiría rediseñar las fronteras de `Suspense` de `App.tsx` y de `RoleGate` (riesgo sobre la protección de rutas, ES-153): se propone como ticket aparte, con medición propia.

## 4. Lo que NO se hizo y por qué
- **Caché de lectura en memoria**: no hay peticiones duplicadas dentro de una pantalla que justifiquen una; entre pantallas (`/api/plans`, `/api/landing-content`) el ahorro sería una petición pequeña y el riesgo (invalidación por idioma/usuario, datos privados) no compensa. No se añadió ningún caché: **la prueba de aislamiento entre personas A y B no aplica** porque no se introdujo estado compartido ni persistente (sigue valiendo la verificación de propietario del servidor, que no se toca).
- **Cancelación en el resto de pantallas**: `UserDashboard` era la que lanzaba lecturas sin protección de desmontaje y con cascada. Otras pantallas ya protegen el desmontaje con una bandera (p. ej. `MyTherapist`: no actualiza estado, aunque la petición no se aborta). Quedan sin señal de cancelación, sin medir su efecto: `PlanPage` (usa hooks que sí la tienen), `TherapistPatient`, `BoardManifest`, `AdminContent`, `AdminPrompts` y `ProfessionalApplicationsPanel`. Sin evidencia de problema, no se tocan.
- **Carga progresiva**: el panel ya pinta cada bloque cuando llega su lectura (estados existentes del design system).
- **Endpoint agregado**: no se necesita (sin cambios de contrato de API).

## 5. Limitaciones
- Servidor sintético con retraso fijo, localhost, un equipo, solo Chromium, solo español, CPU sin limitar. Las diferencias de decenas de ms están dentro del ruido.
- El inventario mide la carga inicial de cada pantalla; no cubre las lecturas que dispara cada interacción.
