# ES-32 · Verificación reproducible

28-oct-2026 · [Dev-Codex]. Base main `6dc61e9`, rama `ES-32-rutas`. Backend exclusivamente; sin cambios frontend ni del proveedor LLM. Contrato y aprobación: documento 36, Jira 10178/10250/10257.

## Resultados locales

| Comando / comprobación | Resultado real |
| --- | --- |
| Backend `npm test`, Node 24.14.0, corrida final | 274 pass, 0 fail, exit 0 |
| Backend `node --test test/*.test.cjs`, Node 22 (versión de CI) | 274 pass, 0 fail, exit 0 |
| Nuevas unitarias ES-32 | 26/26 incluidas en los totales anteriores |
| Mutaciones del cálculo | 6/6 controles eliminados deliberadamente fueron detectados; originales pasan |
| `npm run test:routes:local` | exit 0, 25 pass, 0 fail: 13 grupos ES-32 + 10 ES-23 + 2 pruebas contenedoras; PostgreSQL 17 temporal, HTTP/JWT/Sequelize/cifrado/derechos reales |
| Frontend `npm run lint` | exit 0, 0 errores/0 advertencias |
| Frontend `npm test` | 22 pass, 0 fail, exit 0 |
| Frontend `npx tsc -b` | exit 0 |
| Frontend `npm run build` | exit 0; JS 522,56 kB gzip 133,49; CSS 30,93 kB, sin cambios de frontend |
| Instalación frontend `npm ci --ignore-scripts` | exit 0, audit: 0 vulnerabilidades |
| Backend `npm audit --omit=dev --audit-level=high` | exit 0; seis moderadas, ninguna alta/crítica; dependencias sin cambios |
| `node --check` nuevos módulos, migración y arnés | exit 0 |
| `git diff --check` | exit 0 |

La advertencia de bundle >500 kB permanece y no se silencia. No hay comparación visual ni pruebas de interfaz nueva porque ES-32 no cambia pantallas; ES-34 necesita su diseño aprobado y pruebas de navegador propias.

**Incidencias durante la verificación:** una primera suite en Node 24 terminó con `Unable to deserialize cloned data due to invalid or unsupported version` del runner en ES-79 (264 pass, 1 fail), no se contó como verde. La corrida de Node 22 pasó; una posterior corrida completa de Node 24 también pasó con 274/274 tras incorporar las últimas unitarias. En la primera integración dos subpruebas fallaron por esperar `no-store` también en errores previos de `verificarToken`. Se corrigió únicamente la expectativa del arnés: el router garantiza esa cabecera en sus respuestas; no se cambió el middleware compartido para satisfacer la prueba.

## PostgreSQL y HTTP reales

Ejecutar desde backend:

```text
npm ci --ignore-scripts
npm rebuild embedded-postgres
npm run test:routes:local
```

El script crea un directorio temporal propio bajo node_modules, credenciales aleatorias en memoria y servidor de loopback; no carga .env ni DATABASE_URL. Ejecuta las integraciones ES-32 y ES-23 y luego detiene PostgreSQL y retira únicamente su directorio verificado. Un fallo de pruebas mantiene exit 1 incluso después del cleanup de embedded-postgres.

En CI se usa el servicio Postgres 17 del job de derechos, sin embedded-postgres:

```text
ES32_TEST_DATABASE_URL=<servidor PostgreSQL de loopback desechable> npm run test:routes:pg
```

Cada prueba crea y elimina su **propia base aleatoria**, nunca borra una base recibida del entorno. La validación exige loopback. La integración ES-23 carga también los nuevos modelos antes de sync para verificar su incorporación al registro; su procesador y las reglas de retención permanecen intactos.

Cobertura ES-32:

