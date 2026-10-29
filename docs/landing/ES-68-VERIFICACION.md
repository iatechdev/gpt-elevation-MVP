# ES-68 · Problema, módulos y recorrido

Desarrollo: [Dev-Codex], 28-oct-2026. Base `main` a2c953fe6b97a8020ac56a3a92e92acae0c12ed8;
rama `ES-68-problema-recorrido`. Pendiente de revisión de Mauricio y QA; no autoriza publicación ni merge.

## Diseño y alcance aprobados

- Aprobación de fase 2: ES-60, comentario 10279.
- Excepciones presentadas en ES-68/10301 y aprobadas directamente por Alejo en el chat;
  recepción registrada en ES-68/10303: nueva nota S4 ES/EN y retirada de tres tarjetas antiguas.
- Revisión de los 84 marcos y plan previo a código: ES-68/10304.
- Fuente visual: [Figma](https://www.figma.com/proto/dbhSGDHaqnE4m5YoOhpV2M/Sin-t%C3%ADtulo).
- Fuente de textos: `origin/docs/landing-diseno-fase2:docs/landing/TEXTOS-LANDING-FASE2-ES-EN.md`;
  condiciones: `DISENO-FASE2.md` en esa misma rama. Los textos prevalecen sobre Figma.

Se revisaron visualmente los 84 marcos antes de escribir frontend, en el visor público, incluidos
escritorio/móvil ES/EN, estados, oscuro, biblioteca y notas. No se midieron píxeles desde el archivo
editable ni se validó un prototipo funcional. El texto diminuto de los marcos largos ajustados al visor
no se usa como transcripción: la fuente textual manda.

| Marcos | Revisión y decisión |
| --- | --- |
| 1–4, S3 | Omitir «Tu experiencia no desaparece» y equivalente EN, ausentes del documento. |
| 5–8, S4 | Dos cards; pendiente de Elevation traducido en EN; Skill Map Próximamente. Nota nueva aprobada. |
| 9–12, S5 | Seis filas numeradas y nota de validación de 30 días. |
| 13–16, S6 | Tres espacios/puente y marcadores de recursos/URL; fuera del ticket, revisión especializada pendiente. |
| 17–20, S7 | Estados pendientes; «A tu ritmo. Bajo tu control.» adicional no se publica. Fuera de alcance. |
| 21–24, S8 | Estados y destino profesional pendientes; no publicar CTA sin destino. Fuera de alcance. |
| 25–28, S9 | Fuentes/fechas/barreras pendientes en muestras de rutas, no datos reales. Fuera de alcance. |
| 29–32, S10 | Caso de proyecto distinto del ejemplo de docencia ES-64. Se conserva ES-64 y su bandera. |
| 33–36, S11 | Texto abreviado y etiqueta «En construcción» adicionales; prevalece documento. Fuera de alcance. |
| 37–40, S12 | Precios, nombres y destacado son marcadores; no inferir plan gratis. Fuera de alcance. |
| 41–44, S13 | Alta/destinos pendientes; ambas puertas conservan `/login`. Fuera de alcance. |
| 45–48, S14 | «Diez respuestas, sin letra pequeña» adicional no se publica. Fuera de alcance. |
| 49–52, S15 | «El siguiente paso es tuyo» adicional y URLs pendientes. CTA/pie actuales se conservan. |
| 53–56, cabecera | Se activa únicamente Cómo funciona al existir S5. |
| 57–60, foco/menú | Menú móvil con Escape y retorno de foco; se conserva el salto real `#contenido`. |
| 61–64, S6 oscuro | Misma reserva de privacidad especializada; fuera de alcance. |
| 65–68, estados planes | Carga/error/vacío/sesión son muestras visuales; fuera de alcance. |
| 69–72, FAQ abierta | Variantes estáticas; fuera de alcance. |
| 73–76, componentes | Botones, chips, cards, acordeón y menú; muestras no confirman disponibilidad. |
| 77–80, tokens | Desktop 1440/1280 y margen 80; móvil 390/342 y margen 24; Inter, mono, filetes y ocre. |
| 81–84, entrega | Anotaciones internas, no copy público. Revisiones nativa/especializada siguen pendientes. |

## Resultado y decisiones técnicas

Se sustituye el proceso antiguo de tres tarjetas por S3, S4 y S5. Se retiran las tarjetas autorizadas
de AES-256, disponibilidad 24/7 y TCC/DBT/mindfulness. No se implementan las otras secciones de fase 2.
Hero, puertas, ejemplo de docencia y su posición/bandera, CTA final y pie conservan contenido y destinos.
La cabecera incorpora el ancla real de S5 y el menú móvil de los marcos aprobados; no aparecen anclas
de Skill Map, profesionales ni planes mientras sus secciones no existan.

Se reutilizan `LandingSection`, `LandingCard`, `LandingLabel`, botones/navbar/link daisyUI con prefijo
`elv-` y tema local ES-61. Las nuevas cards editoriales tienen filete y radio cero. H2 por sección, H3
por módulo/paso y lista ordenada de seis pasos. Números decorativos ocultos a tecnología asistiva,
lista conservada semánticamente mediante `role="list"`. Inter 800; etiquetas mono; cuerpo 17 px;
titulares 36–64 px. Dos columnas desde 768 px, una en móvil. CSS limitado a `.landing-scope`.
Las nuevas secciones siguen el marco desktop de 1280 px de fase 2; el marco existente de cabecera/hero
de 1080 px de fase 1 se conserva. No se añadieron dependencias ni se modificaron reglas de lint.

Todo texto nuevo, incluidos rótulos, estados, numeración y nombres accesibles, usa el catálogo
`shared/landing-content.json`, con respaldo ES/EN inmediato durante carga, error, vacío o respuesta parcial.
El menú mantiene `aria-expanded`, `aria-controls`, foco visible y cierre al salir de la cabecera.
No se añadieron formularios, estados de guardado ficticios ni animaciones. Se conserva reduced-motion.
La conexión futura con el espacio del profesional se declara explícitamente todavía no disponible.

### Backend, seguridad y privacidad

Las nuevas claves alimentan automáticamente el GET público y la lista de campos del CMS ES-66.
No se modificó código de `/admin`, ni roles, identidad, consentimiento, exportación/borrado, modelo o
esquema. No hay endpoints, tablas ni migraciones nuevas. No se leen datos de personas, diario, ánimo
ni conversaciones. No aplica prueba de IDs ajenos porque este ticket no agrega acceso a registros
personales. Sí se verifica la autorización de escritura editorial existente: PUT requiere superadmin.
React escapa las cadenas del CMS; no se interpreta HTML.

## Pruebas ejecutadas

Windows, Node 24.14.0; repetición frontend en el Node 22 instalado para contrastar con CI.

| Comando / prueba | Resultado real |
| --- | --- |
| `frontend: npm ci --no-audit --no-fund` | Exit 0, 192 paquetes; sin cambios de lock/dependencias. |
| `backend: npm ci --no-audit --no-fund` | Exit 0, 211 paquetes; aviso de deprecación `node-domexception@1.0.0`. |
| `frontend: npm run lint` | Exit 0, sin errores ni advertencias. |
| `frontend: npm test` | Exit 0, 33/33, 0 fallos, 0 omitidos. Cuatro casos nuevos ES-68. |
| Frontend `node --test test/*.test.mjs`, Node 22 | Exit 0, 33/33, 0 fallos, 0 omitidos. |
| `frontend: npx tsc -b` | Exit 0. |
| `frontend: npm run build` | Exit 0; 76 módulos. JS 542,66 kB / gzip 139,86 kB; CSS 38,79 kB / gzip 7,73 kB. Aviso Vite de chunk mayor de 500 kB; no se silenció. |
| `frontend: npm audit --audit-level=low` | Exit 0, 0 vulnerabilidades. |
| `backend: node --test test/es-66-content.test.cjs test/es-68-content.test.cjs` | Exit 0, 4/4. HTTP/JWT reales, persistencia simulada. |
| `backend: npm test` | Exit 0, 249/249, 0 fallos, 0 omitidos. Persistencia/proveedores simulados según cada suite. |
| `backend: npm audit --audit-level=low` | **Exit 1, seis vulnerabilidades moderadas** relacionadas con uuid y sus dependientes. No está verde. |
| Contraste de temas ES-61 | Prueba WCAG AA pasa en claro/oscuro. Ocre de texto sobre papel 5,54:1; decorativo 2,69:1, nunca texto. |

El test nuevo de frontend transpila y renderiza los componentes TSX reales con React SSR (sin doubles
de componentes) y comprueba todos los campos ES/EN, seis pasos, fallback y escape de HTML. La prueba
HTTP usa el servidor Express real, mounts reales y JWT firmados, con el helper de solicitudes HTTP
existente como equivalente de supertest; **no se añadió supertest**. Los modelos de persistencia son mocks.
El mensaje heredado de la suite «Tablas sincronizadas en PostgreSQL» procede de `sequelize.sync`
simulado en `support.cjs`: **no prueba una conexión ni escritura real en PostgreSQL**.

El audit backend informa GHSA-w5hq-g745-h8pq (`uuid <11.1.1`) y cadenas gaxios/teeny-request/
retry-request/@google-cloud/storage/Sequelize. La sugerencia forzada baja Sequelize a 3.30.0 y rompe
compatibilidad. No se aplicó ni se cambiaron dependencias fuera del alcance aprobado. Este aviso debe
tener decisión de mantenimiento/infraestructura; no se declara audit íntegramente verde.

### Navegador sobre build real

Se sirvió `frontend/dist` con `node test/support/es68-preview.mjs`, enlazado solo a 127.0.0.1.
El script es exclusivamente de prueba: selecciona respuestas CMS sintéticas con `?fixture=...` y cookie
local. No autentica usuarios, escribe en DB ni pertenece al runtime de producto.

Verificación en navegador integrado, tema claro, mediante controles y lectura del DOM real:

| Caso | Resultado observado |
| --- | --- |
| 320, 375, 390, 768, 1024 y 1440 px | Sin scroll horizontal; seis pasos en todos; una columna móvil y dos desde 768 px. |
| Desktop 1440 px | H2 calculados 64 px, cards lado a lado y números a la izquierda de los pasos. |
| Primer Tab / Enter | Foco visible en Saltar al contenido; Enter mueve foco a `#contenido`. |
| Menú 320 px, Espacio y Enter | Abre por teclado y expone navegación/idiomas/login. |
| Escape desde enlace interior | Cierra menú y devuelve foco a Abrir menú. |
| Ancla móvil Cómo funciona | Cierra menú, cambia hash y mueve foco a `#como-funciona`; sección a 127,77 px, cabecera termina a 87 px. |
| Idioma ES/EN | Traduce S3/S4/S5, nota aprobada y estado pendiente; sincroniza `html lang`. |
| `offline` (503), `empty` y `malformed` | Las tres secciones conservan defaults y seis pasos, sin pantalla vacía. |
| `partial`, ES y EN | Cambian título S3, nota de conexión y último paso; los demás campos mantienen defaults. |
| `long`, también 320 px | Título largo sin espacios no desborda; `<img ... onerror>` se ve como texto; cero imágenes creadas. |
| `race` | Respuesta ES demorada 2,5 s y cambio a EN; se conserva título/conexión EN tras completarse la demora. |

Para reproducir: build, arrancar el servidor local, abrir su URL impresa y cambiar `fixture` entre
`offline`, `empty`, `malformed`, `partial`, `long` y `race`. Cambiar idioma desde la UI, usar los anchos
indicados y recorrer Tab/Shift+Tab/Enter/Espacio/Escape. Solo se probaron respuestas sintéticas del CMS,
no el guardado y lectura contra la base desplegada. Las capturas se inspeccionaron en la herramienta;
no se adjunta una comparación pixel-perfect ni se afirma que exista un archivo de capturas versionado.

## No verificado / pendiente

- QA independiente y despliegue/preview con base real; edición CMS persistida de extremo a extremo.
- Voz real de lector de pantalla (se inspeccionaron landmarks, nombres y lista en DOM/árbol accesible).
- Inspección visual de oscuro, preferencia reduced-motion y zoom nativo al 200% en el navegador:
  no ejecutados; los tokens de ambos temas y la regla reduced-motion se conservan y el contraste sí se probó.
- Revisión nativa de EN y revisión especializada de privacidad; no se publican S6/S14 desde ES-68.
- Confirmación de disponibilidad de Elevation: se conserva marcador pendiente; Skill Map Próximamente.
- Auditoría backend con seis avisos moderados y aviso de tamaño de bundle. No se cierran como resueltos.
- No se ejecutaron migraciones porque no existe cambio de esquema; tampoco cargas, LLM ni pruebas en producción.
