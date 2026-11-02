# ES-86 · Clave de cifrado propia del dominio profesional (PROPUESTA para revisión de QA)

28-oct-2026 · Autor: Dev-Worker-Claude · Decide lo técnico: Mauricio. Subtarea C de ES-84 (spike `43-SPIKE-WORKER-ES-84.md`, §5). Todo lo que no se pudo verificar está marcado «no verificado».

## Por qué
El worker de análisis de IA (ES-84) leerá el contexto profesional que la persona aprobó (`CareerContextVersions.payload`). Si ese texto se cifrara con `DATA_ENCRYPTION_KEY`, el servicio del worker tendría la clave que también abre chats y diario. Con una clave propia, **un compromiso del worker no abre el espacio privado** (ADR-002/003).

## Formato
`v2p:<kid>:<iv 24 hex>:<etiqueta 32 hex>:<contenido hex>` — AES-256-GCM. La clave sale de HKDF-SHA256 con sal y contexto propios (`elevation-professional-…`), distintos de los de `v2:`. El `kid` (identificador de clave, `a-z0-9`, 1–8) viaja en el dato y se **autentica como AAD**: cambiar el `kid` de un dato cifrado hace fallar el descifrado.
`v2:` (clave de datos) sigue existiendo para chats, diario y todo lo demás; ES-86 solo cambia el `payload` del contexto profesional.

## Código
- `backend/utils/professionalCrypto.js`: cifrar y descifrar. **No importa `utils/crypto.js` ni usa `DATA_ENCRYPTION_KEY` como clave** (el proceso del worker solo cargará este módulo). Sin clave: error `professional_key_missing`; **no hay clave por defecto**. Clave corta (menos de 32 caracteres), igual a la de datos, `kid` inválido o repetido: `professional_key_invalid` (el mensaje nunca incluye material de clave).
- `utils/crypto.js › desencriptar` delega los datos `v2p:` en ese módulo. Así el API, la exportación (ES-23) y cualquier lector existente leen **ambos** formatos durante la transición. Si falta la clave, falla; nunca devuelve el texto cifrado.
- `utils/careerContext.js › confirm` escribe `v2p:` cuando hay clave profesional. **Sin clave: en producción responde 503 `professional_key_missing` y no guarda nada** (no degrada en silencio a la clave de datos); fuera de producción conserva el formato `v2:` (así siguen corriendo desarrollo y pruebas).

## Variables (los valores los carga Mauricio; nunca en Git)
| Variable | Qué es |
| --- | --- |
| `PROFESSIONAL_ENCRYPTION_KEY` | Clave vigente. Mínimo 32 caracteres; recomendado 32 bytes aleatorios en hex (64 caracteres). **Distinta** de `DATA_ENCRYPTION_KEY`. |
| `PROFESSIONAL_KEY_ID` | Identificador de la vigente. Por defecto `p1`. |
| `PROFESSIONAL_ENCRYPTION_KEY_PREVIOUS` / `PROFESSIONAL_KEY_ID_PREVIOUS` | Solo durante una rotación: la clave anterior, solo para descifrar. |

Servicios: **API** (necesita la profesional y la de datos) y **worker** (solo la profesional; nunca `DATA_ENCRYPTION_KEY`, `JWT_SECRET` ni la URL de base del API). Perder la clave profesional deja ilegibles los contextos cifrados con ella: **respaldarla fuera del repositorio** (requisito 7 del spike §15).

## Migración de datos (reversible): `backend/scripts/reencryptProfessional.js`
Es un comando de operador y **no una migración de esquema**: depende de secretos y de que el código nuevo (que lee ambos formatos) ya esté desplegado; si corriera antes, el código viejo no entendería `v2p:`.

```
node scripts/reencryptProfessional.js --to=professional            # simulacro: solo cuenta, no escribe
node scripts/reencryptProfessional.js --to=professional --apply    # v2: → v2p: (y rota v2p: con otro kid)
node scripts/reencryptProfessional.js --to=data --apply            # REVERSA: v2p: → v2:
```

