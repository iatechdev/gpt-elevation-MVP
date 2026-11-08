// ES-153: textos de los marcos. Fuente: docs/ux/plataforma/textos.json (claves nav_*, pf_nav_*, ad_n_*, ad_role_*, ad_noacc*, foot*).
// Las claves nuevas (sin entrada en textos.json) van marcadas «nuevo»; ES-154 moverá todo a la fuente única. El inglés es borrador.
// Decisión 2: «Profesional» es la etiqueta aprobada; vive en una constante para cambiarla en un solo lugar.
export const PROFESSIONAL_LABEL = { es: 'Profesional', en: 'Professional' } as const

const es = {
  skip: 'Saltar al contenido', language: 'Idioma', brandLabel: 'Elevation', main: 'Principal', userMenu: 'Menú de usuario', admin: 'Administración',
  // público
  how: 'Cómo funciona', privacy: 'Privacidad', signIn: 'Entrar', signUp: 'Crear cuenta',
  // persona
  map: 'Mapa', chat: 'Conversación', evidence: 'Evidencias', diary: 'Diario', next: 'Siguiente paso',
  today: 'Hoy', bridge: 'El Puente', myProfessional: 'Mi profesional', tools: 'Mis herramientas', progress: 'Mi progreso', plan: 'Mi plan',
  resumes: 'Hojas de vida', reviews: 'Revisiones profesionales', data: 'Mis datos', feedback: 'Tu opinión', signOut: 'Salir', signingOut: 'Saliendo…',
  // profesional
  proPanel: 'Panel', proFacilitation: 'Personas en facilitación',
  // administración y junta
  adminRole: 'Administración', superRole: 'Superadministración', boardRole: 'Junta ética', boardGroup: 'Junta',
  adPanel: 'Panel', adGuides: 'Guías de la IA', adContent: 'Contenido', adUsers: 'Personas usuarias', adMetrics: 'Métricas',
  adRoutes: 'Catálogo de rutas', adSkills: 'Catálogo de habilidades', adPilot: 'Piloto', adManifest: 'Manifiesto ético',
  // pie
  foot1: 'Elevation es acompañamiento y autoconocimiento. No es terapia ni diagnóstico.', foot2: 'Tú decides qué guardar.',
  // acceso
  noAccess: 'Tu rol no tiene acceso a esta pantalla.', noAccessBody: 'Si crees que deberías verla, pídeselo a quien administra la plataforma.', // ad_noacc, ad_noacc_p
  goHome: 'Ir a mi inicio', // nuevo
  checking: 'Verificando tu acceso…', // nuevo
  unavailable: 'No pudimos verificar tu sesión.', unavailableBody: 'Tu sesión sigue abierta. Revisa tu conexión e inténtalo de nuevo.', retry: 'Reintentar', // nuevo
}

const en: typeof es = {
  skip: 'Skip to content', language: 'Language', brandLabel: 'Elevation', main: 'Main', userMenu: 'User menu', admin: 'Administration',
  how: 'How it works', privacy: 'Privacy', signIn: 'Sign in', signUp: 'Create account',
  map: 'Map', chat: 'Conversation', evidence: 'Evidence', diary: 'Diary', next: 'Next step',
  today: 'Today', bridge: 'The Bridge', myProfessional: 'My professional', tools: 'My tools', progress: 'My progress', plan: 'My plan',
  resumes: 'Résumés', reviews: 'Professional reviews', data: 'My data', feedback: 'Your feedback', signOut: 'Sign out', signingOut: 'Signing out…',
  proPanel: 'Dashboard', proFacilitation: 'Facilitation participants',
  adminRole: 'Administration', superRole: 'Superadministration', boardRole: 'Ethics board', boardGroup: 'Board',
  adPanel: 'Dashboard', adGuides: 'AI guides', adContent: 'Content', adUsers: 'Users', adMetrics: 'Metrics',
  adRoutes: 'Route catalog', adSkills: 'Skills catalog', adPilot: 'Pilot', adManifest: 'Ethical manifest',
  foot1: 'Elevation is support and self-knowledge. It is not therapy or diagnosis.', foot2: 'You decide what to save.',
  noAccess: 'Your role does not have access to this screen.', noAccessBody: 'If you think you should see it, ask whoever administers the platform.',
  goHome: 'Go to my home',
  checking: 'Checking your access…',
  unavailable: 'We could not verify your session.', unavailableBody: 'Your session is still open. Check your connection and try again.', retry: 'Try again',
}

export const shellCopy = { es, en }
export type ShellCopy = typeof es
