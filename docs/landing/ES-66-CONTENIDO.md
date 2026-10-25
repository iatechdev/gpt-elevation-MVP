# ES-66 · Contrato de contenido de la fase 1

Base: main 573669b. Diseño: ES-60, comentario 10042 y DISENO-FASE1.md. Excepción autorizada por Alejo: añadir únicamente los campos landing.* al editor actual, sin cambiar su diseño o permisos. No se incluyen secciones S3–S15 nuevas.

## Contrato y textos

Catálogo único en shared/landing-content.json, consumido por API, editor, semilla y respaldo frontend. 23 claves, cada una con ES/EN. Etiquetas de accesibilidad añadidas al catálogo: salto al contenido, inicio e idioma. No admite HTML; los consumidores React deben renderizar texto, nunca dangerouslySetInnerHTML. Las cuatro claves nav de fase 2 están disponibles pero sus enlaces permanecen ocultos hasta que existan las secciones.

| Clave nueva | ES | EN |
|---|---|---|
| landing.nav.skip | Saltar al contenido | Skip to content |
| landing.nav.how | Cómo funciona | How it works |
| landing.nav.skillmap | Skill Map | Skill Map |
| landing.nav.pros | Para psicólogos | For psychologists |
| landing.nav.plans | Planes | Plans |
| landing.header.home | Elevation, inicio | Elevation, home |
| landing.header.login | Ingresar | Log in |
| landing.header.language | Idioma | Language |
| landing.header.es | ES | ES |
| landing.header.en | EN | EN |
| landing.hero.label | Acompañamiento + exploración profesional | Support + career exploration |
| landing.hero.title | Lo que has vivido cuenta. | What you have lived counts. |
| landing.hero.subtitle | Hay cosas que necesitas poner en palabras. Y otras que todavía no has reconocido en ti. Podemos empezar por cualquiera. | Some things you need to put into words. Others you have not yet recognised in yourself. We can start with either. |
| landing.doors.1.label | Hacer espacio | Make space |
| landing.doors.1.title | Ordenar lo que estoy viviendo | Sort out what I am going through |
| landing.doors.1.desc | Una conversación con ritmo propio, sin diagnóstico y sin prisa. | A conversation at its own pace, without diagnosis and without hurry. |
| landing.doors.2.label | Mirar otra vez | Look again |
| landing.doors.2.title | Reconocer lo que puedo aportar | Recognise what I can contribute |
| landing.doors.2.desc | Convierte tu experiencia en capacidades con evidencia que tú revisas. | Turn your experience into capabilities with evidence that you review. |
| landing.doors.go | Empezar | Start |
| landing.example.label | Ejemplo ilustrativo · caso ficticio · docencia | Illustrative example · fictional case · teaching |
| landing.example.title | Acciones → posibles capacidades | Actions → possible capabilities |
| landing.example.flow | Son hipótesis que tú puedes revisar, corregir o descartar. No es un diagnóstico ni una promesa de empleo. | These are hypotheses you can review, correct or discard. Not a diagnosis, not a job promise. |

## Lectura y escritura

GET /api/landing-content?lang=es o en, público: mezcla defaults y valores persistidos no vacíos del idioma solicitado. Otros idiomas resuelven ES como antes. Si Postgres falla, responde defaults sin datos personales ni detalles del error en logs.

PUT /api/landing-content usa verificarSuperAdmin existente (JWT y rol de servidor); visitante/usuario/terapeuta/board/admin no pueden editar. Idioma ES/EN, valor no vacío de hasta 5000 caracteres, clave de hasta 255. Claves nuevas landing.* fuera del catálogo se rechazan. Conserva claves antiguas y su edición para reversión. No hay nuevos endpoints ni cambios en identidad, esquema o migraciones.

El editor conserva los cinco campos anteriores y agrega los nuevos identificados por su clave. Los permisos y estados existentes no cambian. El contrato frontend landingText(key, lang, values) devuelve siempre el respaldo del idioma ante valor ausente, vacío o inválido. loadLandingContent cubre red, HTTP y JSON inválido. useLandingContent cancela peticiones al cambiar idioma y no presenta el idioma anterior mientras carga.

## Claves antiguas

Ninguna renombrada ni eliminada en esta entrega. hero_title, hero_subtitle, cta_primary, cta_final_title y cta_final_subtitle quedan como **legado para consumidores antiguos**, no se reutilizan para el diseño nuevo. step1_title/desc, step2_title/desc, step3_title/desc, hero_badge, cta_secondary y disclaimer continúan en la landing anterior hasta que sus secciones se sustituyan. No se borran filas ni se cambia contenido existente; reversión por código sin pérdida de ediciones. La nueva landing de ES-62/63/64 debe consumir exclusivamente landing.* para sus textos.

## Semilla de staging

Ejecutable optativo: node backend/scripts/seedLandingContent.js. Requiere APP_ENV=staging y LANDING_SEED_CONFIRM=staging en el entorno de ejecución; sin ambos rechaza antes de cargar configuración de DB. Infra debe verificar que la conexión pertenece al staging, nunca producción, antes de ejecutarlo. **No ejecutado contra ninguna base real en esta entrega.**

Usa el modelo LandingContent y una transacción Sequelize; findOrCreate por (key,lang), sin sync, alter, creación de tablas ni sobrescritura de ediciones. Segunda ejecución no modifica filas existentes. Solo contenido público aprobado; no datos de participantes. El texto de ejemplo requiere revisión final del especialista antes de publicación (D-07).

## Seguridad y privacidad

Solo contenido público, sin conversaciones, diario o datos de personas. No hay acceso por ID de propietario en estas rutas: el caso de abuso relevante es escritura con roles ajenos, cubierto por HTTP/JWT real y persistencia simulada. updated_by conserva el comportamiento existente del helper de identidad. Sin secretos ni datos reales en fixtures.

## Integración pendiente

Este PR prepara el contrato y editor. ES-62/63/64 harán visible el contenido nuevo y usarán useLandingContent; no se acredita aún el ciclo editor → nueva landing. La semilla real y persistencia Postgres en staging requieren verificación posterior. No declarar ES-66 integrada o Listo mientras falten esas comprobaciones.
