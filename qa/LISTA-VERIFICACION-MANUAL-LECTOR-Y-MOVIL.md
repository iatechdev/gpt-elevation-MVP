# Lista de verificación manual — lector de pantalla y móvil físico (A9, ES-45)

Para una persona probadora con las cuentas de prueba (la clave la entrega Mauricio por canal privado). Staging: https://backend-staging-e3a6.up.railway.app

Lector de pantalla: NVDA (Windows, Firefox/Chrome) o VoiceOver (macOS/iOS Safari). Anotar: pantalla, idioma, lo que se escuchó, y si se pudo completar la tarea. Capturas sin datos reales.

| # | Pantalla / cuenta | Qué comprobar | Esperado |
|---|---|---|---|
| 1 | Landing (sin sesión), ES y EN | Orden de lectura; «Saltar al contenido» es lo primero; el selector ES/EN anuncia el idioma activo; los estados «Disponible / En preparación» se leen junto a su tarjeta | Todo se entiende sin ver la pantalla |
| 2 | Registro (Crear cuenta) | Al enfocar la contraseña se leen los 5 requisitos; al escribir se anuncia «N de 5 requisitos cumplidos»; el error dice qué falta y el foco vuelve al campo | Requisitos anunciados; error anunciado |
| 3 | Persona → Conversación | El mensaje de la IA se anuncia al llegar; se lee el aviso de límite con fecha; el campo de mensaje tiene etiqueta | Se puede conversar solo con teclado |
| 4 | Persona → Diario (Nueva entrada, Abrir, Editar, Borrar) | Etiquetas de fecha y texto; confirmación de borrado anunciada; el foco no se pierde al guardar | Flujo completo sin ver la pantalla |
| 5 | Terapeuta → Mis pacientes | Un paciente «sin acceso» se anuncia como tal y con su motivo; la navegación por rol se lee ordenada | Claro |
| 6 | Admin → Usuarios | La tabla se lee por filas con encabezados; los botones «···» tienen nombre; los filtros tienen etiqueta | Cada botón dice a qué usuario pertenece |

Móvil físico (Android Chrome e iPhone Safari, 360–430 px): 1) la landing y el registro sin desplazamiento horizontal; 2) objetivos táctiles cómodos (≥ 44 px); 3) el teclado del móvil no tapa el campo del chat ni el botón «Guardar entrada»; 4) rotar a horizontal no rompe el diseño; 5) cerrar sesión desde cada rol.

Hallazgos conocidos que ya están en Jira: ES-209 (contraste), ES-206 (h1 faltante en dashboard y chat de la persona, objetivos < 24 px).
