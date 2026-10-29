# ES-13 · PR #59 · «Chat guía Brújula profesional» · head 7b699ad

[QA-Claude] · 28-oct-2026 · Windows 11, Node 22.23.4, Chromium (Playwright 1.64.1). Merge local temporal con `main` 17b1e57, Postgres 17 local (embedded), proveedor de IA SIMULADO (costo de LLM: cero; no se hizo la muestra opcional de llamadas reales, no autorizada), datos sintéticos `@example.test`, secretos sintéticos generados en el equipo.

## Resultado
| Bloque | Resultado |
|---|---|
| Repo: lint, tipos, `npm test` backend / frontend, build, `npm audit` (alto) | 0 avisos, ok, 325/325, 76/76, ok, exit 0 (backend: 6 moderadas ya existentes; frontend 0) |
| API contra Postgres real (`qa/integration/es13-real-db.mjs`) | 56 de 56 (`run2-7b699ad.jsonl`; la primera pasada tuvo 4 falsos fallos míos, corregidos en el script) |
| Interfaz de punta a punta con el servidor real (`es13-ui-e2e.cjs`) | 13 de 13 (`ui-e2e-7b699ad.jsonl`, capturas en `capturas/`) |
| Script de Dev (`frontend/scripts/es13-browser.cjs`) | 8 de 8 con una espera de 500 ms tras «Ahora no» (`es13-browser-dev.cjs`); sin la espera, la prueba falla por una carrera propia del script (el título de la banda sigue un fotograma), no del producto |
| Regresión | ES-15 39/39, ES-18/19 20/20, ES-16 28/30 (los 2 conocidos: S05 mío mal diseñado, I02d QA-16-02) |
| Rendimiento (mock) | chat normal p50 40 ms / p95 48 ms; Brújula p50 44 ms / p95 48 ms; 6 personas × 5 mensajes simultáneos: 30/30 en 200 en 852 ms |

## Lo comprobado (resumen)
- `mode`: solo ausente o «compass»; 13 valores inválidos → 400 sin llamar al proveedor ni escribir.
- Prompt: base (Vault o borrador ES/EN) → Manifiesto → reglas fijas → diario elegido (delimitado, delimitador aleatorio, instrucciones maliciosas dentro del bloque) → COMPANION_LIMITS al final; sin el prompt del terapeuta ni el de Elevation; el chat normal no cambia.
- Vault: participante, terapeuta, junta y anónimo → 403; administrador edita; cifrado en la base; vacío → 400; 200 000 caracteres → 413 al guardar y el chat sigue sin 500.
- Seguridad antes que el modo: riesgo alto (ES/EN) y pausa; el proveedor no se llama. Presupuesto agotado → 429; sin presupuesto → 503. requestId: 6 envíos simultáneos → 1 turno, 2 mensajes, 1 llamada; ajeno → 404. Diario ajeno/mixto → 404; duplicados una sola vez; borrado → 404.
- Privacidad: el modo no se guarda ni se devuelve; sin cambios de esquema; terapeuta, administrador, superadmin y junta no leen el chat; sin textos en los registros del servidor; sin secretos ni prompts en el bundle.
- Interfaz: bandera apagada → ni enlace ni banda y `?mode=compass` se ignora (servidor recibe chat normal); encendida → enlace, banda, «Ahora no» sin enviar, aviso al salir con texto, `mode` solo en la solicitud de la Brújula; ES/EN; 320, 375, 768, 1440 px sin desbordes; contraste ≥ 6,35:1; botones ≥ 44 px; foco visible; solo propio origen.

## Observaciones (no bloquean)
- **QA-13-01 (Medio, preexistente, ES-21, idéntico en ambos modos):** el detector de riesgo no marca «me quiero hacer daño», «I do not want to live anymore» ni «me quiero lastimar» (sí «I don't want to live anymore»). Ticket aparte.
- **QA-13-02 (Bajo):** la banda con «Cerrar sin presión» está arriba del hilo; con una conversación larga hay que desplazarse para verla (en 320 px queda fuera de pantalla).
- **QA-13-03 (Bajo):** si el cliente no envía `lang`, el borrador usa español aunque la persona escriba en inglés (la interfaz sí envía `lang`).
- Carrera en el script de Dev tras «Ahora no» (arriba).

## No verificado
Conducta real de Claude (una pregunta por turno, tono ACT): requiere llamadas reales no autorizadas. Revisión editorial del prompt por el especialista (ES-17). Staging. Tema oscuro: la aplicación no tiene tema oscuro (las capturas «dark» son iguales a las claras). ES-22 no se repitió como archivo (cubierto por `npm test` y B01/B02).