Propiedades: una transacción (todo o nada), filas bloqueadas `FOR UPDATE`, idempotente, verifica cada fila (ida y vuelta) antes de escribir, aborta ante un formato desconocido o una clave que falte o no sirva, y **solo imprime conteos** (nunca texto, claves ni identificadores). Si existe `AiJobs` (ES-85), los jobs `PENDING`/`RUNNING` que apuntan a una versión re-cifrada pasan a `INVALIDATED` (`context_reencrypted`): su `contextHash` (sha256 del payload cifrado) ya no coincide; la persona puede volver a pedir el análisis.

### Orden de despliegue (staging; producción igual, con confirmación de Mauricio)
1. Respaldo de la base (como en toda operación sobre staging).
2. Mauricio carga `PROFESSIONAL_ENCRYPTION_KEY` (y `PROFESSIONAL_KEY_ID` si no es `p1`) en el servicio **API**.
3. Desplegar el código de ES-86. Desde aquí los contextos nuevos nacen `v2p:` y los viejos se siguen leyendo.
4. Simulacro (`--to=professional`) y, si los conteos son los esperados, `--apply`.
5. Verificar: la persona de prueba ve su contexto; el motor profesional lo lee.

### Reversión
`--to=data --apply` devuelve todo a `v2:`. Si además se revierte el código, los `v2:` vuelven a ser lo único que existe. Lo creado con `v2p:` después del despliegue también vuelve a `v2:` con ese comando.

## Rotación (documentada y probada)
1. Generar una clave nueva y un `kid` nuevo (por ejemplo `p2`).
2. En API y worker: `PROFESSIONAL_ENCRYPTION_KEY` = la nueva, `PROFESSIONAL_KEY_ID` = `p2`, `PROFESSIONAL_ENCRYPTION_KEY_PREVIOUS` = la vieja, `PROFESSIONAL_KEY_ID_PREVIOUS` = `p1`. Desplegar (ambas claves descifran; lo nuevo se cifra con `p2`).
3. `--to=professional --apply` re-cifra todo lo que aún tenga el `kid` anterior.
4. Comprobar que no queda nada con `p1` y **solo entonces** retirar `…_PREVIOUS`. (Con la anterior retirada, un dato `p1` falla con `unknown_key_id`.)

Compromiso de la clave: igual, con una clave nueva; después retirar la comprometida y considerar expuesto el contenido que ella protegía.

## Pruebas (salida real en el PR)
- `test/es-86-professional-crypto.test.cjs` (6): ida y vuelta, formato, IV, alteración y cambio de `kid` (AAD), sin clave por defecto, claves inválidas sin filtrar material, aislamiento (un proceso con solo la clave de datos no descifra lo profesional; un proceso tipo worker con solo la profesional descifra lo profesional, **no carga `utils/crypto.js`** y no descifra el diario), rotación.
- `test/integration/es-86-postgres.cjs` (`npm run test:professional-key:pg`, Postgres y criptografía reales, 10): escritura `v2p:`, 503 sin clave en producción, doble lectura, migración hacia delante y reversa con el mismo contenido byte a byte, rotación, todo o nada (sin clave, formato desconocido, dato alterado), invalidación de jobs vivos, re-cifrado concurrente con confirmaciones nuevas.

## No verificado
- Ejecución contra la base y los servicios reales de staging (nada se tocó fuera de Postgres local).
- Que el entorno desde el que Mauricio lance el comando tenga `DATA_ENCRYPTION_KEY` y la profesional disponibles.
- Volúmenes grandes: el comando procesa todo en una transacción (suficiente para el piloto de 6 personas; con miles de filas habría que paginarlo).
- La integración con el proceso worker (ES-87) y con la creación de jobs (ES-89, que debe calcular `contextHash` igual que ES-85).
