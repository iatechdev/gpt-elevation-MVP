# ES-14 — Contexto de la persona

Base: main `1dc0630`. Diseño y plan aprobados por Alejo en la sesión de desarrollo,
referencia Jira ES-14, comentario 10160. La confirmación de ParticipantContext como
fuente única de idioma y zona horaria quedó registrada en el comentario 10165.

## Interfaz aprobada

`/app/onboarding` reemplaza el onboarding heredado de seis pasos. El dashboard
añade «Mi contexto / My context» para editar el mismo recurso. El login consulta
el contexto confirmado en servidor y deja de usar `onboardingCompleted` heredado
para decidir si esta entrada está completa. Las rutas de otros roles se conservan.

Las puertas «Mi espacio», «Mi siguiente paso» y «Quiero avanzar pronto» son
navegación local. La última significa dar un siguiente paso profesional. No se
guardan en el DTO ni se envían al motor profesional o a analítica. No hay una
pregunta de intimidad ni una clasificación emocional persistida.

Se puede guardar un borrador con todos los campos por confirmar. Para continuar
se confirma idioma y se elige una puerta local. La puerta personal va al dashboard
solo después del guardado durable. Las otras muestran confirmación y «Seguir
editando»; no inventan una ruta profesional ni fuerzan el chat.

Los cambios no guardados viven en memoria. Cambio de idioma de presentación no
traduce valores escritos ni confirma preferencias. El botón de zona sugerida
requiere una acción explícita. Fallos GET no habilitan un formulario vacío;
fallos PUT y conflictos conservan el borrador, sin mostrarlo como persistido.
El conflicto exige recarga explícita, con aviso si se perdería un borrador.

«Volver», Atrás/Adelante dentro de BrowserRouter y salida de documento protegen
los cambios. La guardia local se registra antes del listener de BrowserRouter
para poder conservar la pantalla montada al cancelar. No modifica navegación de
otras pantallas. El aviso de cerrar/recargar usa el texto nativo del navegador.

Tokens internos: fondo #F9F9F7, tarjeta blanca, tinta #1C1917, borde #D6D2C4,
acción #4A6741, texto secundario #57534E, error #B91C1C. Tipografías existentes
Inter y Playfair Display. daisyUI con prefijo elv-, variables locales sin tema
global. Ancho máximo 640 px; acciones apiladas bajo 640 px, controles de 44 px,
foco visible, salto al contenido y movimiento reducido. Los textos ES/EN están
en `frontend/src/context/contextCopy.ts` e integrados en el catálogo existente.

## API y validación

`GET /api/user/context` y `PUT /api/user/context` requieren `verificarToken`
(incluye sesiones revocadas) y una cuenta actual activa de rol participante.
La identidad y los roles no se aceptan desde el cuerpo, query ni URL.

PUT:

```json
{
  "schemaVersion": 1,
  "expectedVersion": 0,
  "action": "save_draft",
  "context": {
    "preferredLanguage": null,
    "residenceCountry": null,
    "targetMarket": null,
    "timeZone": null,
    "profession": null,
    "interests": null,
    "availabilityMinutesPerWeek": null,
    "careerGoal": null,
    "careerConstraints": null
  }
}
```

Todos los campos deben estar presentes; `null` significa por confirmar. `action`
es `save_draft` o `continue`. No se admiten claves adicionales. Idioma es es/en;
residencia y mercado son países independientes, ISO alpha-2; zona horaria es un
identificador reconocido por Intl/IANA o UTC; profesión hasta 120 caracteres;
intereses, objetivo y restricciones profesionales hasta 500 cada uno;
disponibilidad entero de 0 a 10080 minutos por semana. Cero no significa desconocido.
Objetivo y restricciones son opcionales conforme a la propuesta aprobada.

