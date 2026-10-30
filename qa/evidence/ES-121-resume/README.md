# ES-121 parte 2 · PR #102 · head 62d57f52c1df7436acd3c21f366e5a353b2b6181 — evidencia [QA-Claude]
Entorno: merge local con origin/main (que ya incluye la cadena #61–#67), Postgres 17 con migraciones reales, API real, IA simulada, datos SINTÉTICOS. Claude real: no ejecutado.
- `resume-62d57f5.jsonl`: es121-resume.mjs (R0–R12 funcionales y de seguridad; ráfagas R11).
- `regresion-es121-62d57f5.jsonl`: es121-real-db.mjs de #99 sobre el merge: 31 correctas y 1 que cambió por diseño (B5: `resume` ya es fuente válida → 403 sin permiso, antes 400).
- `suites-62d57f5.txt`: backend 495/495; bridge 7/7, resume 8/8, resume-skills 8/8, data-rights 12/12; `test:insights:pg` 5 pasan / 3 fallan (ver ES121R-QA-02).
- `mutaciones-62d57f5.txt`: 3 mutaciones (quitar consentimiento, quitar propietario, quitar depuración de contacto): las tres hacen fallar pruebas mías.

| ID | Sev. | Qué | Cómo reproducir |
|---|---|---|---|
| ES121R-QA-01 | Medio (rendimiento, umbral propuesto) | Con propuestas simultáneas desde la hoja de vida, otra persona que solo lee tarda más que el umbral propuesto (500 ms): con 6 simultáneas 244–771 ms; con 20, 391–950 ms. Sin 5xx ni agotamiento del pool; probable bloqueo del bucle de eventos al leer los PDF. Referencia: con chat y diario (#99) la espectadora respondía en 31–195 ms. | es121-resume.mjs, bloque R11 (`R11a`, `R11x`). |
| ES121R-QA-02 | Bajo | `npm run test:insights:pg` (es-121-postgres.cjs) falla 3 pruebas al fusionar con main actual: `relation "AiJobs" does not exist`. También con #99 solo (2 fallas). El código de producto no falla (migraciones reales: R7/R8 pasan); es el arnés de la prueba, que no crea `AiJobs` (ES-85, ya en main). No verifiqué si el CI la ejecuta. | `ES121_TEST_DATABASE_URL=… npm run test:insights:pg` sobre el merge con main. |
| ES121R-QA-03 | Info | Con la hoja de vida, una propuesta con salida inválida del modelo responde 502 `invalid_model_output` (reintentable), igual que chat y diario. | — |

## No verificado
Calidad con Claude real; hojas de vida con columnas o imágenes (declarado por Dev); PDFs binarios de producción; frontend (no hay); producción.
