# Plan de pruebas v2 — ES-57 / PR #2 (línea base y correcciones P1)

[QA-Claude] · 23-oct-2026 · **BORRADOR. Requiere aprobación explícita de Mauricio o Alejo antes de ejecutarse.**
Sustituye al plan v1 publicado en ES-57 (comentario del 21-oct). Este documento no es un reporte de ejecución: no se ha corrido ninguna prueba.

- Objeto bajo prueba: rama `ES-57-linea-base`, commit **`d8533e6`** (el plan se rehace si el head cambia).
- Marco: `docs/elevation-skillmap/11-QA-Y-ACEPTACION.md` (capas aprobadas V-09, V-14 a V-16, V-20/V-21) y `12-OPERACION-Y-RELEASES.md`.
- Decisiones vigentes: Express/Sequelize/Postgres, Claude, Railway con Supabase. El PR no se fusiona hasta tener variables de producción, base (ES-9/ES-11) y QA aprobado.

## 1. Qué cambia respecto al plan v1

| Cambio | Motivo |
| --- | --- |
| Se retira la vista previa de Vercel como medio de validación (v1: ES57-06/07/08). | Decisión de hosting a Railway (ES-8/ES-57). El PR se valida por build, CI y pruebas locales hasta que exista el entorno de Railway. |
| Se añade una familia de casos por cada corrección P1-1 a P1-9. | El PR pasó de `bb22486` a `d8533e6` con 9 commits de seguridad que el plan v1 no cubría. |
| Se añade la capa de permisos (matriz ruta × rol) y se declara qué queda sin Postgres real. | Capas de `11-QA-Y-ACEPTACION.md`. |
| Se trata `npm audit` como criterio de salida con decisión explícita. | Dev reporta 19 vulnerabilidades en las dependencias fijadas (1 crítica, 7 altas). |
| Se verifica contra el commit real, no contra el comentario de Dev. | `11-QA-Y-ACEPTACION.md`: un check verde o un hilo resuelto no sustituye la evidencia. |

## 2. Alcance y fuera de alcance

**Dentro:** higiene del repo (índice, `.gitignore`, mayúsculas, duplicados); build; las 9 correcciones P1; verificación de que `vercel.json` y `api/index.js` siguen idénticos a `bb22486` (vía de reversión); dependencias; protección de `main`.

**Fuera, con motivo:**

| Fuera | Motivo | Dónde se cubre |
| --- | --- | --- |
| Postgres real (propiedad, consentimiento, revocación concurrente) | Las pruebas de Dev simulan DB/modelos; ES-57 no aprovisiona base | ES-9/ES-11 y cortes 1 y 3 |
| Entorno Railway, humo desplegado, reversión | No existe aún el entorno | Puerta del corte 1 (ES-40) |
| E2E en navegador, ES/EN, teclado y responsive | ES-57 no cambia pantallas | Cortes 1 y 2 |
| Llamadas reales a Claude y evaluación de 30 casos | ES-57 no cambia prompts ni lógica de IA | Corte 2 y 4 |
| Rendimiento y carga | No aplica: no hay entorno desplegado ni lógica nueva de producto. Se registran como dato informativo el tamaño del repo, el tiempo de build y el aviso de chunk > 500 kB que reporta Dev | ES-40 |

## 3. Entorno y datos

- Clon limpio del commit bajo prueba, sin tocar el checkout de nadie. Node 22 (y Linux o CI si está disponible; si solo hay Windows se declara).
- Datos 100 % sintéticos generados en ejecución. No se leen ni cargan `.env*`. No se publica ningún valor de secreto.
- Evidencia en `qa/evidence/ES-57/` (comandos, salida real, SHA probado). Scripts propios solo en `qa/`.

## 4. Casos

Tipo: **E** estático (lectura/git), **F** funcional, **S** seguridad, **R** regresión. Entorno: local (clon limpio) salvo indicación.

### 4.1 Higiene del repo (de v1, ajustada)

