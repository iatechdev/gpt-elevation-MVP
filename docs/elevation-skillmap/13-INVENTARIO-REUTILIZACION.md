# ES-8 · Inventario de reutilización (frontend + backend)

26-oct-2026 · Dev-Claude · Base: `main` 417e49b (incluye ES-57, ES-9, ES-61 y ES-66). Lectura estática del código; **no se ejecutó nada contra una base real ni contra el staging**. Los hallazgos de seguridad son propuestas de severidad para revisión de Mauricio y QA, no un informe de QA.

Marco: `frontend/` (React + TypeScript) y `backend/` (Express + Sequelize + Postgres) con Claude por el SDK de Anthropic. `platform/` y TechProfiler solo se usan como referencia; no se migra nada sin un ticket que lo pida.

## 1. Método y niveles de evidencia

| Nivel | Significado |
| --- | --- |
| **Probado** | Hay pruebas automáticas del backend (`backend/test`, HTTP/JWT reales con base y proveedores simulados). No es prueba con base real. |
| **Leído** | Revisé el código de la ruta o del helper y comprobé la condición a mano; sin prueba automática. |
| **Patrón** | Solo un barrido automático de rutas (middleware, uso de `req.user.id`, parámetros); **no equivale a verificar aislamiento**. |
| **No verificado** | No lo comprobé. |

Un README o un middleware de autenticación no acreditan aislamiento: cada afirmación de abajo cita el nivel.

## 2. Matriz de reutilización

| Área | Estado | Nivel | Notas |
| --- | --- | --- | --- |
| Autenticación: registro, login, bloqueo por intentos, JWT de 8 h | Reutilizable | Probado (registro/login) y Leído | Bloqueo a 15 min y limitador de login presentes. Sin verificación de correo, sin política de contraseña, correo sin normalizar. |
| Verificación de roles (`verificarToken/Admin/SuperAdmin/Board`) | Adaptar | Leído | Toma el rol del token; no revalida cuenta activa ni rol contra la base (INV-07). |
| Cierre de los 9 P1 de PR #2 (precios, manifiesto, matching, validación, prompts, JWT) | Reutilizable | Probado | Suite de `backend/test`: 76/76 ejecutadas por mí sobre `main` 417e49b (Windows, Node 24); con dobles de base y proveedores. |
| Chat con Claude (`routes/chat.js`, `utils/anthropic.js`) | **Adaptar** | Leído | Dueño por token, mensajes cifrados, manifiesto ético inyectado. Defectos: historial incorrecto (INV-04), sin saneado (INV-05), sin presupuesto (INV-06), sin límites ni crisis (INV-03). |
| Mood/check-in, valoraciones, progreso, recomendaciones | Adaptar | Leído (recomendaciones) / Patrón (mood, progreso) | Filtran por `UserId` del token. Modelos pensados para bienestar, no para evidencia profesional. |
| Módulo de terapeutas (`therapistRoutes`, `sessions`, `ClinicalNote`, `TherapySession`, `TherapistProfile`, `TherapistValidation`, videollamada Daily) | **Reutilizable, se conserva funcionando** | Leído (acceso) | Producto heredado. Riesgo aceptado hasta ES-19: el terapeuta asignado ve ánimo y valoraciones sin consentimiento por propósito. Arreglo mínimo del resumen por IA en ES-78 (INV-02). |
| Backoffice (admin usuarios, métricas, prompts, contenido, manifiesto, precios) | Reutilizable | Probado (P1) / Patrón (resto) | Accesos admin protegidos por middleware; `adminUsers` y `adminMetrics` sin leer a fondo. |
| Cifrado de datos (`utils/crypto.js`) | Adaptar | Leído | INV-08. |
| Capa de datos (`database.js`, `associations.js`, modelos) | Reutilizable con cambios | Leído | Pool acotado y `DATABASE_URL`. Sin migraciones (ES-59); `alter` ya es opt-in. TLS sin validar certificado (INV-10). |
| Contenido editable de landing (ES-66) | Reutilizable | Probado | Catálogo único en `shared/landing-content.json`, API pública y editor superadmin. |
| Landing (ES-61 a ES-64) | Reutilizable | Probado | En PR #11, #12 y #13 pendientes de QA. |
| Frontend: páginas de usuario, dashboard, onboarding, chat | Adaptar | Leído (estructura) | Funcionales; mezclan i18n con ternarios de idioma (INV-12). |
| Frontend: paneles terapeuta, admin, junta | Decisión de alcance / Reutilizable | No verificado (UI) | Dependen de la decisión sobre el módulo clínico. |
| Consentimiento por propósito y revocación | **Nuevo** | Leído (ausencia) | No existe en el backend ni en los modelos (`grep` sin coincidencias). |
| Detección y tratamiento de crisis, límites de acompañamiento | **Nuevo** | Leído (ausencia) | No existe en `backend/` ni en `frontend/src`. Referencia: `platform/server/domain/crisisDetector.ts`. |
| Puente profesional, esquemas privado/profesional, jobs y worker | **Nuevo** | Leído (ausencia) | No existe nada de ADR-001/002/003. |
| Skill Map, evidencias, rutas, catálogo, experimentos | **Nuevo** | Leído (ausencia) | Sin modelos ni rutas. |
| Exportación y eliminación de datos por la persona | **Nuevo** | Leído (ausencia) | Solo hay `DELETE /api/admin/usuarios/:id` (administrador). |
| Presupuesto de IA por persona, reintentos, cola | **Nuevo** | Leído (ausencia) | Hoy: tiempo de espera de 60 s y un reintento del SDK; sin topes. |
| Pruebas con base real y E2E | **Nuevo** | Leído (ausencia) | Todo lo existente usa dobles; frontend solo tiene una prueba de tema. |

