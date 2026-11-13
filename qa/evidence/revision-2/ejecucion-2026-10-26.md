# Revisión 2 — 26-oct-2026

[QA-Claude] · Clones limpios de cada head nuevo. Node 24 / Windows. DB y proveedores simulados salvo indicación. Postgres real: NO cubierto.

| PR / HU | Head | Resultado |
| --- | --- | --- |
| #16 ES-18 | 9693b9c | backend 89/89; audit exit 0; `qa/security/es18-sessions.test.cjs` 8/8 con las aserciones endurecidas: rol `user`, admin, superadmin y board → 403 en /api/therapist/*, terapeuta accede; promedios null con n=1 y 5,0 con n=6; token emitido por el emisor real 5 ms tras logout-all → 200 |
| #17 ES-19 | f9d7a19 | backend 101/101 (merge de ES-18 al día); `es19-consent.test.cjs` 5/5; `es18-sessions` sobre la rama apilada 8/8 |
| #19 ES-79 | 6d1b4e1 | backend 78/78; audit exit 0; revisión del diff: la ruta ya no consulta el nombre ni envía la nota del terapeuta; solo estado de ánimo |
| #13 ES-62 | c681bb3 | test 8/8; tsc, lint y audit en 0; JS 522,22 kB; 1440 px: logotipo desde 202 e "Ingresar" hasta 1224 (marco de la maqueta); 360 px oscuro sin desbordes |
| #11 ES-63 | 6c2f782 | test 17/17; tsc, lint y audit en 0; JS 522,23 kB; 1440 px: puertas 174–713 y 713–1252 (igual que la maqueta); 360 px sin desbordes |
| #12 ES-64 | 675dedd | test 23/23; tsc, lint y audit en 0; JS 522,88 kB; 1440 px con la franja: 174–1252, texto desde 202; 360 px SIN la variable: sin desbordes; 360 px CON la variable: la etiqueta mide 365 px frente a 326 px del contenedor y la página llega a 382 px (desborde horizontal) |

Nota: #11 y #12 son ramas apiladas (incluyen los commits de #13 y #11).
