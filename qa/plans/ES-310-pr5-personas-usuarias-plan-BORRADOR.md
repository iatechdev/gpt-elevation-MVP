# [QA-Claude] BORRADOR de plan de pruebas — ES-310 PR 5 «Personas usuarias» (`/admin/users`), servidor y seguridad

**Estado:** borrador preparado el 15-nov-2026 antes de que exista el PR. NO es el plan publicado: cuando Dev abra el PR 5 lo ajusto al diff real (cabeza exacta, archivos, rutas), lo publico en ES-310 y espero la aprobación escrita de Infra. Fuentes: ES-310 comentarios 12035–12042 y 12049/12051, y el código de `main` (08499fa4): `backend/routes/adminUsers.js`, `backend/routes/invitations.js`, `frontend/src/pages/admin/adminUsersLogic.ts`.

**Alcance:** (a) migración visual de `AdminUsers*.tsx` (apariencia, sin cambios de flujo ni de texto); (b) condición 12042: el servidor rechaza con 403 lo que la vista de `admin` (no superadmin) oculta, y la interfaz deriva lo visible de `assignableRoles` / `invitableRoles` / `isSuper`, no de una lista duplicada. **Fuera:** textos nuevos, cambios de servidor (el ticket dice «sin cambios de servidor»: cualquier cambio en `backend/` se declara y se prueba aparte), Panel/Métricas/Guías/Catálogo (otros PR), lector de pantalla real, Firefox/Safari, staging.

**Entorno:** merge local de la cabeza con `main`; `server.js` REAL por HTTP + PostgreSQL desechable local con migraciones reales; proveedor de IA y correo simulados (0 costo); cuentas sintéticas: S (superadmin), A1/A2 (admin), B (board), T (profesional), P1/P2 (personas), con correos `.invalid`; Chromium + axe para la interfaz. Sin secretos, sin staging ni producción.

## Parte 1 — SERVIDOR: matriz de autorización (condición 12042)

| ID | Caso | Esperado |
|---|---|---|
| S1 | `POST /api/admin/usuarios/:id/reset-link` con A1 sobre P1, sobre T y sobre S | **403 `superadmin_only`**, sin crear enlace ni token (conteo de filas de restablecimiento sin cambio), con la denegación auditada (`recordDenied`); con S: 200 sobre P1/T; sin token: 401; P1/T/B: 403 |
| S2 | Eliminación: `DELETE /api/admin/usuarios/:id` con A1 | **403**, cuenta intacta (hash de la fila), denegación auditada; con S: se rechaza el borrado de uno mismo (403), 409 `has_dependent_data` cuando hay datos y «Desactivar en su lugar» sigue funcionando; la solicitud de eliminación de personas (ES-23) sigue siendo solicitud, no borrado físico, y exige el nombre exacto |
| S3 | `PUT /api/admin/usuarios/:id` con A1: rol `admin`, `superadmin`, `board` (fuera de `assignableRoles`) | **403** «No tienes permisos para asignar ese rol», fila intacta; roles `user` y `therapist`: 200 |
| S4 | `PUT …/:id` con A1 sobre A2 y sobre S (rol o estado) | **403 `target_rank`**, intacto; A1 sobre uno mismo: 403; con S sobre A1: 200; rol inválido: 400 |
| S5 | `POST /api/admin/invitations` con A1: roles `board`, `admin`, `superadmin` (fuera de `invitableRoles`/`INVITER_ROLES`) | rechazo del servidor (400/403 según el código real) y **0 filas** de invitación; `user` y `therapist`: 201; S puede los cinco; T/P1/B: 403; sin token: 401 |
| S6 | Barrido: TODAS las rutas bajo `/api/admin/usuarios`, `/api/admin/invitations`, emparejamientos y solicitudes de plan con: anónimo, P1, T, B, A1, S | anónimo 401; P1/T/B 403 en todas; A1 vs S según el diseño; ninguna ruta nueva sin protección (la lista sale del diff y de `routesOf`) |
| S7 | Ids hostiles en todas las rutas con `:id` (negativo, 0, decimal, 2147483648, texto, SQL) | 400 `invalid_id`, nunca 500 (ES-217) |
| S8 | Acciones permitidas al `admin` (la vista las muestra): desbloquear, activar/desactivar, rol `user`↔`therapist`, asignar profesional, aprobar/rechazar plan, confirmar emparejamiento | 200 con la regla de rango; sin regresión |
| S9 | Carrera ×20: A1 y S cambian el rol de la misma cuenta; dos solicitudes de eliminación; el último superadmin | una sola gana, sin dejar la plataforma sin superadmin activo (ES-215) |
| S10 | Una sesión que cambió de rol a mitad de camino (A1 degradado a persona o desactivado) | la siguiente solicitud ya recibe 401/403; la interfaz muestra la pantalla propia, no se rompe |
| S11 | Auditoría y filtraciones: las denegaciones quedan registradas (quién, qué, a quién; sin contraseñas, tokens ni correos de más); las respuestas 403 no revelan datos del objetivo | cumple; sin secretos en respuestas ni registros |

