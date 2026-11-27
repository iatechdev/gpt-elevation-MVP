// ES-410 · Datos del archivo de EJEMPLO. Todo es FICTICIO: nombres, fuentes y direcciones (example.org es un dominio reservado,
// RFC 2606). Sirve solo para ver cómo se llena; el validador lo rechaza como catálogo real.
const DAY = '2026-11-20';
const F = 'EJEMPLO FICTICIO';

module.exports = {
  Contextos: [{ $key: 'ejemplo_contexto', 'labels.es': `${F}: contexto de muestra`, 'labels.en': 'FICTITIOUS EXAMPLE: sample context' }],
  Fuentes: [{
    $key: 'ejemplo_fuente', type: 'official', title: `${F}: documento que no existe`, url: 'https://example.org/fuente-ficticia', country: 'NO APLICA', language: 'es',
    consultedAt: DAY, consultedBy: 'Persona Ficticia', accessible: 'SI',
  }],
  Rutas: [{
    $key: 'ejemplo_ruta', 'labels.es': `${F}: rol de muestra`, 'labels.en': 'FICTITIOUS EXAMPLE: sample role', 'industry.es': `${F}: industria`, 'industry.en': 'FICTITIOUS EXAMPLE: industry',
    market: 'CO', languagesRequired: 'es; unknown', modality: 'hybrid; remote', contexts: 'ejemplo_contexto', sourceKeys: 'ejemplo_fuente', 'review.by': 'Persona Ficticia', 'review.at': DAY, 'regulated.isRegulated': 'NO',
  }],
  Tareas: [{ $parent: 'ejemplo_ruta', 'text.es': `${F}: tarea de muestra`, 'text.en': 'FICTITIOUS EXAMPLE: sample task', 'aiExposure.status': 'sourced', 'aiExposure.sourceKey': 'ejemplo_fuente' }],
  Barreras: [{ $parent: 'ejemplo_ruta', '$self.es': `${F}: barrera de muestra`, '$self.en': 'FICTITIOUS EXAMPLE: sample barrier' }],
  Capacidades: [{ $parent: 'ejemplo_ruta', skillKey: 'comunicacion', importance: 'essential' }],
  Ofertas: [{
    $key: 'ejemplo_oferta', title: `${F}: oferta que no existe`, organization: `${F}: organización`, roleKey: 'ejemplo_ruta', url: 'https://example.org/oferta-ficticia', market: 'CO', language: 'es', modality: 'hybrid',
    checkedAt: DAY, 'salary.published': 'NO', 'verification.by': 'Persona Ficticia', 'verification.at': DAY,
  }],
  Recursos: [{
    $key: 'ejemplo_recurso', kind: 'reading', title: `${F}: lectura que no existe`, url: 'https://example.org/recurso-ficticio', provider: `${F}: proveedor`, 'purpose.es': `${F}: para qué sirve`, 'purpose.en': 'FICTITIOUS EXAMPLE: purpose',
    language: 'es', level: 'introductory', 'duration.minutes': '30', 'price.published': 'NO', linkedSkillKey: 'comunicacion', 'exercise.es': `${F}: ejercicio`, 'exercise.en': 'FICTITIOUS EXAMPLE: exercise', roleKeys: 'ejemplo_ruta',
  }],
};
