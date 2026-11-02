# ES-73 · Entrega y verificación

[Dev-Codex] · 28-oct-2026.

## Alcance y decisiones

Base inicial: main 13a0f9f75e08f6d5cc8b5291d7f0637d34cd953f. Diseño S12: ES-60/10279 y ES-73/10285. Ampliación de registro/ingreso y plan técnico: ES-73/10404. Aprobación posterior del usuario: visibilidad y administración, registrada en ES-73/10406.

Landing S12 y /pricing visibles por defecto, sin bandera. Nombres, precios, moneda, periodicidad, orden y destacado vienen de GET /api/plans, nunca de importes inventados en frontend. Gratis requiere cero real, incluidos DECIMAL de PostgreSQL. El subtítulo gratuito solo aparece si existe un plan activo de precio cero. Los periodos soportados son month/year; valores comerciales ambiguos producen error de datos y no se reinterpretan.

Los textos landing.pricing.* son ES/EN, editables por el catálogo existente y tienen fallback. El gestor de planes existente conserva campos y permisos; no se cambia su interfaz. No hay modelos, dependencias ni migraciones nuevas. Las zonas privadas no cambian.

Seleccionar conserva únicamente el ID público de plan durante registro e ingreso. La sesión se verifica con el lector de Mauricio; localStorage no decide identidad ni destino. Después de ingresar se revisa el catálogo fresco y se requiere un clic explícito para solicitar. Registro e ingreso no envían solicitudes. Una respuesta 201 válida confirma solicitud en revisión, nunca activación ni cobro. Respuesta perdida: consultar estado propio, sin repetir POST automáticamente. No se acepta returnTo arbitrario.

## Contenido administrable

La compatibilidad de lectura sustituye exclusivamente campos que coinciden exactamente con los antiguos textos de seed por el texto conservador aprobado. No modifica la base, precios, nombres, límites, slugs ni destacados. Las ediciones diferentes del administrador tienen prioridad. Las semillas nuevas reciben las mismas descripciones y funciones no clínicas.

Para persistir el texto aprobado en las cuatro familias conocidas, el operador puede ejecutar desde backend, con conexión ya configurada por su entorno:

```powershell
node scripts/reviewedPricingCopy.cjs
# Revisar primero el dry-run. Aplicar solo sobre el entorno autorizado:
$env:PRICING_COPY_APPROVED = 'ES-73-D01-10406'
node scripts/reviewedPricingCopy.cjs --apply
```

Dry-run por defecto; no carga archivos .env ni siembra filas. Apply reemplaza los cuatro campos description_es/en y features_es/en de slugs conocidos, incluso si se habían personalizado: revisar antes de ejecutar. Es una operación manual de carga inicial, no de arranque ni periódica; no repetir sobre ediciones posteriores. El resultado imprime slugs y campos, sin datos personales. La aplicación se probó solo en bases desechables. El operador también puede cargar y mantener los textos desde el gestor existente.

No se anuncian sesiones profesionales incluidas, cuotas por plan ni uso ilimitado, porque no se verificó su aplicación integral. No se cambia planLimits, proveedor IA, cuotas, infraestructura ni producción.

## Seguridad y privacidad

GET /api/plans es público, lista solo planes activos y atributos permitidos, sin datos de personas y con no-store. Ambos alias /api/plans/me y /api/user/plan/me requieren verificarToken. GET /api/plan-requests/me usa exclusivamente req.user.id. POST acepta solo planId; query o claves extra se rechazan. Identidad, rol y revocación reutilizan helpers existentes.

POST comprueba propietario activo y plan activo; bloquea la fila del propietario en transacción para serializar envíos simultáneos. Pendiente y creación ocurren dentro de la transacción; commit antes del 201. No acepta propietario desde cliente. Admin conserva autorización existente. No se transfieren diario, conversación, ánimo ni competencias a solicitudes. No hay claves, tokens ni información de personas reales en fixtures; proveedores externos rechazados en el arnés.

## Pruebas ejecutadas antes de integrar main

