# [QA-Claude-2] Informe — pruebas en staging con las 4 cuentas por rol (UI/UX + acceso)

Staging: https://backend-staging-e3a6.up.railway.app · 8-nov-2026 · Cuentas sintéticas qa.persona / qa.terapeuta / qa.admin / qa.superadmin @example.test (uso autorizado por Mauricio en el chat; las claves no se imprimen ni se guardan en ningún informe).
Alcance: solo lectura (inicio de sesión y navegación; no se enviaron formularios ni se crearon datos). 0 llamadas a IA. Autorización de alcance: Mauricio pidió «pruebas de UI/UX sin interrupciones»; no hubo plan formal previo, por lo que este informe es un barrido (no una puerta de aceptación).

## Veredicto: sin bloqueos de seguridad; 1 Alto por confirmar (datos), 2 Medios de UX, varios Bajos.

## Qué pasó (OK)
- Inicio de sesión de los 4 roles con el rol correcto (4/4).
- Matriz de acceso por API (48 casos): persona y terapeuta reciben 403 en rutas de administración, superadmin, junta y board; admin accede a administración pero no a superadmin; superadmin accede a todo lo suyo. El administrador no puede asignarse superadmin. El listado de administración no expone claves ni hashes. La persona de prueba aparece asignada al terapeuta de prueba.
- Barrido de UI: 116 pantallas (persona 13, terapeuta 3, admin 7, superadmin 6 × ES/EN × 390 y 1440 px): 0 errores 5xx, 0 errores de consola, 0 desbordes horizontales, 0 pantallas vacías, 0 claves crudas, 0 «undefined/null».
- Privacidad en pantalla: el panel del terapeuta muestra a la persona como «sin acceso — esta persona no ha autorizado compartir sus datos contigo»: es el comportamiento correcto.
- Foco inicial: queda en el cuerpo de la página (no cae en «Cerrar sesión»).

## Hallazgos
| ID | Sev. | Dónde | Evidencia | Sugerencia |
|---|---|---|---|---|
| A1 | Alto (por confirmar) | Admin → Usuarios | El staging tiene 226 usuarios; entre ellos hay una cuenta con nombre y correo gmail de apariencia personal real. Staging debe tener solo datos sintéticos | Mauricio confirma si es una persona real; si lo es, retirar o anonimizar en staging |
| M1 | Medio | Terapeuta → /therapist/dashboard a 390 px | El encabezado fijo mide 133 px y tapa el título «Mis pacientes» (empieza en 96 px) | Dar al contenido un margen superior igual a la altura del encabezado o evitar que el encabezado se parta en 3 líneas |
| M2 | Medio | Persona → Conversación (390 px) | El último mensaje de la IA aparece en inglés con la interfaz en español. Puede venir de pruebas E2E anteriores | Verificar que la IA responde en el idioma activo de la persona |
| B1 | Bajo | Persona → Dashboard y Conversación | Sin `<h1>` (h1 = 0) en ES y EN | Añadir un h1 (puede ser visualmente oculto) |
| B2 | Bajo | Varias pantallas a 390 px | 1–3 controles menores de 24 px (dashboard, siguiente paso, progreso, 5 pantallas de administración) | Objetivo táctil mínimo 24 px (ideal 44) |
| B3 | Bajo | Terapeuta | Etiqueta «ELEVATION THERAPIST» en inglés en la interfaz en español; en móvil «Terapeuta · Terapeuta» repetido; «1 Asignados» (concordancia); «Crear prompt» | Textos ES consistentes |
| B4 | Bajo | Admin | «3 plan requests» en inglés en la interfaz en español; pie «Elevation MVP · Sprint 9» desactualizado | Traducir; quitar o actualizar el pie |
| B5 | Bajo | API | Sin sesión devuelve 403; con token inválido devuelve 401 (código inconsistente; ambos niegan el acceso) | Unificar a 401 para «sin sesión» |
| I1 | Info | /facilitation | «La vista preliminar no está habilitada» (bandera apagada): esperado | — |

## No verificado
Flujos de escritura (crear/editar/eliminar, registro, envío de formularios), chat con IA real, revisión visual completa en inglés (solo heurística de texto en español), lector de pantalla, Safari/Firefox, móvil físico, rendimiento bajo carga, aislamiento entre dos personas (solo hay una cuenta de persona), contenidos de la landing pública desde estas cuentas.

## Reproducir
`qa/staging-roles.cjs`, `qa/staging-ui-roles.cjs`, `qa/staging-ui-focus.cjs` (PR #100). Variables: STAGING_URL, CRED_FILE, PLAYWRIGHT_MODULE, OUT. Capturas locales: C:\Users\Usuario\tools\qa2\stg-ui y stg-ui2.