## 3. Mapa de rutas y propiedad (18 routers, 84 rutas)

Montaje en `server.js`. «Dueño» = el recurso se filtra por el usuario del token. Nivel: L = leído, P = patrón.

| Router | Montaje | Control de acceso | Propiedad | Nivel / Observación |
| --- | --- | --- | --- | --- |
| `auth` (register, login) | público | limitador de login | n/a | L. Registro de cuenta inactiva rechazado (P1-1). |
| `landingContent` GET/PUT | público / superadmin | superadmin en PUT | n/a | L. Contenido público. |
| `pricing`, `plans` | público (lista activa) / admin | admin en el resto | n/a | P + suite P1-2. |
| `board` (`/api/manifest`, `/api/board`) | activo público / junta | junta o superadmin | n/a | P + suite P1-3. |
| `chat` (`/api/chat`, `/api/messages`) | token | cualquier rol autenticado | Dueño (`UserId` del token) | L. Sin presupuesto ni límites. |
| `mood` | token | token | Dueño | P |
| `ratings` | token | token | Dueño en escritura; `GET /rating/avg` devuelve un promedio global sin datos personales | L |
| `recommendations` | token | token | Dueño (`/:id/seen` usa `UserId`) | L |
| `progress` (`/api/user`) | token | token | Dueño | P |
| `plans/me`, `planRequests` | token / admin | admin en revisión | Dueño en `/me` y alta | P + suite P1-4 |
| `matching` | token / admin | admin en `/pending` y `/:id/confirm` | `/choose` filtra por `UserId`; el `therapistId` del cuerpo no se valida como terapeuta real, y `/confirm` lo asigna (solo admin) | L. Bajo. |
| `sessions` (terapeuta y usuario) | token | rol comprobado por ruta | `therapistId`/`patientId` del token en las consultas; creación exige paciente asignado | L (cuatro rutas representativas), P (resto) |
| `therapistRoutes` (`/api/therapist`) | **solo token** | **sin comprobación de rol** | Filtra por `therapistId = req.user.id` y `role: 'user'` en el paciente | L. Aislamiento por datos, no por rol (INV-09). Entrega estado de ánimo, valoraciones y notas clínicas descifradas. |
| `validation` (documentos de terapeutas) | token / superadmin | superadmin en revisión | `/upload` y `/status` por usuario | P + suite P1-6 |
| `adminUsers`, `adminMetrics` | admin | admin | n/a (administración) | P. `GET /:id/stats` expone datos de cualquier usuario a administradores: coherente con el rol, pero no hay auditoría de acceso. |
| `adminPrompts` | admin / superadmin | aprobar y rechazar: superadmin | n/a | P + suite P1-7 |

**Resultado:** no encontré acceso cruzado entre personas en las rutas leídas. Las rutas del usuario filtran por el identificador del token y las de terapeuta por la asignación. Lo anterior no acredita aislamiento en una base real: **falta la prueba A/B con Postgres real** (ES-18 y el plan de QA).

## 4. Consentimiento, privacidad y crisis

