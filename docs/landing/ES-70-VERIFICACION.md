# ES-70 · Funciones de Elevation y Skill Map

[Dev-Codex], 28-oct-2026. Rama `ES-70-funciones-skillmap`, base `main`
`a2c953fe6b97a8020ac56a3a92e92acae0c12ed8`. Pendiente de revisión de Mauricio y QA.

## Diseño, fuente y alcance

Diseño aprobado: ES-60/10279 y ES-70/10282. Revisión previa completa de los 84 marcos de
[Figma](https://www.figma.com/proto/dbhSGDHaqnE4m5YoOhpV2M/Sin-t%C3%ADtulo)
en ES-68/10304; se reutiliza esa revisión y se volvieron a consultar los marcos S7/S9 en esta HU.
No se afirma extracción de medidas desde el archivo editable ni validación funcional del prototipo.
Copy y condiciones: `origin/docs/landing-diseno-fase2:docs/landing/TEXTOS-LANDING-FASE2-ES-EN.md`
y `DISENO-FASE2.md`. Se omite el titular adicional «A tu ritmo. Bajo tu control.» de Figma.

Plan y objeción de inventario publicados antes de código en ES-70/10312; coordinación de cabecera
en 10313. Estimación orientativa 10–14 h, excluyendo QA y publicación.

- S7: seis cards con título, cuerpo y estado textual independiente, todos editables ES/EN.
- S9: capacidades transversales/de dominio, cuatro estados de evidencia, cuatro niveles de autonomía,
  tres rutas descriptivas, experimento 20–45 minutos y bloque era de la IA.
- Nivel vacío sin evidencia, autonomía como guía y sin certificación, porcentajes de empleabilidad,
  predicciones de desaparición de profesiones ni ofertas inventadas.
- Las tres rutas son descripciones futuras con marcadores explícitos de fuente, fecha, barreras y brechas
  pendientes; no son resultados ni vacantes reales. Los estados de evidencia aparecen en lista separada
  de los chips de disponibilidad. No hay radar, puntuaciones ni datos de personas.
- La nota de puente reutiliza literalmente la copia ES/EN que Alejo aprobó en ES-68/10301/10303:
  experiencia principal, módulo profesional, chat privado separado y conexión futura todavía no disponible.
- Solo se activa el ancla real Skill Map; se conservan ambas puertas e Ingresar en `/login`.

Se reutilizan `LandingSection`, `LandingCard`, `LandingLabel`, navbar/botones/link daisyUI, con prefijo
`elv-`, tema local ES-61, Inter/mono y ocre decorativo. Nuevas cards editoriales con radio cero;
S7 una columna móvil/dos tableta/tres desktop; S9 paneles y rutas apilados en móvil. H2 por sección,
H3 por bloque, H4 por ruta; listas semánticas de estados y autonomía. Estados con texto, sin depender
del color. Menú móvil accesible, Escape con retorno de foco, ancla con margen bajo la cabecera sticky,
foco al abrir directamente `#skill-map` o recargarlo. No se añade movimiento.

Durante carga, error, vacío o respuesta parcial del CMS se mantienen defaults ES/EN. El cambio de
idioma no conserva respuestas del idioma anterior. No se introducen formularios ni estados de guardado.
Las nuevas claves entran automáticamente en los campos existentes de ES-66; no se modifica `/admin`.

## D-03 · Inventario y estados iniciales

**OBJECIÓN registrada:** la frase del ticket «no existen» está desactualizada respecto de main:
ya hay rutas de diario, derechos de datos, puente y Skill Map, y `/app/skill-map` monta ES-30.
La existencia de código no demuestra disponibilidad publicada ni cumplimiento del bloque completo.
Se usa el estado conservador permitido por la aprobación: **Próximamente / Coming soon** en los seis
bloques S7, en S9 y en sus tres rutas. No se desactiva ninguna función de la aplicación.

| Bloque | Evidencia y motivo para no anunciarlo disponible |
| --- | --- |
| Conversación con ritmo | Existe ChatPage y API de chat. RF-15 incluye una pregunta, pausas y silencio; ES-16 sigue en QA y no se ha verificado ese flujo publicado. |
| Ejercicios | ES-16 en QA; publicación especializada sigue pendiente. |
| Diario privado | API de diario en main; interfaz ES-15 en QA. El bloque completo no está verificado publicado. |
| Brújula editable | API de contexto en main; interfaz ES-26 en QA. |
| Español e inglés | Landing/chat contienen i18n; no se verificó toda la experiencia publicada, que es lo que promete el bloque. |
| Tus datos | API de derechos existe; recorrido visible de resumen profesional/borrado no se verificó desplegado. |
| Skill Map/rutas | `/app/skill-map` existe en main; recorrido completo depende de evidencia, contexto, rutas/plan y revisión de las HU relacionadas. La aprobación visual lo marca Próximamente. |

Los estados se cambian por sus claves CMS cuando se verifique la publicación completa; no se deducen
del rol, del idioma, del color ni del estado Jira. No se cambia a Disponible/En piloto con datos no verificados.

## Backend, seguridad y privacidad

Solo se amplía `shared/landing-content.json`. El GET público y PUT editorial existentes de ES-66
consumen ese catálogo; PUT sigue usando `verificarSuperAdmin` y las validaciones de longitud/idioma/texto.
No hay endpoints, modelo, tabla o migración nuevos, ni cambios de permisos/identidad/consentimiento.
No se consultan personas, conversaciones, diario, ánimo ni crisis. Por ello no aplica acceso por IDs
ajenos; sí se prueba la autorización de escritura editorial. React escapa las cadenas CMS.
Sin secretos, fuentes comerciales inventadas, llamadas LLM, datos reales ni operaciones en producción.

## Pruebas reales

Windows, Node 24.14.0; comparación con Node 22 instalado.

| Prueba | Resultado |
| --- | --- |
| `npm ci --no-audit --no-fund`, frontend/backend | Exit 0; 192/211 paquetes. Backend avisa deprecación de node-domexception. Sin cambio de dependencias/locks. |
| `frontend: npm run lint` | Exit 0, 0 errores y 0 advertencias. Sin silenciar reglas. |
| `frontend: npm test` | Exit 0, 34/34, 0 fallos/omitidos. Cinco casos nuevos ES-70. |
| Frontend con Node 22, `node --test test/*.test.mjs` | Exit 0, 34/34, 0 fallos/omitidos. |
| `frontend: npx tsc -b` | Exit 0; también ejecutado por build. |
| `frontend: npm run build` | Exit 0; 76 módulos. JS 549,32 kB / gzip 140,77; CSS 39,16 kB / gzip 7,81. Aviso de chunk >500 kB conservado, sin relajar umbral. |
| `frontend: npm audit --audit-level=low` | Exit 0; cero vulnerabilidades. |
| `backend: node --test test/es-66-content.test.cjs test/es-70-content.test.cjs` | Exit 0, 4/4. Defaults de todas las claves, edición ES/EN, validaciones y permisos. |
| `backend: npm test` | Exit 0, 249/249, 0 fallos/omitidos. |
| `backend: npm audit --audit-level=low` | **Exit 1, seis vulnerabilidades moderadas** uuid/dependientes. |
| Contraste ES-61 | Ambos temas pasan AA para los colores de texto usados; ocre oscuro/papel 5,54:1. Ocre decorativo 2,69:1 no se usa para texto. |

Los tests frontend renderizan componentes TSX reales con React SSR: contenido ES/EN completo,
seis cards, diez chips editables, cuatro estados, cuatro niveles, tres rutas, respaldo y escape HTML.
Pruebas HTTP con Express/mounts/JWT reales y el helper de solicitudes existente (equivalente de
supertest), **persistencia y proveedores simulados**. No se añadió supertest. El mensaje heredado
«Tablas sincronizadas en PostgreSQL» procede de `sync` simulado; no demuestra una conexión real.

Audit backend: GHSA-w5hq-g745-h8pq (`uuid <11.1.1`) y cadenas Sequelize/gaxios/teeny-request/
retry-request/@google-cloud/storage. No se aplicó el downgrade incompatible a Sequelize 3.30.0
sugerido por npm. Queda documentado para decisión de mantenimiento; no se declara audit verde.
El CI existente solo bloquea en high/critical, por lo que su éxito no elimina estas moderadas.

### Navegador compilado y reproducción

Desde frontend: `npm run build` y `node test/support/es70-preview.mjs`; abrir la URL local impresa.
Servidor exclusivo de pruebas en 127.0.0.1, sin DB, que sirve `dist` y simula respuestas CMS según
`?fixture=offline|empty|malformed|partial|long|race` con cookie local. `&theme=dark` simula solamente
la preferencia de color mediante un doble de `matchMedia`; el componente LandingSurface y CSS reales
seleccionan/renderizan el tema oscuro. No se cambia la preferencia del sistema operativo ni el bundle.

| Caso observado en navegador integrado | Resultado |
| --- | --- |
| 320/375/390/768/1024/1440 px | Sin overflow; cards S7 en 1/2/3 columnas y rutas en 1/3 según breakpoint. |
| Semántica DOM | Seis cards S7, diez chips, dos listas de cuatro elementos, tres rutas y ancla con foco. |
| Tema claro y oscuro | Inspeccionados visualmente; oscuro con preferencia simulada. Fondo oscuro calculado rgb(21,21,19). |
| Primer Tab/Enter | Salto visible y foco a #contenido. |
| Menú con Espacio, Enter y Escape | Abre por teclado; Escape desde enlace interior cierra y devuelve foco al botón. |
| Cambio ES/EN y ancla con Enter | Traduce todo S7/S9 y la nota; cierra menú y enfoca #skill-map. |
| Enlace directo y recarga #skill-map | Corregido y verificado: foco en sección, top 128,56 px frente a cabecera de 87 px en móvil. |
| API 503, vacía y JSON inválido | Defaults completos, seis funciones y estados conservados. |
| CMS parcial ES y EN | Cambian título, nota y estado de conversación; demás textos conservan respaldo. |
| Texto largo/HTML a 320 px | Sin desbordar, HTML visible como texto y cero imágenes creadas. |
| Respuesta ES demorada 2,5 s / cambio EN | Tras completar demora se mantienen título y estado del idioma EN. |

Las capturas se inspeccionaron en la herramienta; no hay comparación pixel-perfect ni archivo de
capturas versionado. Las pruebas del CMS en navegador usan fixtures; no prueban edición persistida
en la base desplegada. No se ejecutó voz de lector de pantalla, zoom nativo al 200% ni cambio nativo
de preferencia de color/movimiento; la regla reduced-motion existente se conserva sin nuevas animaciones.
EN nativo, disponibilidad de cada bloque y revisión especializada siguen pendientes.

## Coordinación y puerta de publicación

ES-68/PR #51 aún no forma parte de esta base. Ese PR retira las tres tarjetas antiguas (TCC/DBT,
24/7, AES-256) y sustituye el proceso. ES-70 no duplica esa retirada autorizada ni modifica zonas
privadas, CTA o pie. **No publicar la landing combinada hasta integrar ES-68 y pasar QA.**

Ambos PR modifican la cabecera y catálogo: al integrar deben conservarse las dos anclas únicamente
si existen sus secciones, sin duplicar el menú ni las claves comunes. No se abrió una rama apilada
sobre ES-68 ni se fusionó código ajeno. Los nuevos S7 y S9 se montan como componentes separados para
que ES-71 pueda insertar S8 entre ambos. No se implementan ES-69, ES-71 a ES-74 ni ES-65.

Pendiente: revisión de Mauricio/QA, resolución de integración con ES-68, preview desplegada y CMS/DB
real. No se ejecutan migraciones porque no hay cambio de esquema. No se fusiona desde Dev.
