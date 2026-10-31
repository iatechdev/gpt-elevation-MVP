# ES-69 · Verificación del tramo preparatorio

[Dev-Codex] · 29-oct-2026. Rama ES-69-privacidad-faq.

## Aprobación y alcance

Diseño general ES-60/10279 y ES-69/10281. Plan adaptado, textos ES/EN y objeciones publicados en ES-69/10429. Aprobación explícita del usuario registrada en 10430. Base inicial 2f237a4; se integró main db4ac9e en 364fcb0, conservando las HU ya fusionadas. No se incorporó la rama de ES-73 ni se duplicó el trabajo de ES-94.

S6 entre recorrido y funciones; S14 entre vinculación y cierre. Cinco puntos de privacidad/límites y diez preguntas independientes, cerradas por defecto, con button nativo, aria-expanded/controls, IDs estables, panel hidden y foco visible. El cambio de idioma conserva la apertura; una recarga la reinicia, sin persistir ni registrar preguntas consultadas.

Se reutilizan LandingSurface/Section/Card/Label/Button, tema ES-61 y daisyUI prefijado elv-. Sin nueva dependencia ni módulo collapse/radio. Las 40 claves landing.trust.* y landing.faq.* pasan por el catálogo y gestor existentes. Texto parcial, vacío, inválido u offline conserva respaldo ES/EN; HTML se escapa. Ninguna edición del CMS habilita la publicación.

## Publicación pendiente

VITE_ENABLE_LANDING_TRUST_FAQ debe ser la cadena literal true para montar las secciones. Ausente, false u otro valor: ocultas. Esta bandera prepara la revisión, no acredita aprobación especializada. No se añadió al Dockerfile ni se habilitó en staging/producción.

Derechos de datos: Próximamente. Conexión al espacio del profesional: pendiente. Precios: enlace neutral a /pricing, ruta ya existente; sin importe, promesa de gratuidad ni GET duplicado. /privacy conserva archivo y URL, sin anunciar su política heredada como actual: marcador pendiente no interactivo. Hash SHA256 del archivo preservado: b7a0c3ffa9ca5329489c1bbc2cb1f57af2c6ef2507e793af5871ce8062404b4c.

Requiere revisión especializada de los textos (ES-69/10281), revisión de inglés, D-08/política actual ES-65 y confirmación del alcance real del terapeuta antes de habilitar. El borrador de ES-65 y sus datos legales no se duplican aquí. Esta entrega no completa la publicación integral de ES-69.

## Backend y privacidad

No se añaden ni cambian endpoints, consultas personales, modelos, migraciones, helpers de identidad/consentimiento/revocación/derechos, permisos o datos de personas. GET /api/landing-content y PUT existente conservan su contrato. La extensión es declarativa en shared/landing-content.json; no se cambia /admin.

Test HTTP con Express y JWT reales, persistencia de LandingContent simulada: las 40 claves se leen/editan ES/EN; sin sesión, user, therapist, board y admin reciben 403 al escribir; JWT inválido 401; superadmin 200. Entradas inválidas 400. No se afirma PostgreSQL real ni aislamiento A/B de endpoints personales nuevos, porque no existen en ES-69.

No se publican recursos por país, teléfonos, tarifas, datos del piloto ni afirmaciones de eficacia. El arnés no usa .env, base de datos, cuentas, tokens, proveedores IA o almacenamiento externos. La UI nueva no guarda datos; contador de escrituras API del arnés: 0.

## Comprobaciones y resultados

| Capa | Resultado real |
| --- | --- |
| Frontend npm test tras integrar main | 159/159, exit 0 |
| Tres pruebas nuevas en Node 24 | 3/3, exit 0; repetidas tras ajuste de anclas |
| Tres pruebas nuevas en Node 22 | 3/3, exit 0 |
| Frontend lint | exit 0, sin errores/advertencias |
| Tipos y build estándar | npm run build incluye tsc -b; exit 0 |
| Build de revisión con bandera true | exit 0 |
| Backend suite completa Node 22 con loopback permitido | 389/389, exit 0 |
| Backend npm test Node 24 repetido con loopback permitido | 389/389, exit 0 |
| Backend ES-69 + ES-79 aisladas en Node 24 | 3/3, exit 0 |
| Frontend audit | exit 0, 0 vulnerabilidades |
| Backend audit | exit 1, 6 moderadas, 0 altas/críticas |
| git diff --check y sintaxis del arnés | exit 0 |

Build tras integrar main: 171 módulos; CSS 113.41 kB (gzip 16.67), JS 828.51 kB (gzip 221.39). Estándar y revisión tienen el mismo tamaño redondeado. El aviso de chunk >500 kB persiste; no se silenció ni aumentó el umbral. El crecimiento frente a la base inicial incluye las HU integradas de main. Sin cambios de dependencias/lockfiles propios de ES-69; audit backend reporta la cadena storage/uuid/Sequelize existente, sin ejecutar audit fix de alcance mayor.

