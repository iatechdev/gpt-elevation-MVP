# Ejecución — ES-78 / PR #15 · commit 87a98f0

[QA-Claude] · 26-oct-2026 · Clon limpio. Node 24 / Windows; Claude y DB simulados.
- Repo: backend 78 de 78; audit exit 0.
- Revisión del diff: el prompt de GET /api/therapist/pacientes/:id/resumen-ia ya no lleva el nombre (la consulta solo carga `id`) ni "clinical assistant"; pide no diagnosticar ni prescribir.
- Barrido de llamadas a Claude con datos personales: POST /api/sessions/therapist/:id/end (routes/sessions.js, ~línea 443) envía el nombre real del paciente y 200 caracteres de la nota del terapeuta a Claude. No cubierto por ES-78 ni por el inventario. matching.js envía nombres de terapeutas al listar candidatos.
