# ES-31 (parte backend) · Contrato del catálogo curado de rutas, fuentes y recursos (PROPUESTA para aprobación)

27-oct-2026 · Dev-Claude · Cubre SP2-HU13 (RF-07, RF-08, RF-10, RF-17). **Es una propuesta: no hay código hasta que Mauricio (técnico) y Alejo (alcance) la aprueben.** ES-31 es de Alejo con Codex; Dev-Claude toma la parte backend porque Codex está fuera de contexto y porque destraba ES-32 y ES-33. La pantalla del backoffice y las fichas las construye Alejo con este contrato (puerta de diseño aplica a esa parte, no a esta).

## 1. Idea en una frase

Un catálogo **escrito, fechado y revisado por personas del cliente** desde el backoffice, versionado y publicable como el de habilidades (ES-29). El sistema **no trae contenido, no consulta páginas web y no infiere demanda**: solo guarda lo que el cliente curó, exige que cada dato lleve su fuente y su fecha, y marca como «por confirmar», «no publicado» o «desactualizado» lo que no esté verificado.

## 2. Qué contiene cada versión del catálogo

Una versión (`draft` → `published` → `archived`, un solo borrador y un solo catálogo vigente, publicado = inmutable) agrupa cinco clases de elementos, cada uno con clave estable, **JSON validado en servidor y claves cerradas**:

1. **Contextos del piloto** (`contexts`, máximo 6): `contextKey`, etiquetas ES/EN, nota. Acotan el catálogo a «los seis contextos»; **los define el cliente** (hoy el PRD dice que faltan profesiones, industrias y mercados por confirmar). Cada rol debe pertenecer a al menos uno.
2. **Fuentes** (`sources`): `type` (`official` \| `institutional` \| `market_report` \| `offer_page` \| `course_provider` \| `other`), título, URL `https`, país (o `null`), idioma, `publishedAt` (opcional), **`consultedAt` (obligatoria)**, `consultedBy`, `accessible` (sí/no, lo marca la persona que la revisó).
3. **Roles / rutas** (`roles`): `roleKey`, etiquetas ES/EN, industria, **mercado** (un país por ficha: Colombia y Dinamarca van separadas), idiomas exigidos (o `unknown`), modalidad, tareas habituales (ES/EN), barreras de entrada (ES/EN), capacidades (`skillKey` del catálogo de ES-29 + `essential` \| `optional`), `contexts`, fuentes, **revisión de dominio** (`reviewedBy`, `reviewedAt`, obligatoria para publicar) y la **habilitación**: `regulated` + nota ES/EN + fuente. *El sistema nunca afirma elegibilidad ni la infiere de la residencia.*
   - Cada tarea lleva su **exposición a la IA** (RF-17): `sourced` (con fuente), `hypothesis` (marcada como hipótesis) o `unknown`. **Sin porcentajes ni «sin futuro»**: una nota con porcentaje o con cifra de reemplazo se rechaza.
4. **Ofertas** (`offers`): título, organización, URL de la página oficial `https`, mercado, idioma, modalidad, `postedAt` (opcional), `checkedAt`, **salario `{published: true, text}` o `{published: false}`** (se muestra «no publicado»), y la **verificación humana** (`verifiedBy`, `verifiedAt`). Solo con verificación **vigente** (≤ 14 días) la oferta se etiqueta `current`; si no, `unverified` o `expired`. Máximo 10 ofertas por rol y 60 en total: no se copian bases de vacantes. **No hay ningún campo de volumen ni de demanda.**
5. **Recursos** (`resources`): lectura o curso, título, URL `https`, proveedor, **propósito**, idioma, nivel (`introductory` \| `intermediate` \| `advanced`), duración, **precio `{published: true, amount, currency}` o `{published: false}`** (se muestra «por confirmar»), la **brecha** que atiende (`linkedSkillKey`) y el **ejercicio** que mostrará el aprendizaje (ES/EN). Entregar un curso no acredita competencia.

## 3. Reglas que el servidor impone siempre

