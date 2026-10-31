# ES-112 · PR #94 · head 7321948 — evidencia [QA-Claude]
Entorno: merge local del head con origin/main, Postgres embebido (qa112), servidor real con presupuesto 1000 (día) y otro sin presupuesto; Claude simulado; datos sintéticos.
- `ui-7321948.jsonl`: es112-ui.cjs, 27 correctos / 2 observaciones (A2c, D0c). Capturas en `capturas/`.
- Unitarias frontend: 164/164 (tsc, lint y build OK).
- Mutaciones (test unitario es-112-space): «isExhausted siempre falso», «sin tope 100 %», «límite 0 aceptado» → detectadas. «La pausa no se guarda en sessionStorage» → NO la detecta el test unitario; la cubre ES112-A2b del script de navegador.
- Hallazgos: ES112-QA-01 (Bajo): la pausa (sessionStorage `elevation_space_paused`) no depende de la persona ni se borra al cerrar sesión; otra persona que entra en la MISMA pestaña ve el chat en pausa sin haberla activado (Retomar la quita). ES112-QA-02 (Bajo): fondo medido de la pantalla rgb(255,255,255) y body rgb(249,249,247), no #FAFAF9 de la landing.
- No verificado: modelo real de Claude; despliegue en Railway.