| Comando / capa | Resultado real |
| --- | --- |
| frontend npm test, Node 24 | 101/101, exit 0 |
| frontend node --test test/*.test.mjs, Node 22 | 101/101, exit 0 |
| frontend npm run lint | exit 0, sin errores ni advertencias |
| frontend npx tsc -b | exit 0 |
| frontend npm run build | exit 0; 135 módulos; JS 695.03 kB, gzip 184.61; CSS 94.64 kB, gzip 14.78 |
| frontend npm audit --json | exit 0, 0 vulnerabilidades |
| backend npm test | 340/340, exit 0 |
| backend npm audit --json | exit 1, 6 moderadas, 0 altas/críticas |
| PostgreSQL real: node --test test/integration/es-73-postgres.cjs | 1/1, exit 0 |

Build avisa del chunk superior a 500 kB; no se silenció ni se relajaron reglas. Auditoría backend: cadena existente de storage/retry-request/teeny-request/gaxios/uuid/Sequelize, sin cambios de lockfile en ES-73. No se aplicó audit fix que alterase dependencias fuera del alcance.

La suite unitaria HTTP usa mocks de modelos; los tests puros de frontend usan fetch simulado y SSR real de componentes. La integración PostgreSQL usa modelos, rutas, JWT y revocación reales en una base aleatoria loopback, creada y eliminada por la prueba: edición admin reflejada en GET, DECIMAL, planes inactivos, autorización A/B, IDs ajenos, roles, 12 envíos concurrentes (1×201 + 11×409 y una fila pendiente), aprobación legítima y rollback ante fallo SQL inducido. No se añadieron migraciones; sync se ejecuta exclusivamente en la base vacía de pruebas.

El primer intento de repetir PostgreSQL dentro del sandbox falló EACCES antes de conectar; la ejecución con permiso local completó 1/1. No se ocultó el fallo.

## Navegador local

Arnés es73-preview.cjs: aplicación, registro, ingreso, sesión, contexto, rutas y PostgreSQL reales; datos de planes y cuentas sintéticos, proveedores IA/storage rechazados. Escenarios de red/catálogo son fallos inyectados, no servicios de producción. El arnés permite servir dist desde la carpeta oculta del worktree: el primer reload directo a /pricing falló 404 por esa restricción local; se corrigió solo en el arnés y se repitió el flujo.

- ES y EN: selección → registro → ingreso → /pricing?plan=8. Cero solicitudes tras registro/ingreso; una tras clic explícito. Confirmación y pendiente tras recarga, sin activación.
- Cuenta distinta no muestra la pendiente de la primera. Usuario nuevo conserva destino onboarding y contexto completo usa dashboard.
- Respuesta 201 real perdida y sustituida por 503: recupera pendiente vía GET, sin repetir POST.
- POST rechazado antes de escribir: resultado incierto y botones bloqueados; Comprobar estado recupera lectura y habilita. Lectura privada fallida muestra error y bloquea envío.
- Catálogo offline y vacío tienen estados diferentes; contenido largo conserva cuatro tarjetas y se escapa como texto.
- Anchos 320/375/390: una columna; 768/1024: dos; 1440: cuatro. Sin desbordamiento horizontal en los seis anchos con texto largo; CTA 48.39 px de alto.
- Contraste claro/oscuro verificado por prueba existente: ocre de texto 5.54:1; decorativo no se usa para texto. Sin animación nueva; foco y enlace saltar al contenido reutilizados.

## Integración final con main

Se integró origin/main 2f237a4 en 61b94c5, conservando S11 de ES-72 antes de S12 y todos los textos de ambas ramas. Repetición completa: frontend 114/114 y backend 348/348, ambos exit 0. Lint exit 0 sin advertencias. Build (incluye tsc -b) exit 0: 143 módulos, JS 717.54 kB (gzip 190.22), CSS 99.81 kB (gzip 15.17); persiste el aviso del chunk >500 kB. El crecimiento incluye las HU recién integradas. No se relajó ninguna configuración.

En navegador se verificó además el reintento tras fallo temporal del lector de sesión, foco por teclado de 3 px y S12 en tema oscuro con cuatro planes, sin desbordamiento.

PostgreSQL repetido tras integrar main: 1/1, exit 0, misma comprobación de concurrencia, propiedad y rollback.

Suite frontend repetida con Node 22 tras integrar main: 114/114, exit 0.

## Pendientes externos

No se ejecutó staging, despliegue, cobro, activación comercial, proveedores externos ni carga de catálogo de producción. No se certifican las prestaciones reales de cada nivel. No se probó manualmente cada combinación de navegador, lector de pantalla o cambio concurrente de cuenta. Las capturas locales usan importes sintéticos, no tarifas de clientes. QA y Mauricio deben revisar el PR; el autor no fusiona ni cierra hilos.
