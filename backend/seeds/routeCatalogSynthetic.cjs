// Catálogo SINTÉTICO de prueba para el catálogo de rutas (ES-31). NO es contenido real ni describe a las personas del piloto: son perfiles
// genéricos de reconversión inventados SOLO para probar el flujo y analizarlo con el cliente. Todo elemento lleva `synthetic: true`, las
// URLs usan example.org (dominio reservado, RFC 2606) y ninguna fuente, oferta, precio ni salario es real. El cliente define el catálogo real.
// Uso: scripts/seedRouteCatalogSynthetic.js (se niega a correr en producción).

const dayOffset = (today, n) => new Date(Date.parse(today) - n * 86400000).toISOString().slice(0, 10);
const S = (es, en) => ({ es: `[SINTÉTICO] ${es}`, en: `[SYNTHETIC] ${en}` });

function build(today = new Date().toISOString().slice(0, 10)) {
  const contexts = {
    ctx_educacion_formacion: { labels: S('Educación a formación corporativa', 'Education to corporate training'), note: S('Perfil genérico de prueba.', 'Generic test profile.') },
    ctx_contabilidad_analisis: { labels: S('Contabilidad a análisis financiero', 'Accounting to financial analysis') },
    ctx_salud_gestion: { labels: S('Salud a gestión de proyectos de salud', 'Healthcare to healthcare project management') },
    ctx_ventas_exito_cliente: { labels: S('Ventas a éxito del cliente', 'Sales to customer success') },
    ctx_administracion_operaciones: { labels: S('Administración a operaciones', 'Administration to operations') },
    ctx_comunicacion_contenidos: { labels: S('Comunicación a estrategia de contenidos', 'Communications to content strategy') },
  };
  const source = (type, title, accessible, ago, country) => ({
    type, title: `[SINTÉTICO] ${title}`, url: 'https://example.org/fuente-sintetica', country, language: 'es', consultedAt: dayOffset(today, ago), consultedBy: 'Revisor sintético', accessible,
  });
  const sources = {
    src_oficial_a: source('official', 'Descripción ocupacional oficial A', true, 3, 'CO'),
    src_oficial_b: source('official', 'Descripción ocupacional oficial B', true, 5, 'DK'),
    src_institucional_c: source('institutional', 'Guía institucional C', true, 10, 'CO'),
    src_informe_d: source('market_report', 'Informe de mercado D (de prueba)', true, 200, 'DK'), // antigua: debe salir stale
    src_inaccesible_e: source('other', 'Documento E que ya no abre', false, 2, null), // inaccesible: debe salir stale
    src_curso_f: source('course_provider', 'Proveedor de cursos F', true, 4, null),
  };
  const task = (es, en, status, sourceKey) => ({ text: S(es, en), aiExposure: sourceKey ? { status, sourceKey } : { status, note: status === 'hypothesis' ? S('Hipótesis de trabajo, por validar con una fuente.', 'Working hypothesis, to be validated with a source.') : S('Dato desconocido.', 'Unknown.') } });
  const role = (labels, industry, market, ctx, srcKeys, tasks, caps, regulated) => ({
    labels, industry, market, languagesRequired: market === 'DK' ? ['en', 'unknown'] : ['es'], modality: ['hybrid', 'remote'], tasks, barriers: [S('Barrera de entrada de prueba.', 'Test entry barrier.')],
    capabilities: caps.map((skillKey, i) => ({ skillKey, importance: i === 0 ? 'essential' : 'optional' })), contexts: [ctx], sourceKeys: srcKeys,
    review: { by: 'Revisor de dominio sintético', at: dayOffset(today, 1) }, regulated: regulated || { isRegulated: false },
  });
  const roles = {
    formador_corporativo: role(S('Formador corporativo', 'Corporate trainer'), S('Formación', 'Training'), 'CO', 'ctx_educacion_formacion', ['src_oficial_a', 'src_institucional_c'],
      [task('Diseñar sesiones de formación.', 'Design training sessions.', 'sourced', 'src_oficial_a'), task('Evaluar el aprendizaje.', 'Assess learning.', 'hypothesis')], ['comunicacion', 'planificacion_organizacion']),
    analista_financiero: role(S('Analista financiero', 'Financial analyst'), S('Finanzas', 'Finance'), 'CO', 'ctx_contabilidad_analisis', ['src_oficial_a', 'src_informe_d'],
      [task('Preparar reportes de desempeño.', 'Prepare performance reports.', 'sourced', 'src_oficial_a'), task('Conciliar cifras.', 'Reconcile figures.', 'unknown')], ['analisis_informacion', 'resolucion_problemas']),
    coordinador_proyectos_salud: role(S('Coordinador de proyectos de salud', 'Healthcare project coordinator'), S('Salud', 'Healthcare'), 'DK', 'ctx_salud_gestion', ['src_oficial_b'],
      [task('Coordinar equipos de un proyecto.', 'Coordinate project teams.', 'sourced', 'src_oficial_b')], ['planificacion_organizacion', 'trabajo_en_equipo'],
      { isRegulated: true, note: S('La habilitación para ejercer queda pendiente de comprobar en la fuente oficial.', 'The license to practice is pending verification at the official source.'), sourceKey: 'src_oficial_b' }),
    exito_cliente: role(S('Especialista en éxito del cliente', 'Customer success specialist'), S('Servicios', 'Services'), 'DK', 'ctx_ventas_exito_cliente', ['src_oficial_b', 'src_inaccesible_e'],
      [task('Acompañar la adopción del servicio.', 'Support service adoption.', 'hypothesis')], ['comunicacion', 'influencia_liderazgo']),
    analista_operaciones: role(S('Analista de operaciones', 'Operations analyst'), S('Operaciones', 'Operations'), 'CO', 'ctx_administracion_operaciones', ['src_institucional_c'],
      [task('Mejorar procesos administrativos.', 'Improve administrative processes.', 'sourced', 'src_institucional_c')], ['resolucion_problemas', 'adaptabilidad']),
    estratega_contenidos: role(S('Estratega de contenidos', 'Content strategist'), S('Comunicación', 'Communications'), 'DK', 'ctx_comunicacion_contenidos', ['src_oficial_b', 'src_informe_d'],
      [task('Planificar un calendario editorial.', 'Plan an editorial calendar.', 'unknown')], ['comunicacion', 'aprendizaje_autonomo']),
  };
  const offer = (roleKey, org, market, salary, ago) => ({
    title: `[SINTÉTICO] Oferta de prueba (${roleKey})`, organization: `[SINTÉTICO] ${org}`, roleKey, url: 'https://example.org/oferta-sintetica', market, language: market === 'DK' ? 'en' : 'es', modality: 'hybrid',
    salary, checkedAt: dayOffset(today, ago), verification: { by: 'Revisor sintético', at: dayOffset(today, ago) },
  });
  const offers = {
    oferta_formador_vigente: offer('formador_corporativo', 'Organización A', 'CO', { published: false }, 2), // vigente, sin salario publicado
    oferta_analista_vigente: offer('analista_financiero', 'Organización B', 'CO', { published: true, text: '[SINTÉTICO] rango de prueba, no real' }, 5),
    oferta_exito_vencida: offer('exito_cliente', 'Organización C', 'DK', { published: false }, 40), // verificación vencida: debe salir expired
  };
  const resource = (kind, title, linkedSkillKey, roleKeys, price) => ({
    kind, title: `[SINTÉTICO] ${title}`, url: 'https://example.org/recurso-sintetico', provider: '[SINTÉTICO] Proveedor de prueba', purpose: S('Practicar una brecha concreta.', 'Practice a specific gap.'), language: 'es', level: 'introductory',
    duration: { minutes: 90, text: '90 min' }, price, linkedSkillKey, exercise: S('Ejercicio breve que muestre lo aprendido.', 'Short exercise that shows what was learned.'), roleKeys, sourceKey: 'src_curso_f',
  });
  const resources = {
    rec_comunicacion: resource('course', 'Curso breve de comunicación', 'comunicacion', ['formador_corporativo', 'exito_cliente'], { published: true, amount: 0, currency: 'COP' }),
    rec_analisis: resource('reading', 'Lectura sobre análisis de información', 'analisis_informacion', ['analista_financiero'], { published: false }), // precio por confirmar
    rec_planificacion: resource('course', 'Curso de planificación', 'planificacion_organizacion', ['coordinador_proyectos_salud', 'formador_corporativo'], { published: false }),
    rec_problemas: resource('reading', 'Lectura sobre resolución de problemas', 'resolucion_problemas', ['analista_operaciones'], { published: false }),
    rec_aprendizaje: resource('course', 'Curso de aprendizaje autónomo', 'aprendizaje_autonomo', ['estratega_contenidos'], { published: false }),
    rec_influencia: resource('reading', 'Lectura sobre influencia', 'influencia_liderazgo', ['exito_cliente'], { published: false }),
  };
  const withFlag = (group) => Object.fromEntries(Object.entries(group).map(([k, v]) => [k, { ...v, synthetic: true }]));
  return { contexts: withFlag(contexts), sources: withFlag(sources), roles: withFlag(roles), offers: withFlag(offers), resources: withFlag(resources) };
}

module.exports = { build };