- **Publicar exige completitud:** todo rol con mercado, al menos una fuente con `consultedAt`, revisión de dominio, al menos un contexto y una exposición a la IA por tarea; toda oferta con salario declarado y verificación; todo recurso con propósito, ejercicio, nivel, idioma y precio declarado. Si falta algo: 422 con la lista por elemento, y no se publica.
- **Referencias cruzadas válidas:** cada `sourceKey`, `contextKey` y `roleKey` mencionado debe existir en la misma versión.
- **El sistema no consulta nada en internet.** Las URLs son datos; «vigente», «accesible» y «verificada» son afirmaciones **de una persona con nombre y fecha**, nunca de un robot. Sin consulta actual, la ficha se entrega como ficha ocupacional con una tarea de verificación.
- **Frescura al leer:** una fuente consultada hace más de 180 días o con `accessible: false` se devuelve `stale: true` y **no se presenta como confirmación actual**; una oferta con verificación de más de 14 días pasa a `expired`.
- **Texto saneado** (normalización de ES-21 y enmascarado de secretos), longitudes máximas y claves extra rechazadas. Nada de HTML.
- **No se inventa nada:** no hay semilla de contenido; el catálogo sale vacío. Sin catálogo publicado, las rutas (ES-32) responden «catálogo no disponible» y ofrecen revisión humana.

## 4. API

Backoffice (`verificarAdmin`: roles `admin` y `superadmin`; igual que ES-29):

| Ruta | Efecto |
| --- | --- |
| `GET /api/admin/route-catalog` · `POST` | versiones · crea el único borrador (copia el vigente) |
| `GET /api/admin/route-catalog/:id` | versión completa con lo que falta para publicar |
| `PUT/DELETE /api/admin/route-catalog/:id/:kind/:key` | crea, reemplaza o quita un elemento del borrador (`kind`: `contexts` \| `sources` \| `roles` \| `offers` \| `resources`) |
| `POST /api/admin/route-catalog/:id/publish` | publica (inmutable); registra quién y cuándo |

Personas autenticadas (solo lo publicado, con la frescura ya calculada): `GET /api/route-catalog` y `GET /api/route-catalog/roles/:roleKey`. Función de servidor `getPublishedRouteCatalog()` para ES-32. Los nombres de quien revisó no se publican a participantes: solo la fecha y que la revisión de dominio existe. *(Decisión abierta 5.)*

Errores estables: 400 `invalid_input` · 404 `catalog_not_found` · 409 `draft_exists` / `catalog_not_editable` / `conflict` · 422 `incomplete_catalog` (con `missing` por elemento) · 503 `catalog_unavailable`.

## 5. Datos y reversión

Dos tablas nuevas: `RouteCatalogs` (versión, estado, publicación) y `RouteCatalogItems` (`catalogId`, `kind`, `itemKey`, `data` JSON; único por `(catalogId, kind, itemKey)`). Índices únicos parciales con **nombre explícito** (lección de ES-29: Sequelize nombra por columna). Ningún dato personal. Reversión: el código anterior las ignora; no se borran.

## 6. Pruebas previstas

Roles (solo admin escribe; participante lee solo lo publicado; sin sesión 403) · cada regla del §3, una por una · referencias cruzadas rotas · contexto fuera del máximo de 6 · rol sin fuente fechada, sin revisión de dominio o con mercado ausente · oferta sin salario declarado, con verificación vencida o sin ella, con más de 10 por rol · recurso sin precio declarado / sin ejercicio · tarea con porcentaje de reemplazo o «sin futuro» · profesión regulada sin nota de habilitación · URL `http`, con credenciales o `javascript:` · fuente antigua / inaccesible → `stale` · publicación inmutable y concurrencia en **Postgres real** (dos borradores, dos publicaciones a la vez) · que el módulo no importe nada de red · mutaciones de los controles críticos · errores ES/EN.

## 7. Lo que no cubre

El **contenido** (los seis contextos, roles, fuentes, ofertas y recursos reales: lo carga el cliente; sin él, ES-32 no puede proponer rutas); la interfaz del backoffice y las fichas (Alejo/Codex); comprobar páginas web (siempre humano); proponer rutas (ES-32); validar `skillKey` contra el catálogo de habilidades (ver decisión 7).

## 8. Decisiones abiertas para aprobar

