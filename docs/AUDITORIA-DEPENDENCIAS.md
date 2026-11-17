# Auditoría de dependencias del frontend (puerta de la CI)

El job `frontend` de la CI ejecuta `node scripts/audit-gate.cjs` en lugar de `npm audit --omit=dev --audit-level=high` a secas.

## Qué hace
- Corre `npm audit --omit=dev --json` y **sigue bloqueando cualquier vulnerabilidad alta o crítica**.
- La única forma de dejar pasar un aviso es una **excepción explícita** en `EXCEPTIONS` (dentro del script): identificador del aviso (GHSA), **motivo escrito** y **fecha de caducidad**.
- La excepción es por aviso (GHSA), no por paquete: otro aviso del mismo paquete falla.
- **Pasada la fecha, la puerta falla aunque el aviso siga**: nadie se olvida de revisarla. El último día de vigencia es inclusivo (hasta las 23:59:59 UTC).
- Un informe ilegible, sin red o sin lockfile falla (código 2); nunca pasa en silencio.
- No usa `npm audit fix` ni `--force`.
- Pruebas: `frontend/test/audit-gate.test.mjs` (aviso permitido antes de la fecha = pasa; después = falla; cualquier otro alto/crítico = falla).

## Excepción vigente

| Aviso | Paquete | Caduca | Motivo |
| --- | --- | --- | --- |
| GHSA-fc5q-39xc-vjpf (ReDoS en extglobs repetidos) | picomatch ≤ 4.0.7, llega por vite → tinyglobby → fdir → picomatch | **2026-12-01** | Solo lo usa la herramienta de build para casar rutas de archivos propios al compilar. **No está en el bundle servido** (ver verificación). Sin versión corregida (4.0.7 es la última y sigue marcada); la única salida de npm es bajar vite a 6.2.7 (cambio mayor), que no se hace sin ticket. |

Verificación (17-nov-2026): se construyó el frontend (`vite build`) y se buscó en los 159 archivos de `dist/` los textos `picomatch`, `tinyglobby` y `fdir`: **0 coincidencias**. Ningún archivo de `src/` ni `package.json` importa picomatch directamente.

## Revisar antes del 2026-12-01
- ¿Hay una versión de picomatch sin el aviso, o una versión de vite que ya no lo arrastre? Entonces: actualizar la dependencia, **borrar la excepción** y volver a la auditoría estricta.
- Si no hay parche: decidir (PO/Tech Lead) entre renovar la fecha con un motivo nuevo o cambiar de herramienta; renovar es editar `until` en el script y este documento, en un PR revisado.

El job `backend` conserva `npm audit --omit=dev --audit-level=high` sin excepciones (hoy no tiene avisos altos).
