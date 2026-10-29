# ES-99 · PR #73 · head 7376e01 · QA-Claude
Merge local con main (limpio); Postgres 17 local; servidor real con el almacenamiento sustituido por un doble (storage-double.cjs); datos sintéticos.
- npm test backend 390/390; prueba Postgres del PR 6/6; db:drift sin deriva; CI verde.
- es99-real-db.mjs 18/18 (2 corridas): PDF/JPEG/PNG/WEBP válidos, 10 MB exactos sí y 10 MB+1 no; 12 subidas inválidas con el código del PR sin trazas ni efectos; formularios truncados/sin boundary/JSON; rol antes de leer (403 con 11 MB en 36-73 ms, nunca 413); almacenamiento caído 503 genérico sin rutas ni credenciales (subida y descarga); propietario desde la sesión; descarga/aprobación solo superadmin; 12 nombres hostiles; 10 subidas simultáneas.
- Mutaciones 5/5 detectadas (contenido, rol después de leer, mensaje interno, ids, manejo de errores de multer).
- Regresión ES-93: corrige S11a, S11b y S11c; sin fallos nuevos.
Observaciones: (1) el comentario de cabecera de routes/validation.js dice /api/junta/validations/:id/... pero las rutas reales son /api/junta/:id/... ; (2) la firma de contenido no detecta un PDF con ejecutable adjunto (polyglot): límite conocido de comprobar los primeros bytes; (3) no hay antivirus.
No verificado: almacenamiento real (GCS u otro), staging.