1. **Seis contextos definidos por el cliente** como parte del catálogo (máximo 6; todo rol pertenece a uno). ¿De acuerdo?
2. **Verificación humana de ofertas** con vigencia de **14 días** y el sistema sin consultar páginas. ¿Apruebas el plazo?
3. **Topes:** 10 ofertas por rol y 60 en total; ningún campo de demanda o volumen. ¿De acuerdo?
4. **Frescura de fuentes:** 180 días (como las líneas de ayuda de ES-21) y `accessible: false` → no es confirmación actual. ¿De acuerdo?
5. **Lectura para participantes** (`GET /api/route-catalog`) sin nombres de revisores. ¿De acuerdo?
6. **Alcance y horas:** la parte backend la hago yo; el ticket tiene 8 h (6–10) de Alejo/Codex para todo ES-31. Estimo **10–12 h solo del backend** (cinco clases de elementos, validación cruzada, publicación, lectura, Postgres real y mutaciones). Sugiero registrarla como subtarea de ES-31.
7. **Validación de `skillKey` contra el catálogo de habilidades (ES-29):** propongo **no** acoplarla aquí (ES-29 aún no está fusionado y evita otra capa de PR apilados); en publicación solo se valida el formato, y ES-32 al leer marca `skillMissing` si la clave ya no existe. ¿De acuerdo?

**Estimación total:** 10–12 h (backend). Sin contenido real del cliente el catálogo queda vacío y la cadena ES-32 → ES-33 no puede probarse con datos reales.

## 9. Estado de la implementación (aprobada el 27-oct-2026)

**Respuestas de Mauricio a las decisiones y cómo se aplicaron**
1. *«Defínelos tú»* (los seis contextos): **no se inventan contextos reales de las seis personas** (el PRD dice que faltan profesiones, industrias y mercados por confirmar). Se definieron **seis contextos SINTÉTICOS de prueba** (educación → formación corporativa, contabilidad → análisis financiero, salud → gestión de proyectos de salud, ventas → éxito del cliente, administración → operaciones, comunicación → estrategia de contenidos), marcados `synthetic` y con prefijo «[SINTÉTICO]», para analizarlos con el cliente. El cliente define los reales en el backoffice.
2. y 3. *«Crea unas de pruebas y las analizamos»*: los **parámetros** (14 días de vigencia de la verificación de ofertas; 10 ofertas por rol y 60 en total) quedan en `backend/config/routeCatalogPolicy.json` y se pueden cambiar sin tocar código; el catálogo sintético trae 3 ofertas (una vigente sin salario publicado, una vigente con salario de prueba, una con verificación vencida).
4. *«Desde que se marquen inaccesibles»*: una fuente marcada `accessible: false` es `stale` **desde ese momento**. Se **mantiene además** el umbral por antigüedad (180 días, en el mismo archivo de política) porque el PRD (RF-08) dice que una fuente antigua tampoco se presenta como confirmación actual; si Mauricio prefiere quitarlo, es cambiar un valor.
5. Lectura para participantes sin nombres de revisores: aplicada.
6. Registrada como subtarea de ES-31 (la parte backend).
7. La validación de `skillKey` contra el catálogo de habilidades (ES-29) **se acopla cuando se trabaje ES-32**; aquí solo se valida el formato.

**Código:** `backend/RouteCatalog.js`, `RouteCatalogItem.js`, `utils/routeCatalog.js`, `routes/routeCatalogAdmin.js` (montada en `/api/admin/route-catalog`), `routes/routeCatalog.js` (lectura, en `/api/route-catalog`), `config/routeCatalogPolicy.json`, `seeds/routeCatalogSynthetic.cjs` y `scripts/seedRouteCatalogSynthetic.js`.

**Contenido sintético y producción:** cada elemento sintético lleva `synthetic: true`; **el servidor se niega a publicar un catálogo con contenido sintético** (`422 synthetic_content_not_allowed`) salvo que el entorno defina `ALLOW_SYNTHETIC_CATALOG=true` (staging; producción nunca lo define), y el script de semilla se niega a correr con `NODE_ENV=production`. Las URLs sintéticas usan `example.org` (dominio reservado): ninguna fuente, oferta, precio ni salario es real.

**Errores estables:** 400 `invalid_input` · 404 `catalog_not_found` / `role_not_found` · 409 `draft_exists` / `catalog_not_editable` / `catalog_limit` / `conflict` · 422 `incomplete_catalog` (con `missing` por elemento) / `forbidden_label` / `synthetic_content_not_allowed` · 503 `catalog_unavailable`.

**Pendiente tras fusionar #25 (ES-23):** ninguna tabla nueva contiene datos personales; no hay nada que añadir al registro de datos personales.
