# [QA-Claude-2] Verificación posterior — ES-152 / ES-153 en staging (commit desplegado 8836e76, fusión de #139)

8-nov-2026 · Staging con las 4 cuentas de prueba (uso autorizado por Mauricio) · solo lectura · 0 llamadas a IA. Plan aprobado por Mauricio (Jira ES-153, comentario 11027; corrección 11028). Complementa la QA previa de QA Elevation (#138 sobre a33b6f60, #139 sobre 8c3f260d).

## Veredicto: sin Críticos ni Altos. 1 Medio (contraste) y varios Bajos abiertos; ES-204 cerrado.

## Qué pasa (OK)
- Commit desplegado = main (`/api/health` → 8836e76).
- Matriz de acceso por API: 4 inicios de sesión OK; 44/44 comprobaciones de rol OK (igual que antes del rediseño); el administrador no puede asignarse superadmin; listado sin claves.
- Barrido de 116 pantallas (4 roles × ES/EN × 390/1440): 0 errores 5xx/consola, 0 desbordes, 0 pantallas vacías, 0 claves crudas. Observaciones bajaron de 36 a 18.
- ES-204 cerrado: el panel del terapeuta ya no tapa el título «Mis pacientes» (encabezado estático; título en 231 px, encabezado hasta 199 px a 390 px). La etiqueta «ELEVATION THERAPIST» pasó a «PROFESIONAL». Pie «Sprint 9» eliminado.
- Teclado: el primer Tab es «Saltar al contenido» en los 4 roles (ES y EN); el salto funciona en terapeuta, admin y superadmin; el recorrido de Tab es ordenado y sin trampas (admin: 25 paradas lógicas incl. 243 elementos); foco visible en todos los elementos reales; menú móvil abre y Escape cierra (terapeuta).
- Rutas antiguas: /facilitation, /admin/users, /admin/dashboard, /app/diary/new responden con pantalla clara; /admin/usuarios, /dashboard, /app y una ruta inexistente llevan a la portada (sin 404 técnico).
- Peso de la landing (staging): 8 peticiones, ≈630 KB, carga ≈1,8 s, CLS 0,002 (1440) y 0,000 (390). No hay línea base anterior medida por mí: no se puede declarar delta.

## Hallazgos
| ID | Sev. | Dónde | Evidencia | Sugerencia |
|---|---|---|---|---|
| C1 | Medio | Persona (dashboard/chat), Admin, Superadmin | Contraste bajo AA: «Selecciona cómo llegas hoy para comenzar tu conversación» 2,52:1 (16 px); marca «ELEVATION» 2,39:1 (10 px); «Mensajes IA / día» 4,33:1; «ES» 4,20:1; admin «—» 2,52:1, «USUARIO» 4,33:1, «+ Crear usuario» 4,46:1; superadmin «Revisar →» 3,88–4,02:1 y «4» 3,95:1 | Subir esos tokens/colores a ≥ 4,5:1 (3:1 solo para texto grande) |
| B1 | Bajo (ES-206 p.1, sigue) | Persona: /app/dashboard y /app/chat | h1 = 0 en ES y EN (terapeuta/admin/superadmin ya tienen 1) | Añadir un h1 (puede ser visualmente oculto) |
| B2 | Bajo (ES-206 p.4, parcial) | Admin ES | «3 plan requests» sigue en inglés | Traducir |
| B3 | Bajo (ES-206 p.2, parcial) | 390 px | Persona: «Mis datos» < 24 px de alto; superadmin: dos «Revisar →» < 24 px | Objetivo mínimo 24 px (ideal 44) |
| B4 | Bajo (ES-206 p.5) | API | Sin sesión devuelve 403; con token inválido 401 | Unificar a 401 |
| I1 | Info | Rutas | /admin/usuarios (ruta antigua) lleva a la portada, no al listado de usuarios | Redirigir a /admin/users o aceptar |

## No verificado
Que el salto «Saltar al contenido» de la persona deje el foco dentro de `#space-main` (el destino existe con tabindex -1; mi comprobación automática no lo confirmó por usar otra regla); flujos de escritura; chat con IA real; lector de pantalla; Safari/Firefox; móvil físico; baseline de rendimiento previo.

## Reproducir
qa/staging-roles.cjs, qa/staging-ui-roles.cjs, qa/staging-153-extra.cjs, qa/staging-153-teclado.cjs (PR #100). Variables: STAGING_URL, CRED_FILE, PLAYWRIGHT_MODULE, OUT.
