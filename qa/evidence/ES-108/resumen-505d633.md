# ES-108 · PR #83 · head 505d633 · QA-Claude
Merge local con main (limpio). es108-workflows.cjs: 13 de 14 comprobaciones; npm test 392/392.
- Detecta con archivo y línea los ci.yml rotos de #70, #74 y #71; pasa el de main; pasos mal formados, scripts npm inexistentes, bordes del YAML, npm test falla si se rompe ci.yml.
- Hallazgos: (1) js-yaml 4.1.0 fijado tiene 5 avisos de npm audit (3 de severidad alta: CPU cuadrática en merge keys y !!omap); solo devDependencies, corregido en 4.3.2 sin cambio mayor. (2) working-directory del paso con «./» (p. ej. ./frontend) no se normaliza: `npm run build` en ./frontend se compara con los scripts del backend (falso positivo). (3) `run:` numérico no se detecta.
