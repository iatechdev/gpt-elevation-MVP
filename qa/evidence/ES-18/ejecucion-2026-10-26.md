# Ejecución — ES-18 / PR #16 · commit 48bb68d (y ES-19 / PR #17 · a06db45)

[QA-Claude] · 26-oct-2026 · Clones limpios. Node 24 / Windows. Express y JWT reales; DB y proveedores simulados (arnés de Dev). Postgres real: NO cubierto.

ES-18 (PR #16)
- Repo: backend `npm test` 86 de 86; `npm audit --omit=dev --audit-level=high` exit 0.
- qa/security/es18-sessions.test.cjs: 8 de 8.
  - S01 token revocado → 401 en los cuatro middlewares (user, admin, superadmin, board).
  - S02 logout y logout-all: cierran solo lo debido; otra persona no se ve afectada.
  - S03 sin jti, rol forjado, alg none, expirado, firma ajena → 401.
  - S04 con la base de sesiones caída → 503 (cierra en falla).
  - S05 cambio de estado y reset de contraseña crean el corte de sesiones.
  - S06 token emitido en el mismo segundo del corte → 401 (ventana de hasta 1 s tras logout-all).
  - S07 stats del admin sin entradas ni fechas individuales; pero con una sola entrada el promedio la revela (ánimo 2 y 1 → 1,5; valoración 5 → 5).
  - S08 rol `user` recibe 200 en GET /api/therapist/pacientes y /alerts (sin control de rol en el handler; INV-09).
- Revisión estática de propiedad (sesiones del terapeuta, notas, historia, matching, progreso): filtros por propietario correctos.

ES-19 (PR #17)
- Repo: backend 98 de 98; audit exit 0.
- qa/security/es19-consent.test.cjs: 5 de 5. Titular siempre el token (UserId/userId del cuerpo y de la query se ignoran); B no ve lo de A; 9 propósitos hostiles (constructor, __proto__, etc.) → 404; 8 cuerpos inválidos → 400; necessary → 409; idempotencia; historial sin contenido privado; revocado, no decidido, otra persona y versión antigua → sin acceso; falla de base → 503 en requireConsent.
- Ninguna ruta real consume el consentimiento todavía.