## Parte 2 — Interfaz ↔ servidor: coherencia (condición 12042)

| ID | Caso | Esperado |
|---|---|---|
| C1 | Para cada rol que la vista de admin OFRECE (`assignableRoles('admin')`, `invitableRoles('admin')`), probar contra el servidor | el servidor lo acepta (200/201) |
| C2 | Para cada rol que la vista de admin OCULTA (admin, superadmin, board) y cada acción oculta (enlace de restablecimiento, solicitar eliminación) | el servidor responde 403 (se verifica con S1–S5 desde la interfaz: clic imposible, y por API directa) |
| C3 | `invitableRoles` (cliente) frente a `INVITER_ROLES` (servidor): las dos tablas coinciden para `admin` y `superadmin` | prueba que falla si divergen |
| C4 | La interfaz deriva lo visible de `assignableRoles` / `invitableRoles` / `isSuper` (sin lista duplicada): revisión estática del diff + mutación (añadir `admin` a `assignableRoles`, quitar `isSuper` del botón de restablecer) | el cambio hace fallar una prueba del PR |
| C5 | Vista admin vs superadmin en el navegador: Gestionar, Invitar, filtros, marco («Administración» frente a «Superadministración») | exactamente lo diseñado (adendas 12039 y 12041) |

## Parte 3 — INTERFAZ (migración visual)

| ID | Caso | Esperado |
|---|---|---|
| U1 | Sin regresión funcional: pruebas `es-186-*`, `es-215`, `es-217`, `es-192` y las de roles siguen verdes **sin debilitar aserciones** (comparo cada aserción cambiada contra `main`) | verde; toda aserción reescrita por selector se declara |
| U2 | Tres pestañas con fallo independiente (Personas · Emparejamientos · Solicitudes de plan), «Invitar persona», diálogos Gestionar / Solicitar eliminación / Invitar / Confirmar emparejamiento / Rechazar con motivo | iguales al diseño aprobado; foco entra, Tab atrapado, Esc cierra, foco vuelve al botón |
| U3 | «Solicitar eliminación»: botón peligroso deshabilitado hasta escribir el nombre EXACTO; «Esta acción no se puede deshacer.»; 409 → «Desactivar en su lugar» | conservado |
| U4 | «Enviar enlace de restablecimiento»: nunca se escribe la contraseña de otra persona (decisión 24) | sin campo de contraseña en ningún diálogo |
| U5 | Estados: cargando, error por pestaña con «Reintentar», vacíos, enviando, conflicto 409, 403 y sesión vencida con pantalla propia | todos presentes y sin quedar en blanco |
| U6 | Estado con `Chip` de palabra y símbolo (no solo color), sin emojis ni estrellas | cumple |
| U7 | axe `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa` = 0 en claro, oscuro y sistema × ES/EN × 1360/390/320, en cada pestaña y diálogo; teclado (flechas/Home/End en pestañas); sin desborde; tabla → tarjetas a ≤ 640 px; objetivos ≥ 44 px; CLS ≤ 0,1 a 390 px con CPU×4 | 0 violaciones |
| U8 | Cero `style={{…}}` nuevos ni colores fijos en los archivos tocados; `adminUsersStyles.ts` retirado al final; ningún texto cambia (`adminCopy.ts` intacto; guardias ES-143/154) | cumple |
| U9 | El selector de tema, la preferencia recordada (con almacenamiento bloqueado) y la prop `pilotPreview` intacta | cumple |
| R1 | Frontend `npm test`, `tsc`, `eslint`, `build` + `build:check`; backend `npm test`; suites `*:pg` relacionadas (`es-186`, `es-192`, `es-215`, `es-217`, matriz de propietario `es-281`) | verdes |

## Mutaciones (sobre el código del PR y sobre el servidor, en mi árbol)
Quitar la comprobación de `superadmin` de `reset-link`; quitar la de `DELETE`; quitar `ROLES_PRIVILEGIADOS` de `PUT /:id`; quitar el rango (`target_rank`); ampliar `INVITER_ROLES.admin`; añadir `admin` a `assignableRoles`; quitar `isSuper` de los botones de la vista; hacer que el botón de eliminación no espere el nombre exacto. **Debe fallar una prueba del PR o una mía en cada una**; las que sobrevivan se reportan.

## Criterio de salida
CI 4/4 y CLEAN sobre la cabeza exacta; S1–S11, C1–C5, U1–U9 y R1 sin Crítico/Alto abiertos. Un admin que logre una acción de superadmin = BLOQUEADO. Todo cambio de servidor no anunciado = hallazgo.

## No se podrá verificar
Lector de pantalla real, Firefox/Safari, tipografías reales, tabla con muchas cuentas reales, staging/producción, envío real de correo (el correo se simula).

## Costo
0 LLM, 0 Railway/Supabase; PostgreSQL local desechable.