| ID | Criterio | Pasos | Esperado |
| --- | --- | --- | --- |
| ES57-01 (E) | `node_modules` fuera del índice | `git ls-tree -r <sha>` buscando `node_modules/` | 0 archivos |
| ES57-02 (E) | `.gitignore` efectivo | Crear localmente `node_modules/x`, `.env.local`, `supabase/.temp/x`, `dist/x`; `git check-ignore -v` | Los cuatro ignorados |
| ES57-03 (E) | Sin duplicados por mayúsculas | Rutas en minúsculas, duplicados; clon en FS sensible a mayúsculas | 0 duplicados; un solo `backend/message.js` |
| ES57-04 (E/F) | `require` consistentes y servidor sin `listen` al importar | `grep` de requires del modelo de mensajes; cargar el módulo del servidor sin puerto | Minúscula en todos; carga sin escuchar (`require.main === module`) |
| ES57-05 (F) | Build del frontend | `npm ci` y `tsc -b && vite build` | Exit 0 con salida real; aviso de chunk se anota, no bloquea |
| ES57-06 (E/F) | Política de privacidad intacta | `index.html` raíz idéntico a `main`; ruta y contenido en entorno cuando exista | Idéntico. La URL pública final se valida en ES-40 |
| ES57-07 (E) | Vía de reversión conservada | `git diff bb22486 <sha> -- vercel.json api/index.js` | Diff vacío (o cambio justificado en el PR) |
| ES57-09 (E) | `docs/` conservado y sin pérdida de commits | Comparar `docs/` con `main`; `git rev-list --count <rama>..origin/main` | Mismos archivos; 0 commits de `main` perdidos |
| ES57-10 (E) | `main` no cambia hasta la aprobación | `git rev-parse origin/main` antes y después | Idéntico |
| ES57-13 (E) | No se incluyen cambios locales ajenos | Diff de la rama contra su base | No aparecen archivos sin commitear de terceros |
| ES57-14 (E) | Protección de `main` | Consulta de solo lectura de la configuración de rama; no se deduce de un comentario | Se informa el estado real. Exigir PR y el check de CI correcto es condición previa al merge; si falta, hallazgo de proceso |

### 4.2 Correcciones P1 (nuevo)

Para cada P1, antes de ejecutar: **(a)** revisar el diff del commit contra su test; **(b)** confirmar que cada denegación se verifica también como "sin lectura ni escritura en el modelo"; **(c)** ejecutar el test propio y luego la suite conjunta.

Matriz de roles a probar donde aplique: anónimo, usuario, terapeuta, admin, board, superadmin, JWT inválido/expirado y firma ajena.

| ID | Corrección | Casos mínimos adicionales a los de Dev | Esperado |
| --- | --- | --- | --- |
| ES57-P1-1 | Registro / reactivación (35f7458) | Registro anónimo sobre cuenta inactiva con distintos casos de mayúsculas/espacios en el correo sintético; intento de cambiar rol por el cuerpo del registro; login inactivo; mensajes ES/EN del login | 403 sin escritura; contraseña, estado y rol sin cambios; registro nuevo 201; duplicado activo 400; ningún mensaje invita a reactivar por registro |
| ES57-P1-2 | Pricing (2d52839) | Lectura pública solo de lo activo; GET `/all`, POST, `/seed`, PUT, DELETE en ambos montajes por rol | Públicas solo las lecturas activas; el resto 403/401; admin y superadmin 200/201 |
| ES57-P1-3 | Manifiesto (e875ff4) | Historial, publicación y activación por `/api/manifest` y `/api/board`; lectura activa pública | Lectura 200; mutaciones e historial 403/401 a roles insuficientes; board/superadmin autorizados; sin transacciones al denegar |
| ES57-P1-4 | Solicitudes de plan (fe77fee) | Listado y aprobación/rechazo por ambos alias; `/me` de otro usuario; ID ajeno en la solicitud propia | Roles insuficientes 403/401; el usuario solo ve y crea las suyas |
| ES57-P1-5 | Matching (2208189) | `/pending` y `/:id/confirm` en ambos montajes; `/request` y `/choose` con identificador de otra persona | Usuario 403; admin/superadmin 200; elección filtrada por dueño |
| ES57-P1-6 | Documentos de terapeuta (2def6be) | Pendientes, descarga, aprobación y rechazo por `/api/therapist/validation` y `/api/junta`; subida con `therapistId` ajeno inyectado | Roles insuficientes 403/401 sin firma de URL ni lectura; dueño derivado del JWT; superadmin como revisor según el montaje existente |
| ES57-P1-7 | Decisiones sobre prompts (7eebcac) | approve / reject / rollback por `/api/admin` y `/api/superadmin`; propuesta y lectura del admin | Admin común y demás 403; solo superadmin decide; admin conserva propuesta y lectura |
| ES57-P1-8 | Instalación y despliegue (e82dfb4) | `npm run install` y carga de dependencias sin `node_modules` raíz; `api/index.js` exporta la app; `npm run build` | Instala, exit 0; el endpoint de despliegue no omite el control de acceso |
| ES57-P1-9 | JWT sin valor por defecto (d8533e6) | Arranque en `production` y en otros entornos con la variable ausente, vacía y solo espacios, para `server`, `api/index`, firmante y verificador; token de firma ajena; token expirado | Los arranques inválidos salen con error de configuración **antes** de abrir DB o puerto; con clave configurada el flujo autorizado funciona; ningún valor de secreto aparece en logs ni en la salida |

