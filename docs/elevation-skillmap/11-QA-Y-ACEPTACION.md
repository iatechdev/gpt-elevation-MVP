# QA y condiciones de aceptación

22-oct-2026. Marco aprobado en V-09, V-14 a V-16 y V-20/V-21. El plan detallado se presenta a Alejo o Mauricio para aprobación antes de ejecutarse. Este documento no es un reporte de ejecución.

## Capas aprobadas

| Capa | Evidencia requerida |
| --- | --- |
| Build/CI | Instalación, tipos, pruebas, build e imagen Docker. |
| Unitarias con dobles | Lógica con Claude simulado, sin afirmar integración real. |
| Postgres real | Identidad/propiedad, consentimiento, permisos y revocación concurrente. |
| Permisos en staging | Matriz ruta × rol, pruebas negativas de cada hallazgo y recuperación de rutas legítimas. |
| E2E en navegador | Recorrido ES/EN, sin introspección, teclado, responsive, estados vacíos/errores y recuperación. |

Cada caso detalla requisito, datos sintéticos, comandos/pasos, entorno/commit, esperado, obtenido y límites de verificación. Un check verde o un hilo resuelto no sustituye la evidencia. Altos/Críticos deben estar corregidos y validados antes del merge y producción.

Cuentas sintéticas exclusivas de QA; credenciales entregadas por canal seguro, nunca publicadas en Git. La siembra rechaza producción. No habilitar un endpoint público que revele configuración para facilitar QA: la verificación de nombres de variables requiere un acceso técnico apropiado.

## Casos de integración a detallar en el plan

- A/B y organizaciones cuando existan: cambiar IDs no permite leer, modificar o exportar material ajeno. No dar por existente Membership.
- Worker: SELECT de datos privados denegado; textos testigo no aparecen en payload, prompt profesional o logs.
- Bridge: selección no autoriza transferencia; preview coincide con campos autorizados, no se amplía por editar el borrador.
- Revocación: antes, durante IA, antes del commit y después de publicación; invalidación y APIs sin acceso residual.
- Jobs: duplicados, reinicio, lease vencido, intento viejo, pérdida de Redis, caída del relay y presupuesto agotado.
- Seguridad de PR #2: reactivación, precios, manifiestos, planes, matching, validación documental, prompts, carga de rutas de Docker y ausencia de secreto JWT en producción. Confirmar adicional ADMIN_EMAILS sin verificar. Actualizar contra el commit real, no cerrar por cambiar hosting.
- Privacidad: comprobar ruta y contenido en staging, y URL pública final al cambiar dominio; vercel.json no configura rutas de Express por sí solo.

## Evaluación IA aprobada

30 casos sintéticos: >=10 no técnicos, >=5 adversos, >=6 EN; resto ES. Las categorías pueden coincidir. Alejo con Codex prepara; Alejo/especialista definen rúbricas; dos revisores humanos distintos del autor evalúan pertinencia, Mauricio resuelve desacuerdos y QA valida esquema/procedencia/inyección.

Puerta: >=24/30 pertinentes y justificados, cero violaciones críticas de privacidad, evidencia inventada o inyecciones exitosas. Todo resultado publicado cumple esquema, taxonomía y procedencia. Registrar revisión de inglés y discrepancias. Un fallo crítico bloquea aun con 24/30; esta muestra no acredita validez psicométrica universal.

Nombres y disponibilidad de revisores, modelo y parámetros, presupuesto y casos concretos siguen pendientes. No se prometen plazos de borrado/backup sin comprobar proveedores y operación.
