# ES-92 · PR #64 · detector de riesgo (QA-13-01) · head cd29f38

[QA-Claude] · 28-oct-2026. Merge local con main 13a0f9f; Postgres 17 real, IA simulada, datos sintéticos.

| Bloque | Resultado |
|---|---|
| backend `npm test` / audit alto | 337/337 / exit 0 (sin cambios de frontend) |
| Corpus del detector (`es92-detector.cjs`) | 14/15: las 3 frases reportadas y 12 variantes (15) y 21 formas nuevas se detectan; main no detectaba las 3; 19 controles sin cambio frente a main; 32 frases sanas sin activar y ningún falso positivo nuevo; la 15.ª es mi expectativa errónea («me quiero matar» no se detecta ni en main ni en el PR, ver QA-92-01) |
| Robustez y tiempos | 11 entradas extremas de 20 000 caracteres: peor 3,3 ms (umbral propuesto 50 ms); 4 000 caracteres p95 0,28 ms; entradas no texto sin excepciones; determinista |
| Integración en el chat real (`es92-chat.mjs`) | 12/12 en chat normal y en Brújula: alto → interrumpe y 0 llamadas al proveedor; medio → responde con nota de apoyo; uso normal («me quiero cortar el pelo») sin nota; sin nivel de riesgo en la base; sin frases en los registros |
| Regresión ES-16 / ES-21 | 28/30 (las 2 conocidas) / 27/28 (la falla es mi prueba antigua: la columna `level` de SkillAssessments no es de riesgo) |

Hallazgos (sin Críticos ni Altos del PR):
- QA-92-01 (Medio, preexistente, mismo tipo que QA-13-01): sin detectar en main y en el PR: «me quiero matar», «me voy a matar», «me voy a quitar la vida», «I wish I was dead», «me quiero tirar de un puente», «no quiero estar aquí». (Sí: «quiero matarme», «voy a matarme», «quiero quitarme la vida».)
- QA-92-02 (Bajo): falsos positivos nuevos o conocidos: «no me quiero hacer daño» y «no me quiero lastimar» (negación, medio), «me voy a cortar con el cuchillo» y «al afeitarme» (accidente, medio), «I do not want to live with my parents / alone anymore» (alto; «with», «alone» no se excluyen como lugar). El PR declara «me voy a lastimar» y las negaciones; no declara los de «cortar» accidental ni «live with/alone».
- QA-92-03 (Bajo): falsos negativos nuevos de la exclusión de lugar: «I don't want to live on this planet anymore» pasa de alto (main) a nulo, y «I do not want to live in this world anymore» queda nulo. Es una regresión pequeña: «live on/in» como lugar ahora se ignora también cuando es existencial.
- Informativo: «I don't want to live in Bogotá anymore» era un falso positivo en main y el PR lo corrige.

No verificado: precisión con casos reales (ES-44/ES-46), nivel clínico de cada frase (ES-24; en especial «cortar las venas» en medio).