### 4.3 Seguridad transversal

| ID | Criterio | Pasos | Esperado |
| --- | --- | --- | --- |
| ES57-S01 | Sin secretos en el repo | Escaneo de patrones en el diff y en archivos `.env*` versionados, **solo por nombre de variable, sin abrir valores** | 0 secretos. Si hay uno, el detalle va **solo** en Jira (Crítico/Alto) y el PR dice "ver ES-57" |
| ES57-S02 | `ADMIN_EMAILS` sin verificar (señalado en `11-QA-Y-ACEPTACION.md`) | Buscar en el código cómo se usa y si concede rol por correo | Se documenta el comportamiento real; si concede privilegios sin otra verificación, hallazgo |
| ES57-S03 | Dependencias | `npm audit --omit=dev` y completo en `backend/` y `frontend/`; clasificar por alcance (producción vs. desarrollo) y por explotabilidad real en rutas expuestas | Sin Crítico/Alto de producción sin decisión documentada por Mauricio. **Propuesta de criterio**: el merge exige que los Altos/Críticos de producción estén corregidos o tengan decisión formal |
| ES57-S04 | Cambio de SDK de Anthropic (lock 0.79.0 → 0.36.3) | Revisar uso del SDK en `backend/` y que el módulo cargue y exponga lo que el código llama (con doble, sin llamada real) | Sin API inexistente; si hay riesgo de regresión, hallazgo Medio |
| ES57-S05 | Mensajes de error | Entradas inválidas (cuerpo vacío, tipos erróneos, IDs mal formados) en las rutas P1 | 4xx, nunca 500 ni trazas internas |

### 4.4 Ejecución de la suite de Dev

| ID | Criterio | Pasos | Esperado |
| --- | --- | --- | --- |
| ES57-T01 | Suite reproducible | `npm --prefix backend test` en clon limpio, Node 22 | Mismo resultado que reporta Dev (35 de 35). Si difiere, se informa con la salida real |
| ES57-T02 | Calidad de las pruebas | Revisión: HTTP real contra el servidor, qué se simula (DB, cifrado, proveedores) y qué aserciones comprueban "sin acceso al modelo" | Se documenta qué prueba y qué no. **No se acredita** integración con DB real |

## 5. Matriz de capas (marco `11-QA-Y-ACEPTACION.md`)

| Capa | En ES-57 |
| --- | --- |
| Build/CI | ES-57-05, T01. El check de CI requerido y la imagen Docker se verifican si ya existen; si no, "no verificado" |
| Unitarias con dobles | ES-57-T01/T02 (Claude y DB simulados) |
| Postgres real | **No aplica a ES-57**; sin base aprovisionada. Pasa a ES-9/ES-11 y cortes 1 y 3 |
| Permisos en staging | Se prueba la matriz ruta × rol en local con DB simulada. La prueba en staging queda para ES-40 |
| E2E navegador | No aplica (sin cambios de pantallas) |
| Rendimiento (propuesta de QA para sumarla al marco) | Solo datos informativos de build; la carga y los umbrales están en ES-40 |

## 6. Criterio de salida

**APROBADO** solo si: ES57-01, 02, 03, 04, 05, 06, 07, 09, 10, 13 y T01 en verde; los nueve ES57-P1 en verde; S01 sin secretos; ningún Crítico/Alto abierto en seguridad; S03 con decisión documentada.
**CAMBIOS REQUERIDOS** si falla un caso funcional o hay Medios sin decisión. **BLOQUEADO** si hay un Crítico/Alto o falta evidencia verificable.
Un check verde o un hilo resuelto no sustituye la evidencia. Los hilos del PR solo los resuelve QA con evidencia.

## 7. Riesgos y no verificable

- DB, cifrado y proveedores simulados: los resultados no acreditan aislamiento con Postgres real.
- Sin Railway ni staging aún: nada de despliegue, reversión ni humo.
- Cambio de runtime: Dev ejecutó en Windows con Node 24; se repite en Node 22 y, si es posible, en Linux.
- Historial del repositorio: `backend/elevation_vault.sqlite` sigue en el historial; solo se hace una muestra de escaneo de secretos, no un escaneo total.
- El plan se rehace si el head del PR cambia antes de la aprobación.

## 8. Costo estimado

LLM: 0 (sin llamadas a Claude). Otros servicios: ninguno.

## 9. Accesos que se solicitan (sin credenciales ni valores de secretos)

1. Confirmar el commit a probar si el head cambia.
2. Permiso de lectura de la configuración de protección de `main`.
3. Si existe el entorno de PR de Railway: su URL y el medio de acceso que decida Mauricio (nunca credenciales en Git ni en el PR).
4. Entorno local: Node 22 limpio.
