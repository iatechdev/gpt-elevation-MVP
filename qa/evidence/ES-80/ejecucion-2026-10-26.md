# Ejecución — ES-80 / PR #21 · commit e0958bd (y uso de la base real para ES-18/19)

[QA-Claude] · 26-oct-2026 · Windows 11, Node 24, sin administrador. Clon limpio del commit.

| Caso | Resultado real |
| --- | --- |
| ES80-F01 arranque | `npm ci` 10 s (143 MB en node_modules); `npm run db:local` arranca PostgreSQL 17.10 en el puerto 54329; escucha solo en 127.0.0.1 y ::1 |
| ES80-F02 esquema real | Servidor real: 16 tablas creadas, registro 201, login 200 |
| ES80-F03 reinicio / --reset | Tras reiniciar conserva los datos (1 usuario); con `--reset` la base queda vacía (0 tablas) |
| ES80-F04 repo | 76 de 76 pruebas; `npm audit --omit=dev --audit-level=high` exit 0 (también el completo) |
| ES80-F05 CI | Job backend en verde: levanta postgres:17 y escribe "tablas creadas: 13" |
| ES80-S01 secretos | 0 en el diff; sin referencias a staging |
| ES80-S02 cadena de suministro | `embedded-postgres` 17.10.0-beta.17 y 8 paquetes `@embedded-postgres/*`: versión exacta, MIT, solo dev. Los 8 paquetes de plataforma tienen un script postinstall (`hydrate-symlinks.js`): solo crea enlaces simbólicos desde un JSON, sin red ni ejecución de comandos |
| ES80-S03 red | Solo loopback |
| ES80-S04 producción | `npm ci --omit=dev`: 43 MB y sin embedded-postgres; el `npm ci` completo: 143 MB con el binario de Windows. Si el build de Railway no corre con NODE_ENV=production o con --omit=dev, el binario de Linux (~100 MB) llega a la imagen: no verificado |
| ES80-P01 costo | Workflow del PR 39 s frente a 21-26 s de otros PR (+~14 s, casi todo el pull de postgres:17: 19 s); dentro del umbral propuesto de 60 s |
| Hallazgo | La base local queda en codificación WIN1252 con localización Spanish_Colombia.1252; insertar un emoji falla ("no equivale en WIN1252"). Staging (Supabase) usa UTF8 |
| Efecto lateral observado | Ejecutar `npm ci` en la carpeta de node_modules mientras la base está en marcha borró los binarios y rompió la base en ejecución (FATAL: could not open directory) |

Integración real ES-18/19: ver `es18-19-real-db-run1.jsonl` (base UTF8 creada a mano en el mismo servidor local): 20 de 20.