Incidencias reales corregidas o repetidas: el primer test SSR no resolvía react desde data URL; se corrigió el import del arnés. Lint rechazó una función exportada junto a componentes; se separó en landingTrustFaq.ts sin desactivar la regla. Un build de revisión iniciado antes de terminar ese ajuste falló por export ausente; se repitió correctamente después. La primera suite Node 24 tras integrar main terminó con error de IPC «Unable to deserialize cloned data» en ES-79; aislada pasó. La primera ejecución Node 22 dentro del sandbox falló en peticiones fetch loopback; con permiso para el entorno local completó 389/389. No se ocultan esos intentos.

## Navegador local con CMS simulado

Reproducción desde frontend:

```powershell
npm run build
$env:VITE_ENABLE_LANDING_TRUST_FAQ = 'true'
npx vite build --outDir dist/es69-review
Remove-Item Env:VITE_ENABLE_LANDING_TRUST_FAQ
# Desde backend:
node test/support/es69-preview.cjs
```

El arnés anuncia dos puertos loopback: default sirve dist y review sirve dist/es69-review. CMS es simulado en ambos; el backend real/DB no participa en este recorrido de navegador. /__es69/cms/normal|offline|empty|malformed|partial|long selecciona fixtures sintéticos; /__es69/dark simula preferencia de tema; /__es69/text-zoom amplía la fuente raíz al 200% (prueba de tamaño de texto, no zoom nativo del navegador). /__es69/metrics devuelve modo y escrituras; POST /__es69/stop cierra ambos servidores. No se monta en la aplicación de producción.

Resultados observados:

- Build default: cero secciones nuevas. Review: cinco puntos y diez FAQ cerradas inicialmente.
- Enlace directo #preguntas-frecuentes: foco de sección y comienzo a ~113 px bajo cabecera; sin ocultar título.
- Enter abre primera pregunta; Espacio abre segunda; ambas permanecen abiertas. Tab siguiente llega a pregunta 3 con contorno ocre de 3 px. Al cerrar pregunta 9, Tab llega a la 10, saltando su enlace oculto.
- Cambio ES/EN: preguntas abiertas conservadas, texto e html lang cambiados. Ver planes / View plans enlaza /pricing solo dentro del panel 9 abierto.
- Política pendiente sin enlace. CMS offline, vacío o malformado conserva diez preguntas completas; parcial reemplaza solo la clave recibida.
- Contenido largo: <img> aparece como texto, cero imágenes inyectadas. No hay desbordes a 320/375/390/768/1440.
- Diseño regular: una columna S6 a 320/375/390, dos a 768/1440; FAQ una columna. Botón medido 69 px; cuerpo 16 px. Con raíz al 200%, cuerpo 32 px a 390 y sin desborde.
- Tema oscuro: fondo rgb(21,21,19), texto rgb(243,241,234); sin animación nueva. Contraste de tokens claro/oscuro cubierto por la prueba existente (ocre oscuro sobre papel 5.54:1).

Captura de revisión local fuera de Git: es69-faq-revision.jpg en la carpeta de visualizaciones de esta tarea. No demuestra publicación en clientes.

## Límites

Sin staging/producción, publicación, datos reales, PostgreSQL de integración, pruebas de proveedor IA, traducción nativa o revisión especializada. No se probó Safari/Firefox, lector de pantalla real ni zoom nativo de navegador; se probó ampliación CSS de texto al 200%. Las secciones existentes y las zonas privadas conservan su implementación. QA y Mauricio revisan; Dev no fusiona ni resuelve hilos.

## Correcciones de contenido QA · 31-oct-2026

[Dev-Codex]

Las claves ES/EN de privacidad y FAQ ahora describen el permiso específico por fuente y finalidad para leer chat, diario y hoja de vida con IA (ES-121), y el análisis de contexto profesional autorizado (ES-84). Proponer insights no comparte automáticamente los textos ni certifica competencias.

Se retiró la afirmación permanente «en preparación» para exportación/eliminación y el indicador «Próximamente». Ahora indican «Consulta disponibilidad / Check availability» y remiten a los controles de datos de la cuenta cuando estén habilitados. Es correcto con DATA_RIGHTS_ENABLED activo o desactivado, sin inferir una bandera del servidor desde el build público ni modificar su contrato.

Exento de nueva maqueta: corrección de textos solicitada por QA, sin cambio de layout, navegación ni flujo (AGENTS.md). Publicación desactivada y PR en borrador hasta revisión especializada. No se sobrescribieron personalizaciones del CMS ni se escribió en una base remota: revisar también estos valores existentes en el gestor antes de publicar. Fallback ES/EN conservado.
