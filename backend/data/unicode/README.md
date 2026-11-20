# Datos de Unicode (solo servidor)

`confusables.txt` es el archivo **UTS #39 «Unicode Security Mechanisms»** (versión 18.0.0, fecha 2026-08-06) tal como lo publica el Consorcio Unicode en
https://www.unicode.org/Public/security/latest/confusables.txt. Se versiona aquí como **dato fuente** de `scripts/gen-confusables.cjs`, que genera `utils/confusables-table.js` (ES-312).

- **Solo lo lee el generador, a mano, en desarrollo.** El servidor en ejecución NO lee este archivo (carga la tabla ya generada) y **nunca descarga nada**. No está en `frontend/` ni entra en el bundle del cliente.
- **Atribución y licencia:** © 2026 Unicode®, Inc. Unicode y el logotipo de Unicode son marcas registradas de Unicode, Inc. Condiciones de uso y licencia: https://www.unicode.org/terms_of_use.html (la cabecera del propio archivo las menciona y no se ha modificado).
- **Actualizar:** descargar el archivo nuevo a mano, sustituirlo, correr `node scripts/gen-confusables.cjs`, revisar el diff de `utils/confusables-table.js` y pasar las pruebas `test/es-312-confusables.test.cjs` en un PR.
