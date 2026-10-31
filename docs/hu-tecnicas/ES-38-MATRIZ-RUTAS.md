# ES-38 — Inventario de rutas y matriz pendiente

Generado con `node scripts/es38-route-inventory.mjs` desde frontend/. Reejecutar tras integrar ES-37.

Los guards indicados son componentes cliente, no una prueba de autorización del servidor. Una fila puede ser un contenedor o una redirección, no una pantalla adicional. Los parámetros requieren IDs sintéticos locales; no usar cuentas del piloto.

Para cada pantalla: ES y EN; 320/375/390/768/1024/1440 px; teclado/foco; texto al 200%; reduced-motion; claro y oscuro solo donde ya exista. Registrar por separado cargando, vacío, datos, guardando, éxito y error cuando correspondan; justificar N/A. No habilitar flags pendientes para clientes.

| Ruta resuelta | Tipo | Componentes | Guards cliente | App.tsx | Revisión visual |
| --- | --- | --- | --- | --- | --- |
| / | screen | LandingPage | ninguno | 51 | No ejecutada |
| /login | screen | LoginPage | ninguno | 52 | No ejecutada |
| /profesionales | screen | ProfessionalApplicationPage | ninguno | 53 | No ejecutada |
| /pricing | screen | PricingPage | ninguno | 54 | No ejecutada |
| /facilitation | screen | Participants | ProtectedRoute | 59 | No ejecutada |
| /facilitation/participants/:id | screen | ParticipantDetail | ProtectedRoute | 60 | No ejecutada |
| /facilitation/participants/:id/reviews/new | screen | NewReview | ProtectedRoute | 61 | No ejecutada |
| /app/professional-reviews | screen | OwnReviews | ProtectedRoute | 62 | No ejecutada |
| /app/feedback | screen | FeedbackPage | ProtectedRoute | 64 | No ejecutada |
| /app/route-catalog | screen | CatalogBrowser | ProtectedRoute | 65 | No ejecutada |
| /app/route-catalog/roles/:roleKey | screen | CatalogBrowser | ProtectedRoute | 66 | No ejecutada |
| /app/compass | screen | CompassPage | ProtectedRoute | 67 | No ejecutada |
| /app/next-step | container | CareerShell | ProtectedRoute | 68 | No ejecutada |
| /app/next-step (index) | screen | RoutesScreen | ProtectedRoute | 69 | No ejecutada |
| /app/next-step/experiments | screen | ExperimentList | ProtectedRoute | 70 | No ejecutada |
| /app/next-step/experiments/:id | screen | ExperimentScreen | ProtectedRoute | 71 | No ejecutada |
| /app/next-step/plan | screen | PlanScreen | ProtectedRoute | 72 | No ejecutada |
| /app/exercises | screen | ExercisePage | ProtectedRoute | 74 | No ejecutada |
| /app/diary | screen | JournalPage | ProtectedRoute | 75 | No ejecutada |
| /app/diary/new | screen | JournalPage | ProtectedRoute | 76 | No ejecutada |
| /app/diary/:id | screen | JournalPage | ProtectedRoute | 77 | No ejecutada |
| /app/space/tools | screen | SpaceToolsPage | ProtectedRoute | 78 | No ejecutada |
| /app/onboarding | screen | Onboarding | ProtectedRoute | 79 | No ejecutada |
| /app/checkin | screen | CheckinPage | ProtectedRoute | 80 | No ejecutada |
| /app/chat | screen | SpaceSession, ChatPage | ProtectedRoute | 81 | No ejecutada |
| /app/progress | screen | UserProgress | ProtectedRoute | 82 | No ejecutada |
| /app/dashboard | screen | SpaceSession, UserDashboard | ProtectedRoute | 83 | No ejecutada |
| /app/evidence | screen | EvidenceListPage | ProtectedRoute | 84 | No ejecutada |
| /app/evidence/new | screen | EvidenceCreatePage | ProtectedRoute | 85 | No ejecutada |
| /app/evidence/:id | screen | EvidenceDetailPage | ProtectedRoute | 86 | No ejecutada |
| /app/skill-map | screen | SkillMapPage | ProtectedRoute | 87 | No ejecutada |
| /app/my-therapist | screen | MyTherapist | ProtectedRoute | 88 | No ejecutada |
| /app/session/:id | screen | UserSessionRoom | ProtectedRoute | 90 | No ejecutada |
| /admin/pilot-metrics | container | AdminRoute, AdminLayout | AdminRoute | 93 | No ejecutada |
| /admin/pilot-metrics (index) | screen | PilotMetricsPage | AdminRoute | 94 | No ejecutada |
| /admin/route-catalog | screen | AdminRoute, CatalogManager | AdminRoute | 97 | No ejecutada |
| /admin/route-catalog/:id | screen | AdminRoute, CatalogManager | AdminRoute | 98 | No ejecutada |
| /admin/route-catalog/:id/:kind/:itemKey | screen | AdminRoute, CatalogManager | AdminRoute | 99 | No ejecutada |
| /admin | container | AdminRoute, AdminLayout | AdminRoute | 100 | No ejecutada |
| /admin (index) | redirect | Navigate | AdminRoute | 105 | No ejecutada |
| /admin/dashboard | screen | AdminDashboard | AdminRoute | 106 | No ejecutada |
| /admin/prompts | screen | AdminPrompts | AdminRoute | 107 | No ejecutada |
| /admin/content | screen | AdminContent | AdminRoute | 108 | No ejecutada |
| /admin/users | screen | AdminUsers | AdminRoute | 109 | No ejecutada |
| /admin/metrics | screen | AdminMetrics | AdminRoute | 110 | No ejecutada |
| /admin/manifest | screen | BoardManifest | AdminRoute | 111 | No ejecutada |
| /therapist/dashboard | screen | TherapistDashboard | TherapistRoute | 117 | No ejecutada |
| /therapist/patient/:id | screen | TherapistPatient | TherapistRoute | 118 | No ejecutada |
| /therapist/session/:id | screen | SessionRoom | TherapistRoute | 121 | No ejecutada |
| /board | container | BoardRoute, BoardLayout | BoardRoute | 125 | No ejecutada |
| /board (index) | redirect | Navigate | BoardRoute | 130 | No ejecutada |
| /board/manifest | screen | BoardManifest | BoardRoute | 131 | No ejecutada |
| * | redirect | Navigate | ninguno | 135 | No ejecutada |

53 declaraciones con path o index; 46 entradas de pantalla, 4 contenedores y 3 redirecciones. Esto no acredita cobertura funcional, visual ni de seguridad.
