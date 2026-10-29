# ES-113 — Preparación tras aprobar el diseño

[Dev-Codex]

29-oct-2026. Rama ES-113-diario-papel, base origin/main d5eb00f9d0a035c6c98506038490f32087d4acc6. Aprobación explícita de Alejo en Jira 10512 sobre diseño/plan 10511; incluye aceptar guardado manual sin recuperación de texto no guardado tras cierre. No se ha desplegado nada.

## Estado de la entrega

Completada la preparación independiente: diseño aprobado documentado y prueba de regresión del contrato del diario con PostgreSQL real. **La implementación visual y la historia integrada siguen pendientes**, porque aplicar los tokens del plan requiere ES-37 integrado en main. PR 84 seguía abierto/sin merge en la comprobación. No se han añadido estilos paralelos o rutas/frontend alternativos. No se abre un PR de entrega parcial ni se marca QA completado.

Los adjuntos de Jira permiten revisar el diseño sin código del producto: HTML autocontenido 10009, escritorio 10010, móvil 10011 y plan inicial 10012. Esta rama conserva la aprobación y resultados; los adjuntos siguen siendo la referencia visual aprobada.

## Pruebas reales ejecutadas

Windows, Node v24.14.0. Instalación backend con npm ci --ignore-scripts: exit 0, 292 paquetes, seis avisos de vulnerabilidad moderada. No se ejecuta audit fix ni se cambian dependencias. Ese resultado no se presenta como auditoría verde.

| Ejecución | Resultado |
| --- | --- |
| backend: node --check test/integration/es-113-diary-postgres.cjs | Exit 0 |
| backend: node --test test/integration/es-113-diary-postgres.cjs | Exit 0; 7 tests (padre y 6 subcasos), 7 pasan, 0 fallan/omitidos; 41100.8396 ms |
| backend: node --test test/es-20-diary.test.cjs | Exit 0; 7 pasan, 0 fallan/omitidos; 4181.4019 ms; persistencia/proveedores con dobles |
| raíz: node --test frontend/test/es15.test.mjs | Exit 0; 5 pasan, 0 fallan/omitidos; 729.1804 ms; contrato cliente/i18n, sin navegador |
| git diff --check | Exit 0 |

La salida ES-20 incluye «base caída» en los casos de fallo inyectado de edición/borrado; la suite termina correctamente. Sus mensajes de sincronización no acreditan DB real. La suite ES-113 sí usa PostgreSQL real.

### Qué verifica la nueva suite PostgreSQL

- Crea su propio PostgreSQL en loopback, puerto aleatorio y directorio aleatorio ES-113 dentro de backend/.pgdata ignorado. Cierra HTTP, pool y PostgreSQL; al finalizar no quedan subdirectorios del caso en .pgdata. No carga .env ni usa DATABASE_URL o servidores existentes.
- Router Express de diario, verificarToken, emisión/revocación JWT, modelos Sequelize y AES-GCM reales. Solo se inyecta la conexión al PostgreSQL desechable. No hay dobles de persistencia ni criptografía en esta suite; no se cargan proveedores externos.
- Crear/leer Unicode ES/EN vuelve al texto esperado y la columna contiene ciphertext v2; no devuelve UserId en el DTO.
- B, admin, superadmin, therapist y board reciben 404 uniforme al leer/editar/borrar un ID de A; listas ajenas vacías y sin cambios al dueño. Sin sesión 403, token inválido 401.
- Un UserId inyectado no cambia al dueño; fechas inexistentes, vacío y más de 10 000 caracteres no escriben; IDs inválidos no revelan registros.
- Edición/borrado reales registran invalidaciones sin contenido, vacían el texto al borrar y retiran la entrada de lecturas/listas. La entrada de B sobrevive.
- Límite solicitado 999 devuelve como máximo 100 entradas del dueño; nunca incluye borradas o ajenas.
- Revocar JWT en el helper existente produce 401; la otra sesión sigue funcionando.

El ensamblado de prueba monta el router y middleware reales del diario, no todo server.js ni una plataforma desplegada. No acredita login, el worker, el puente profesional, proveedores o borrados de respaldos. No es una migración: sync crea las tablas del entorno de prueba nuevo.

## Seguridad y privacidad

No endpoints/modelos/migraciones nuevos. Todo acceso probado toma identidad del JWT verificado y exige propietario en servidor mediante consultas existentes por UserId + id + deletedAt. Los textos/actores de prueba son sintéticos, con correos example.invalid; no hay datos del piloto. Claves aleatorias solo en memoria para la ejecución, sin imprimir ni guardar. El núcleo de Mauricio no se modifica.

El diseño mantiene texto sin guardar solo en memoria y no añade localStorage/sessionStorage/IndexedDB. Esto todavía debe comprobarse de nuevo en el navegador al implementar la UI. No se presenta como garantía contra cierre forzado ni como control atómico de edición concurrente.

## Pendiente

1. Integrar ES-37 por el flujo QA/Mauricio, actualizar esta rama desde main y revisar si ES-38 modificó componentes compartidos.
2. Implementar layout/estados/textos aprobados del diario, conservar CRUD y guards, puente deshabilitado mientras ES-111 no exista.
3. Pruebas frontend completas, lint/tipos/build/audit y regresiones backend después de cambiar la UI; comparar capturas ES/EN, 320/375/768/1440, teclado/foco, zoom y reduced-motion con la maqueta aprobada.
4. Verificar red interrumpida, respuesta perdida, cambio de sesión, salida con borrador, conflictos y eliminación en navegador usando datos sintéticos. Sin repetir automáticamente escrituras inciertas.
5. Abrir el único PR de ES-113 contra main con resultados reales y límites. QA revisa y Mauricio fusiona; Dev no publica ni fusiona.
