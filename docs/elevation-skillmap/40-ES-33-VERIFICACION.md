# ES-33 · Verificación del backend preparatorio

28-oct-2026 · [Dev-Codex]. Base main `6dc61e9`; rama ES-33-experimento-plan. Plan aprobado 10260, respuesta registrada 10261. Sin UI ni proveedor LLM. **ES-33 integrada sigue pendiente** de contratos reales ES-14/32 y revisión humana; no se acredita el piloto con fixtures.

| Verificación local | Resultado real |
| --- | --- |
| Backend npm test, Node 24.14.0 | exit 0, 266/266 |
| Backend suite Node 22 (versión CI) | exit 0, 266/266 |
| Nuevas unitarias | 18, incluidas arriba; dos mutaciones detectadas |
| npm run test:career-plan:local | exit 0, 30/30: 18 grupos ES-33 + 10 ES-23 + 2 pruebas contenedoras; PostgreSQL 17 temporal + HTTP/JWT/ORM/cifrado/derechos reales |
| Frontend lint | exit 0, 0 errores/0 advertencias, sin cambios frontend |
| Frontend npm test | exit 0, 22/22 |
| Frontend tsc -b / build | exit 0 |
| Frontend instalación/audit | exit 0; 0 vulnerabilidades |
| Backend audit --omit=dev --audit-level=high | exit 0; seis moderadas conocidas, cero altas/críticas; dependencias intactas |
| Sintaxis nuevos módulos/migración/arnés y git diff --check | exit 0 |

Build conserva JS 522,56 kB (gzip 133,49) y CSS 30,93 kB; aviso >500 kB documentado sin silenciarlo. No se ejecutó comparación visual porque no hay cambio de pantalla/layout/texto visible. CI conserva la configuración de lint de main; el exit 0 local es una comprobación explícita y no se infiere del continue-on-error existente.

## Reproducción

Desde backend:

```text
npm ci --ignore-scripts
npm rebuild embedded-postgres
npm test
npm run test:career-plan:local
```

El script inicia su propia base PostgreSQL en loopback con directorio temporal bajo node_modules y credenciales aleatorias en memoria. No carga .env ni DATABASE_URL. Cada integración ES-23/ES-33 crea y elimina una base aleatoria propia, nunca una base proporcionada por el usuario. Cleanup valida la ruta absoluta; detiene servidor/PG y elimina solo ese temporal. Fallos conservan exit 1 tras la limpieza.

CI utiliza el servicio PostgreSQL 17 local del runner:

```text
ES33_TEST_DATABASE_URL=<PostgreSQL desechable en loopback> npm run test:career-plan:pg
```

No ejecutar estos comandos apuntando a producción. No se probaron migraciones, restauraciones o entregas en staging/producción.

## Qué es real y qué está simulado

- **Reales:** Express/HTTP, JWT/revocación/rol actual, Sequelize, PostgreSQL, migración/índices/FK, cifrado GCM, evidencia profesional, consentimiento/withConsent/ConsentEvent, exportación/descarga y procesador de borrado/replay existentes.
- **Fixtures explícitos:** dos funciones del puerto careerPlanContracts: ruta/elección ES-32 y disponibilidad/zona ES-14. Su propiedad/base cambiante se simula según contrato; esto **no prueba** su integración o autorización real. Restituir los puertos originales en la prueba hace fallar propuestas con 503 y conserva la historia propia marcada needs_review.
- Datos, referencias y muestras exclusivamente sintéticos. No hay modelo LLM real ni simulado: no se llama a Claude, proveedores, webs, email o notificaciones externas.
- Un tramo del arnés adelanta dueAt en su fila sintética para verificar vencimiento sin esperar días; otra prueba altera Date.now solo al firmar un token para comprobar expiración. No se presenta como prueba de reloj/scheduler real.
- La suite general conserva los mocks históricos de sus pruebas; 266 no significa 266 pruebas PostgreSQL.

## Cobertura de integración

- Migración aplicada dos veces antes de cargar/sincronizar nuevos modelos; once índices únicos y FK compuestas verificadas con inserción ajena rechazada por PostgreSQL. Usuarios previos preservados.
- Propuesta sin persistencia, texto ES/EN, token propio exacto/vigente; manipulación, token vencido y cambio de contexto entre propuesta/confirmación no persisten datos. requestId exacto recupera resultado; cuerpo distinto da 409.
- A/B: lectura/escritura de experimento, historial de solicitudes, propuesta/versión de plan y cancelación de recordatorio con ID ajeno →404. Campos UserId/query ajena rechazados. Admin/therapist/board/superadmin →403; sin sesión 403; token revocado y cuenta con borrado pendiente 401. Rol actual en DB prevalece sobre el anterior del JWT.
- Tres versiones concurrentes con el mismo requestId dejan una nueva y dos recuperaciones; cambio con base antigua 409. Entrega con evidencia inexistente no se guarda; reflexión conserva observación/interpretación y ayuda self_report; ninguna escribe SkillAssessment.
- Solicitud humana pending_authorization/shared:false, actor falsificado rechazado, retirada sin permiso nuevo e historial propio; no hay revisión profesional simulada como real.
- Decisión razonada y plan propuesto separado de aceptado; aceptación explícita, fechas y evidencia declarada. Completado sin texto o con dependencia pendiente rechazado; nueva versión conserva historial y desactiva recordatorios de la anterior. Disponibilidad combinada entre planes y aceptación concurrente se comprueban con DB/locks reales.
- Recordatorio sin aceptación/notifications no se activa; zona distinta/ID ajeno se rechazan. GET vencido no consume; acuse explícito idempotente marca delivered una vez. Revocar y reotorgar no resucita, historial/cancelación no exigen renovar consentimiento.
- Trigger PostgreSQL ralentiza inserción mientras otra conexión revoca notifications: se observa la espera real por bloqueo del consentimiento hasta el commit de la escritura. Tras revocar, ningún recordatorio se entrega.
- Cambios de disponibilidad/ruta y retirada de evidencia cambian base, se explica needs_review y el guardado nuevo con base antigua falla. Rebase explícito vuelve a ready sin convertir entregas antiguas en resultados actuales; el historial permanece. La ruta/disponibilidad son fixtures, la retirada de evidencia es real.
- Exportación real descifrada de cinco modelos con todo su historial propio, sin huellas/requestIds/tokens técnicos; descarga ajena 404. Trigger falla al borrar el contenedor después de hijos: rollback conserva los cinco; reintento y replay los purgan y dejan B intacto.
- Regresión real ES-23: consentimiento, exportación/descarga/eliminación concurrentes, rollback/reintento y replay. Solo se registra la extensión declarativa aprobada; no se reescribe el procesador.

Primera integración: 25 pass/2 fail por contar con LIKE 'career_%' también tres índices de CareerContext del producto existente. Se corrigió el filtro del arnés a las cinco tablas nuevas, no la DB para acomodar una cifra. Corridas posteriores verdes. Las pruebas de índices/FK, límites/costos y DST son controles mecánicos, no validez de una rúbrica profesional.

## Límites

Sin integración real de ES-14/ES-32, revisión humana autorizada, dominio curado, fuentes/vacantes reales o seis participantes; sin archivos/parser, emails/push/scheduler, UI ES-34, consola ES-35, aceptación de piloto o producción. No se promete snapshot global entre helpers separados. La migración aún requiere validación/aplicación por infraestructura. El PR preparatorio queda para revisión de Mauricio/QA; no se fusiona ni se cierran hilos.