- Migración aplicada dos veces antes de cargar/sincronizar los modelos nuevos; siete índices únicos reales y usuarios previos preservados.
- Catálogo ausente 503; ausencia de mercado `needs_constraints`, sin inferirlo; catálogo ES-31 publicado mediante sus validadores con fixtures marcados sintéticos y permiso de prueba explícito.
- Cifrado v2 y lectura propia de restricciones; repetición exacta 200, cuerpo distinto con mismo requestId 409, base obsoleta 409, campos adicionales/IDs de propietario/contexto inexistente 400.
- Tres escrituras simultáneas sobre la misma base: una 201 y dos 409; una sola versión current, sin hueco ni sobrescritura silenciosa.
- Evidencia confirmada real + autoevaluación real del mapa → rutas; sin programación por defecto, nombres de revisores ni canarios privados en el DTO. Núcleo puro probado también con docente y contadora sintéticas y un rol de programación adicional.
- Aceptar/rechazar/reemplazar una elección; cuatro repeticiones concurrentes devuelven la misma; rol inventado 422 y huella de otro dueño 409.
- B leyendo el ID de elección de A → 404; historial de B vacío. Admin/therapist/board/superadmin → 403 en lecturas y escrituras; sin sesión 403; token revocado 401; cambiar el rol actual en DB impide usar el rol antiguo del token.
- Cambiar restricciones o catálogo cambia la base; elección histórica se conserva con `basisChanged`; intento con huella anterior 409. Catálogo retirado: GET rutas 503, elecciones históricas todavía propias, marcadas para revisión.
- Revocar professional_bridge quita la evidencia de origen chat del mapa y elimina su adyacencia; cambia la huella. Los fixtures de esa evidencia son una versión profesional sintética preparada en DB; no se afirma haber probado un parser de chat ni Claude.
- Helper de ES-33: acepta solo elección propia accepted/current/vigente; ID ajeno 404, rechazada/reemplazada 409.
- Solicitud humana con nota cifrada, lectura propia, repetición exacta 200, cambio del mismo intento 409 y segunda abierta 409; B no obtiene la nota.
- Exportación personal real descifrada de las tres tablas con todo el historial; sin huellas/requestIds; descarga de B del comprobante de A → 404.
- Eliminación pendiente bloquea HTTP. Fallo SQL inyectado mediante trigger al purgar elecciones revierte también la purga previa de restricciones; los tres almacenes conservan sus filas. Tras quitar el trigger, reintento purga los tres y conserva B. Restauración sintética + replay vuelve a purgar.
- Regresión PostgreSQL ES-23: exportación exacta, descarga/eliminación concurrentes, consentimiento, rollback/reintento y replay del núcleo existente.

**Mocks:** no se simulan ORM, JWT, cifrado, catálogo, Skill Map, consentimiento, exportación o borrado en esta integración. Los datos son sintéticos. No hay proveedor LLM real ni simulado: el motor no llama a IA. Las unitarias puras usan DTOs sintéticos y las otras pruebas históricas de `npm test` conservan sus dobles de persistencia/proveedor documentados; el total 274 no se presenta como 274 pruebas de PostgreSQL.

## Límites y aceptación

- Sin catálogo real curado y revisado del cliente: no se verificó pertinencia con las seis personas, vacantes reales, salarios reales ni elegibilidad profesional.
- Sin UI ES-34, experimentos ES-33 ni consola de revisión ES-35; crear una solicitud no implica envío de mensajes ni atención ya realizada.
- Sin cambios en staging/producción, migración de producción, bases externas o datos personales reales. Infraestructura verifica despliegue y migración antes de habilitar.
- No se promete snapshot atómico global de los helpers; se revalida la base al escribir y al leer. El consumidor ES-33 debe volver a comprobarla al publicar resultados.
- Las dimensiones son reglas cualitativas explicables, no validez predictiva, diagnóstico, empleabilidad ni confianza calibrada.
- Pendientes revisión técnica de Mauricio de seguridad/privacidad y QA; no se fusiona ni se resuelven hilos de revisión por Dev.