- **Consentimiento:** no existe ninguno. No hay campo, modelo, ruta ni texto de consentimiento por propósito ni de revocación. El estado de ánimo y las valoraciones los lee el terapeuta asignado sin que la persona haya autorizado ese propósito (INV-01, INV-02). El terapeuta no accede al chat.
- **Frontera privada:** hay un solo dominio de datos. Un terapeuta asignado lee estado de ánimo, valoraciones y sus propias notas (las redacta él). `resumen-ia` enviaba a Claude el nombre del paciente y las notas con un mensaje que lo presentaba como «asistente clínico»: corregido en ES-78 (PR #15, pendiente de QA). No existe separación privado/profesional.
- **Crisis:** el backend no detecta ni registra crisis; por tanto tampoco puede cumplir la regla de que ninguna señal de crisis llegue al motor profesional. Hay un detector de referencia en `platform/server/domain/crisisDetector.ts` (con pruebas), sin migrar.
- **Registros:** los errores se escriben con `console.error`; no revisé que los mensajes de error o los registros excluyan contenido de conversaciones (no verificado).

## 5. Prompt completo, LLM y presupuesto

Ensamblado en `chat.js`: aviso del terapeuta o aviso por defecto (de la base) + manifiesto ético (de la base) + historial descifrado + mensaje del usuario.

| Entrada al prompt | Origen | Saneado |
| --- | --- | --- |
| Mensaje del usuario | `req.body.message` | Solo `nonempty`; sin límite de longitud, sin delimitación. |
| Historial | `Message` del usuario, descifrado | Ninguno. **Toma los 20 mensajes más antiguos** (`order ASC`, `limit 20`): tras 20 mensajes el modelo no ve la conversación reciente (INV-04). |
| Aviso del terapeuta | `PromptVault` aprobado por superadmin | Control editorial, no técnico. |
| Manifiesto ético | `EthicManifest` activo | Ídem. |
| `resumen-ia` (terapeuta) | nombre del paciente y notas | Ninguno; el nombre se interpola en el prompt. |

- **Límites:** `max_tokens` 1000 (chat) y 400 (resumen); tiempo de espera de 60 s y un reintento del SDK; modelo configurable por `ANTHROPIC_MODEL` (por defecto `claude-haiku-5-5`; en staging se reportó `claude-sonnet-5-5`).
- **Presupuesto y abuso:** solo existe limitador en el login. `/chat`, `/recommendations/generate` y `resumen-ia` no tienen topes por persona ni por periodo (INV-06). El mensaje del usuario se guarda **antes** de llamar a Claude: un fallo deja un mensaje sin respuesta que se reenvía en el siguiente turno.
- **Salida del modelo:** el chat devuelve texto libre; no hay esquema validado, ni citas, ni claves canónicas (se necesitan para ES-27, ES-29 y ES-32).

## 6. Datos, cifrado y base

- Modelos existentes: `User`, `message` (contenido cifrado), `ClinicalNote` (cifrado), `MoodLog`, `SessionRating`, `SessionNote`, `TherapySession`, `TherapistProfile`, `TherapistValidation`, `MatchingRequest`, `PlanRequest`, `PricingPlan`, `WellnessRecommendation`, `EthicManifest`, `LandingContent`, `PromptVault`. Ninguno cubre diario, consentimiento, evidencia, competencias, rutas ni experimentos.
- **Cifrado:** AES-256-CBC con IV aleatorio, **sin autenticación** (no detecta manipulación). La clave sale de `DATA_ENCRYPTION_KEY` (o `DB_PASS`) rellenada o truncada a 32 caracteres, sin derivación de clave. `desencriptar` captura cualquier error y **devuelve el texto de entrada**, así que una clave equivocada o un dato corrupto no falla: puede devolver el texto cifrado como si fuera contenido (INV-08). En producción la ausencia de clave detiene el arranque.
- **Esquema:** `sequelize.sync()` crea tablas; `alter` solo con `DB_SYNC_ALTER=true`. Sin migraciones versionadas (ES-59). Sin esquemas privado/profesional ni roles de base distintos.
- **Conexión:** `rejectUnauthorized: false` con SSL activo: cifra, pero no valida el certificado del servidor (INV-10).
- **SQLite:** el archivo versionado se retiró del índice en ES-57; no encontré código de producción que lo use (no verificado contra la configuración desplegada).

## 7. Frontend

- 33 archivos `.tsx` en `src/` y 8.123 líneas en `pages/`; mayores: `AdminUsers` (833), `TherapistDashboard` (774), `TherapistPatient` (757), `UserDashboard` (752), `ChatPage` (667).
- i18n propio con 317 claves en `es` y 317 en `en` (mismo número). Sin embargo, 8 archivos conservan **172 ternarios `lang === 'es' ? … : …`** con texto fijo fuera del catálogo (Onboarding 37, UserProgress 41, UserDashboard 34, MyTherapist 19, MatchingModal 19, PricingPage 12, ChatPage 6, LandingPage 4): son la deuda para ES-38 y para el ES/EN de la regla no negociable (INV-12).
- Token en `localStorage` (clave `elevation_token`): lo leen las rutas protegidas del cliente; el control real está en el servidor.
- Sin pruebas de frontend salvo contraste de tema. Landing fase 1: en PR.
- **No verificado:** accesibilidad, rendimiento y comportamiento de las pantallas internas (`/app/*`, terapeuta, admin, junta) en navegador.

## 8. Referencias (no se migra nada)

| Origen | Aprovechable como referencia | Para |
| --- | --- | --- |
| `platform/server/domain/crisisDetector.ts` (+ pruebas) | Reglas y casos de detección de crisis | ES-21, ES-24 |
| `platform/server/domain/piiAnonymizer.ts` (+ pruebas) | Anonimización de datos personales antes de enviar a un modelo | ES-25, ES-27 |
| `platform/` (tRPC/Drizzle/MySQL) | Estructura de pruebas y contratos | Solo lectura |
| TechProfiler (Drizzle, Supabase, Gemini) | No revisado en este inventario (fuera del repositorio) | **No verificado** |
| `docs/hu-tecnicas`, `docs/PRD.md`, `docs/elevation-skillmap/*` | PRD, ADR-001/002/003 propuestos, mapeo de HUs | Contexto |

## 9. Hallazgos (severidad propuesta)

| ID | Sev. | Hallazgo | Evidencia | Ticket |
| --- | --- | --- | --- | --- |
| INV-01 | Alto | No existe consentimiento por propósito ni revocación; es requisito de las reglas no negociables | `grep consent` sin resultados en backend y frontend | ES-19 |
| INV-02 | Medio (Alto antes de ES-78) | El terapeuta asignado lee ánimo y valoraciones sin consentimiento por propósito; el resumen por IA enviaba el nombre real del paciente a Claude con texto «clínico». Con ES-78 el nombre ya no viaja y el texto es neutro; queda el consentimiento | `therapistRoutes.js` `/historia`, `/resumen-ia` | ES-78 (hecho, en QA); ES-19 |
| INV-03 | Alto | Sin detección ni tratamiento de crisis ni límites de acompañamiento en el chat | Sin coincidencias en el código; el límite depende solo del aviso editable | ES-21, ES-24 |
| INV-04 | Medio | El historial del chat usa los 20 mensajes más antiguos, no los más recientes | `chat.js` `order: ASC, limit: 20` | ES-13, ES-20 |
| INV-05 | Medio | Sin saneado ni delimitación del prompt (mensaje, historial, nombre y notas) | Sección 5 | ES-21 |
| INV-06 | Medio | Sin presupuesto ni limitación por persona en llamadas a Claude | Solo hay limitador en login | ES-22 |
| INV-07 | Medio | El rol y la actividad de la cuenta se toman del token (8 h); no se revalidan contra la base ni hay revocación | `middlewares/auth.js` | ES-18 |
| INV-08 | Medio | Cifrado sin autenticación, clave sin derivación y `desencriptar` que devuelve la entrada ante error | `utils/crypto.js` | ES-20 |
| INV-09 | Bajo | `/api/therapist/*` no comprueba el rol; el aislamiento depende de la asignación | `server.js` montaje con `verificarToken` | ES-18 |
| INV-10 | Bajo | Conexión a Postgres con SSL pero sin validar certificado | `database.js` | ES-9 / ES-59 |
| INV-11 | Bajo | Registro sin verificación de correo, sin política de contraseña y con correo sin normalizar. `ADMIN_EMAILS` figura en el ejemplo de variables pero no lo lee ningún código de `main`: el posible décimo P1 del registro no se reproduce aquí (no verificado en otras ramas) | `auth.js`, búsqueda de `ADMIN_EMAILS` | ES-18 |
| INV-12 | Bajo | 172 ternarios de idioma con texto fuera del catálogo i18n | Sección 7 | ES-38 |
| INV-13 | Bajo | `matching/choose` acepta cualquier `therapistId` y `confirm` lo asigna sin comprobar que sea un terapeuta activo (solo admin) | `matching.js` | ES-18 |

## 10. Decisiones y objeciones

- **Módulo de terapeutas (INV-02), decisión de Mauricio (26-oct):** se conserva funcionando; no se oculta ni se retira nada. Arreglo mínimo en ES-78 (sin nombre real en el resumen por IA y texto neutro). El riesgo restante (acceso a ánimo y valoraciones sin consentimiento por propósito) se acepta hasta ES-19; condición sugerida del piloto: no asignar terapeutas a las seis personas mientras tanto (no verificado cómo se arma el piloto). La objeción inicial de este documento se corrigió en el ticket.
- **Identidad canónica:** hoy `User.id` entero con rol único por cuenta y correo único. Propongo mantenerlo para el piloto y reservar un identificador de dominio profesional distinto (sin exponer el ID privado), según ADR-002. Decide Mauricio.
- **Almacenamiento:** Postgres único con `sequelize.sync()` sin `alter` hasta ES-59. Esquemas privado/profesional y rol del worker: nuevo, con pruebas SQL en base real.
- **Proveedor:** Claude por SDK (según ticket). Modelo configurable; sin evaluación de modelo (pendiente de Mauricio).
- **Reversión:** la reversión de despliegue está en Railway (ES-9). La reversión de esquema no existe sin migraciones.

## 11. Impacto en estimaciones y dependencias (propuesta, no aprobada)

Las horas son una **propuesta de Dev tras leer el código**, con incertidumbre alta; no están medidas y no deben sumarse como compromiso hasta que Mauricio las apruebe (ver 09-MAPEO).

| Ticket | Efecto del inventario | Propuesta de ajuste |
| --- | --- | --- |
| ES-18 Acceso y roles | Base existente reutilizable; añadir revalidación de cuenta, revocación y pruebas A/B con Postgres real (INV-07, 09, 13) | M · 8–12 h |
| ES-19 Consentimiento | Nuevo por completo; modelo versionado, revocación e invalidación de derivados; es base de ES-25 | L · 14–20 h |
| ES-20 Conversaciones y diario | Chat reutilizable; corregir historial (INV-04) y cifrado autenticado (INV-08); diario es nuevo | L · 12–18 h |
| ES-21 Límites y frontera privada | Nuevo; usar el detector de `platform/` solo como referencia; saneado del prompt (INV-05) | L · 12–16 h |
| ES-22 Presupuesto y reintentos | Nuevo; hoy solo tiempo de espera y un reintento | M · 8–12 h |
| ES-23 Exportación y eliminación | Nuevo; hoy solo borrado administrativo | M · 8–12 h |
| ES-13 Chat Brújula | Depende de ES-17 (tono) y de INV-04 | Sin cambio hasta ES-17 |
| ES-25 / 27 / 29 | Dependen de ES-19, esquemas privado/profesional y worker (no existen) | Reestimar cuando ES-19 esté diseñado |
| ES-38 Revisión ES/EN | 172 ternarios por migrar al catálogo | M · 8–12 h (con ES-37) |
| ES-59 Migraciones | Necesaria antes de cualquier tabla nueva | Sin cambio |

Orden recomendado: ES-18 → ES-19 → ES-20 y ES-21 en paralelo parcial → ES-22 y ES-23. ES-8 no cierra el inventario del frontend interno ni de TechProfiler.

## 12. Humo reproducible (no ejecutado)

No hay entorno con datos sembrados disponible para este ticket, así que **no se ejecutó**. Guion para el staging con datos sintéticos (URL en ES-9; nunca producción):

1. `GET /api/health` → 200 con el commit en ejecución.
2. Registrar `a@example.test` y `b@example.test`; iniciar sesión con cada una (JWT).
3. Con A: `POST /api/chat` con un mensaje; `GET /api/messages` devuelve solo los de A.
4. Con B: `GET /api/messages` no incluye nada de A. Cambiar identificadores en `PUT /api/recommendations/:id/seen` y comprobar 404.
5. Con A sin rol de terapeuta: `GET /api/therapist/pacientes` devuelve lista vacía (INV-09).
6. Sin token: `GET /api/messages` → 403; con token alterado → 401.
7. Con un usuario inactivo: login rechazado.
8. Registrar los resultados con entorno, commit y fecha.

## 13. No verificado

- Cualquier comportamiento contra Postgres real o contra el staging (ownership A/B, concurrencia, revocación).
- Rutas leídas solo por patrón (tabla de la sección 3) y `adminUsers` completo.
- Registros: contenido de los mensajes de error y de los logs.
- Que ninguna parte de producción use SQLite; configuración real de Railway y Supabase.
- Pantallas internas del frontend en navegador, accesibilidad y rendimiento.
- TechProfiler y todo lo que no está en este repositorio.
- Pruebas de dependencias (`npm audit`) sobre esta base: lo cubre el CI de ES-9, no se reejecutó aquí.
- Estimaciones de horas (sección 11): propuesta sin medir.
