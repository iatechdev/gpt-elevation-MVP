# ES-72 · Objetivos y estado del proyecto

[Dev-Codex], 28-oct-2026. Rama `ES-72-objetivos-estado`, base `main`
934ad03686984ee13b4569c3551e157b2fed77d4. Pendiente de revisión de Mauricio y QA.

## Diseño y decisiones

Aprobación de fase 2 en ES-60/10279 y ES-72/10284. Plan previo ES-72/10326 (estimación orientativa
4–6 h, excluye QA/despliegue). La revisión de los 84 marcos está registrada en ES-68/10304;
se volvieron a revisar los cuatro marcos S11, 33–36, en ES/EN y escritorio/móvil.
[Figma](https://www.figma.com/proto/dbhSGDHaqnE4m5YoOhpV2M/Sin-t%C3%ADtulo) es referencia visual;
`origin/docs/landing-diseno-fase2:docs/landing/TEXTOS-LANDING-FASE2-ES-EN.md` prevalece para textos.

Una sección pública S11, con H2, dos H3, lista semántica de cinco objetivos y estado en panel suave.
Desktop: etiquetas mono a la izquierda, lista/estado a la derecha. Móvil: una columna. Se reutilizan
LandingSection y LandingCard de daisyUI, tema local ES-61 y prefijo `elv-`; Inter 800, titulares 36–64 px,
cuerpo 17 px, filetes y ocre decorativo. CSS nuevo limitado a `.landing-scope .landing-project*`.
No hay controles, formulario, animación ni dependencias nuevas.

Figma abrevia el estado y añade «En construcción / In development». Se omite esa etiqueta adicional
y se conserva íntegro el párrafo aprobado del documento, incluida la referencia genérica a un grupo
pequeño. Objetivos y estado se distinguen de funciones disponibles. D-06: sin tamaño exacto, países,
idiomas del piloto, fechas, eficacia/tracción o testimonios. Español e inglés son un objetivo del
producto; no se presenta la composición del piloto.

Once claves nuevas `landing.project.*`: número/etiqueta/título, etiqueta de objetivos, cinco objetivos,
etiqueta de estado y párrafo de estado. Respaldo ES/EN inmediato durante carga, error, respuesta parcial
o vacía. El CMS ES-66 incorpora automáticamente los campos del catálogo compartido. No se muestran
valores no guardados como persistidos ni se introduce un estado de guardado ficticio.

## Backend, seguridad y privacidad

Se reutilizan GET público y PUT editorial de ES-66 con `verificarSuperAdmin`, validación de idioma,
valor y longitud existentes. Sin endpoints, modelo, tablas o migraciones nuevos; sin modificar `/admin`,
chat, `/app`, `/therapist`, `/board` o helpers de identidad/derechos. No se lee ni guarda información
personal ni se consulta el piloto. No aplica acceso por IDs ajenos; sí control de rol de edición.
React escapa las cadenas editoriales; no se inyecta HTML. Sin secretos, datos reales ni llamadas LLM.

## Pruebas reales

Windows, Node 24.14.0, con repetición frontend en Node 22.

| Prueba | Resultado |
| --- | --- |
| `npm ci --no-audit --no-fund`, frontend/backend | Exit 0; 192/211 paquetes. Backend avisa deprecación node-domexception. Sin modificar dependencias/locks. |
| `frontend: npm run lint` | Exit 0; 0 errores, 0 advertencias; reglas intactas. |
| `frontend: npm test` | Exit 0; 40/40, 0 fallos/omitidos; cuatro casos nuevos ES-72. |
| Frontend en Node 22: `node --test test/*.test.mjs` | Exit 0; 40/40, 0 fallos/omitidos. |
| `frontend: npx tsc -b` | Exit 0; también se ejecuta en build. |
| `frontend: npm run build` | Exit 0, 86 módulos. JS 568,76 kB / gzip 146,62; CSS 65,92 kB / gzip 10,77. Aviso Vite >500 kB conservado. |
| `frontend: npm audit --audit-level=low` | Exit 0; cero vulnerabilidades. |
| `backend: node --test test/es-66-content.test.cjs test/es-72-content.test.cjs` | Exit 0, 4/4; claves ES/EN editables, defaults y roles. |
| `backend: npm test` | Exit 0; 249/249, 0 fallos/omitidos. |
| `backend: npm audit --audit-level=low` | **Exit 1; seis vulnerabilidades moderadas** uuid/dependientes. |
| Contraste de los temas | Pruebas AA de ambos temas pasan; ocre de texto/papel 5,54:1. Ocre decorativo 2,69:1 no usado en texto. |

SSR transpila y renderiza el TSX real: cinco objetivos, copy completa ES/EN, D-06, todos los campos
editables, fallback por campo/idioma y escape HTML. HTTP usa Express/mounts/JWT reales con el helper
existente equivalente a supertest; **persistencia y proveedores simulados**. El log heredado «Tablas
sincronizadas en PostgreSQL» procede de `sync` simulado; no prueba DB real. Superadmin recibe 200 al
guardar; sin rol/user/therapist/board/admin reciben 403; JWT inválido recibe 401. Entradas inválidas 400.

Las seis moderadas del backend corresponden a uuid y cadenas Sequelize/gaxios/teeny-request/
retry-request/@google-cloud/storage (GHSA-w5hq-g745-h8pq). No se ejecuta el downgrade incompatible
a Sequelize 3.30.0 sugerido por npm. Se documentan para decisión de mantenimiento, sin declarar audit
verde. CI usa umbral high; su éxito no elimina estas moderadas. No se silenció el aviso de bundle.

### Navegador sobre build compilado

Reproducción: desde frontend, build y `node test/support/es72-preview.mjs`; abrir la URL impresa.
Servidor de pruebas solo en 127.0.0.1, sirve dist y simula CMS por `?fixture=offline|empty|malformed|
partial|long|race`. `&theme=dark` simula la preferencia de color mediante matchMedia; LandingSurface
y CSS reales seleccionan/renderizan oscuro. No cambia el SO ni se incluye el doble en el bundle.

| Caso | Observación real |
| --- | --- |
| 320/375/390/768/1024/1440 px | Cinco objetivos en todos, sin overflow horizontal; una columna móvil y dos desde 768 px. |
| ES/EN | Título, objetivos y párrafo completos; html lang sincronizado. |
| Claro/oscuro | Inspección visual de lista/panel; oscuro con preferencia simulada. |
| Vacío, 503, JSON inválido | Defaults completos; sección siempre presente. |
| Edición parcial ES y EN | Título, primer objetivo y estado cambian; el resto conserva defaults. |
| Cadena larga y HTML a 320 px | Sin desbordamiento; HTML se ve como texto y cero imágenes creadas. |
| Respuesta ES demorada 2,5 s y cambio EN | El título/estado EN se conservan tras completarse la demora. |
| Teclado/semántica | Salto al contenido y foco visible conservados; sección nombrada, H2/H3 y lista de cinco en árbol accesible. Sin controles nuevos. |

Las capturas se inspeccionaron en la herramienta; no se adjunta comparación pixel-perfect ni archivo
versionado de capturas. No se verificaron voz de lector de pantalla, zoom nativo 200%, cambio nativo
de color/movimiento ni CMS con DB desplegada. Reduced-motion existente conservado, sin animaciones nuevas.
EN nativo y publicación siguen pendientes; no se realizaron pruebas de carga, migraciones ni producción.

## Integración y publicación

S11 se inserta antes del CTA final como componente independiente. Hero, puertas `/login`, ejemplo
ES-64 y su bandera, cabecera, CTA final y pie se conservan. ES-68/PR #51 y ES-70/PR #52 aún no están
en esta base: no se copian sus secciones. Al integrar conservar orden S7/S9/S11 y unir las nuevas
claves sin duplicarlas. La retirada de las tarjetas antiguas sigue en ES-68: **no publicar la landing
combinada antes de integrar ese PR y obtener QA aprobado**. No se anuncia el piloto como terminado.

Pendientes de entrega integral: revisión de Mauricio/QA, integración de PR de landing y preview con
contenido persistido real. No se fusiona desde Dev ni se resuelven hilos de revisión.