El listado compartido usa los códigos alpha-2 de [UN M49](https://unstats.un.org/unsd/methodology/m49/overview/),
completado con TW verificado en el [registro de códigos ISO de RIPE](https://www.ripe.net/community/internet-governance/internet-technical-community/the-rir-system/list-of-country-codes-and-rirs/),
consultados el 27-oct-2026. Nombres de presentación ES/EN mediante Intl.DisplayNames;
no se infiere residencia del navegador. La lista no contiene datos de personas.

Respuesta: schemaVersion, version, context, savedAt y completedAt. Sin registro,
version=0/context=null. savedAt y completedAt vienen del servidor; guardar un
borrador no confirma la entrada. Borrar idioma anula la confirmación anterior.
Un error no devuelve el contenido recibido. Cache-Control: no-store.

Errores: 400 contrato inválido; 401 sesión inválida/revocada; 403 sin sesión,
cuenta inactiva, no participante o rol cambiado; 404 ruta con ID; 409 conflicto
de versión; 503 persistencia/cifrado no disponible. Un parser JSON inválido o
excesivo en este recurso devuelve error genérico 400/413 sin registrar el cuerpo.

## Persistencia y migración

Tabla ParticipantContexts: id INTEGER; UserId INTEGER único/FK a Users con
ON DELETE CASCADE; version INTEGER; content TEXT cifrado AES-GCM mediante el
helper `encriptarV2`; completedAt nullable; createdAt y updatedAt. No se copia
motivación ni la bandera heredada. Idioma y zona horaria tienen aquí su única
fuente canónica. No se modifica el modelo de identidad ni sus serializadores.

GET y PUT abren transacción y bloquean la fila del usuario actual antes de leer
el contexto. Así se serializan también dos primeras altas. PUT comprueba la
versión esperada y solo responde éxito después de commit. Una respuesta perdida
se recupera por GET; reintentar contra una versión antigua devuelve 409.
Las ediciones registran DerivedInvalidation con sourceType=participant_context,
sourceId=id, reason=edited, UserId del dueño, sin contenido.

Migración aditiva `backend/migrations/20261028020000-participant-context.cjs`:
`up(queryInterface, Sequelize.DataTypes, transactionOpcional)`. Precondición:
esquema base Users existente. La aplica el runner revisado de infraestructura
una vez; no es un comando automático de despliegue y no se ejecutó en producción.
No cambia sync/alter. La reversión de aplicación conserva la tabla; no hay down
destructivo. Las pruebas comprueban DDL transaccional y rollback sin borrar Users.
El arranque existente conserva sequelize.sync() para crear tablas faltantes:
al registrar este modelo también puede crear su tabla. Infraestructura debe
aplicar y verificar la migración en staging antes del despliegue de este PR;
no se cambió la política de arranque ni se comprobó contra producción.

## Seguridad y privacidad — contrato de integración pendiente

Todas las consultas filtran por el ID del JWT y comprueban cuenta activa/rol
actual en servidor. No hay API administrativa/facilitador ni exportación nueva.
No se llama a Claude ni a proveedores con este contexto. No hay borradores de
contexto en localStorage, logs, fixtures personales ni documentación de casos reales.

**ES-23 ya está en main y ParticipantContext está registrado en su núcleo** (`CORE` de `utils/personalData.js`; pruebas: unitaria y Postgres real de ES-23, ambas con A/B y `--replay`). No se duplica ese núcleo en este ticket. Contrato registrado:

- Propietario: ParticipantContext.UserId; colección personal participantContext.
- Campos: id, version, content, completedAt, createdAt, updatedAt. Descifrar content
  con desencriptar y presentar el DTO validado, sin UserId ni información de terceros.
- Purga: vaciar/borrar el contenido propio en la misma transacción del procesador
  de borrado; no basta desactivar User. FK CASCADE cubre eliminación física, no
  sustituye un proceso de borrado lógico ni verificación de copias/proveedores.
- Invalidar exportaciones tras ediciones de participant_context, preservando el
  bloqueo del usuario y la comprobación de versión del núcleo. Probar dos personas,
  descarga antigua, borrado y replay de restauración con el nuevo modelo.

Este pendiente debe bloquear merge/activación con datos del piloto hasta revisión
de Mauricio. No se declara ES-14 integrada por terminar pruebas contra dobles.

## Verificación reproducible

- backend: `npm ci`, `npm test` (HTTP/JWT/montajes reales; ORM/cifrado mock).
- backend: `npm run test:context:postgres` (Postgres 17 desechable, migración,
  Sequelize, JWT, cifrado y HTTP reales; sin proveedor ni .env).
- CI: `node --test test/integration/es-14-postgres.cjs`, solo con
  ES14_TEST_DATABASE_URL apuntando explícitamente a Postgres loopback desechable;
  crea y borra únicamente su propia base aleatoria.
- frontend: `npm run lint`, `npm test`, `npx tsc -b`, `npm run build`, `npm audit`.
- Navegador: arrancar preview local, instalar Playwright en el entorno de QA o
  indicar PLAYWRIGHT_MODULE, y ejecutar `node scripts/es14-browser.cjs` con
  ES14_PREVIEW_URL (por defecto http://127.0.0.1:4214). HTTP sintético, React real.
  ES14_SCREENSHOT_DIR opcional, fuera del repo; no versionar capturas de personas.

Los seis casos de las pruebas son **totalmente sintéticos**, cinco ES y uno EN,
con oficios no digitales y campos por confirmar. No describen a las seis personas
del piloto. Su caracterización y la curación del catálogo con datos autorizados,
la revisión integrada ES-23, el despliegue y la aceptación humana siguen sin verificar.

### Resultado local del 27-oct-2026

Node 24.14.0 en Windows; CI usa Node 22 y PostgreSQL 17. No se probaron proveedores.

| Comando / prueba | Salida real | Límite |
| --- | --- | --- |
| frontend npm run lint | exit 0, sin errores ni advertencias | No se relajaron reglas |
| frontend npm test | tests 18, pass 18, fail 0 | Incluye contrastes AA medidos |
| frontend npx tsc -b | exit 0 | Tipos de la aplicación |
| frontend npm run build | exit 0, 74 módulos | Aviso de chunk >500 kB: 526,42 kB; no se silencia |
| frontend npm audit | found 0 vulnerabilities, exit 0 | Registro npm consultado |
| backend npm test | tests 168, pass 168, fail 0 | Express/JWT reales; persistencia/cifrado mock |
| backend npm run test:context:postgres | tests 9, pass 9, fail 0 | PostgreSQL 17, ORM, migración, HTTP, JWT y cifrado reales; datos sintéticos |
| scripts/es14-browser.cjs | Browser checks: 12 passed, 0 console exceptions | Chromium aislado, HTTP mock; móvil 320, tablet 768, escritorio 1440, zoom 200%, teclado, movimiento reducido |
| backend npm audit | 6 moderate severity vulnerabilities, exit 1 | uuid y dependientes; sin cambios en dependencias |
| backend npm audit --omit=dev --audit-level=high | 6 moderate severity vulnerabilities, exit 0 | Umbral existente de CI, ninguna alta/crítica reportada |
| git diff --check | exit 0 | Sin espacios inválidos |

Contrastes: tinta/fondo 16,59:1; secundario/blanco 7,63:1; error/fondo 6,14:1;
blanco/acción 6,35:1. Las capturas locales solo contienen datos sintéticos.
La primera prueba detectó y permitió corregir el parser JSON y la pérdida del
borrador al cancelar Atrás. Las ejecuciones finales citadas son posteriores a sus correcciones.

## Deuda técnica aceptada

QA-14-02 (peso del CSS de los formularios, +80 % según QA) se acepta como deuda técnica y no se corrige en ES-14. Registro, alternativa medida y criterios para retomarla: `docs/hu-tecnicas/DT-007-css-formularios-es14.md`.


> **ES-122.** La pantalla pide y muestra la disponibilidad en **horas por semana** (0 a 168, admite decimales); el campo guardado sigue siendo `availabilityMinutesPerWeek` en **minutos enteros** (0 a 10 080). La conversión es solo de presentación; el plan de carrera sigue consumiendo minutos.
