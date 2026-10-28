// ES-32: cálculo puro sobre DTOs profesionales autorizados. Sin ORM, red, IA ni texto privado.
const MODALITIES = ['onsite', 'hybrid', 'remote'];
const RULE_VERSION = 1;
const words = (es, en) => ({ es, en });
const TEXT = Object.freeze({
  target_markets: words('Confirma el mercado objetivo.', 'Confirm your target market.'),
  languages: words('Confirma los idiomas de trabajo.', 'Confirm your working languages.'),
  modalities: words('Confirma las modalidades aceptables.', 'Confirm acceptable work arrangements.'),
  language_unknown: words('Idioma requerido por confirmar.', 'Required language needs confirmation.'),
  modality_unknown: words('Modalidad por confirmar.', 'Work arrangement needs confirmation.'),
  regulated: words('Habilitación pendiente de verificación.', 'Professional authorization pending verification.'),
  regulated_preference: words('Confirma si consideras profesiones reguladas.', 'Confirm whether you would consider regulated professions.'),
  source_stale: words('Verificar fuentes antiguas o inaccesibles.', 'Verify outdated or inaccessible sources.'),
  offer_expired: words('La oferta vencida no acredita una oportunidad actual.', 'An expired listing does not establish a current opportunity.'),
  skill_missing: words('Capacidad ausente del catálogo vigente.', 'Capability missing from the current catalog.'),
  no_evidence: words('Aún sin evidencia.', 'No evidence yet.'),
  insufficient_transfer: words('Evidencia insuficiente todavía para afirmar transferencia.', 'Insufficient evidence yet to establish transfer.'),
});
const issue = code => ({ code, text: TEXT[code] });
const copy = value => JSON.parse(JSON.stringify(value));
const compareKey = (a, b) => a < b ? -1 : a > b ? 1 : 0;

// Las pistas se conservan separadas. Una contradicción, rúbrica antigua o cita ausente no demuestra transferencia.
function tracksFor(skill) {
  if (!skill) return [];
  return ['self', 'review'].flatMap(track => {
    const value = skill[track];
    return value && Number.isInteger(value.level) && value.level >= 1 && value.level <= 4 &&
      value.evidenceCount > 0 && !value.stale && !value.catalogOutdated && !value.needsReview && value.state !== 'contradictory'
      ? [{ track, level: value.level, evidenceCount: value.evidenceCount }] : [];
  });
}

function calculateRoutes({ catalog, map, constraints }) {
  const result = { ruleVersion: RULE_VERSION, status: 'needs_constraints', catalogVersion: catalog.version,
    routes: [], discarded: { market: 0, language: 0, modality: 0, regulated: 0 }, clarifications: [], humanReview: { offered: false } };
  if (!constraints?.targetMarkets?.length) {
    result.clarifications.push(issue('target_markets'));
    return result;
  }
  if (!constraints.languages.length) result.clarifications.push(issue('languages'));
  if (!constraints.modalities.length) result.clarifications.push(issue('modalities'));
  const skills = new Map((map?.skills || []).map(skill => [skill.skillKey, skill]));
  const sourceByKey = new Map(catalog.sources.map(source => [source.sourceKey, source]));
  const candidates = [];
  for (const role of catalog.roles) {
    // Filtros duros antes de comparar capacidades; un desconocido jamás se transforma en coincidencia.
    if (!constraints.targetMarkets.includes(role.market)) { result.discarded.market++; continue; }
    const knownLanguages = role.languagesRequired.filter(language => language !== 'unknown');
    if (constraints.languages.length && knownLanguages.some(language => !constraints.languages.includes(language))) { result.discarded.language++; continue; }
    const knownModalities = role.modality.filter(modality => MODALITIES.includes(modality));
    if (constraints.modalities.length && knownModalities.length && !role.modality.includes('unknown') && !knownModalities.some(modality => constraints.modalities.includes(modality))) { result.discarded.modality++; continue; }
    if (role.regulated.isRegulated && constraints.acceptRegulated === 'no') { result.discarded.regulated++; continue; }

    const uniqueCapabilities = new Map();
    for (const capability of role.capabilities) {
      if (!uniqueCapabilities.has(capability.skillKey) || capability.importance === 'essential') uniqueCapabilities.set(capability.skillKey, capability);
    }
    const capabilities = [...uniqueCapabilities.values()].map(capability => {
      const tracks = tracksFor(skills.get(capability.skillKey));
      return { ...capability, skillMissing: !skills.has(capability.skillKey), tracks,
        status: tracks.length ? 'supported' : 'no_evidence', ...(tracks.length ? {} : { text: TEXT.no_evidence }) };
    });
    const essential = capabilities.filter(capability => capability.importance === 'essential');
    const demonstrated = essential.filter(capability => capability.tracks.length).length;
    const sources = role.sourceKeys.map(key => sourceByKey.get(key)).filter(Boolean);
    // Fuente ausente no autoriza un rol; la antigüedad se informa, no se disimula como confirmación actual.
    if (!sources.length) continue;
    const contextMatch = constraints.interestContextKeys.some(key => role.contexts.includes(key));
    const modalityMatch = constraints.preferredModalities.some(modality => knownModalities.includes(modality));
    const continuity = constraints.originContextKey !== null && role.contexts.includes(constraints.originContextKey);
    const uncertainties = [];
    if (!constraints.languages.length) uncertainties.push(issue('languages'));
    if (!constraints.modalities.length) uncertainties.push(issue('modalities'));
    if (role.languagesRequired.includes('unknown')) uncertainties.push(issue('language_unknown'));
    if (role.modality.includes('unknown')) uncertainties.push(issue('modality_unknown'));
    if (role.regulated.isRegulated) uncertainties.push(issue('regulated'));
    if (role.regulated.isRegulated && constraints.acceptRegulated === 'unknown') uncertainties.push(issue('regulated_preference'));
    if (sources.some(source => source.stale)) uncertainties.push(issue('source_stale'));
    if (capabilities.some(capability => capability.skillMissing)) uncertainties.push(issue('skill_missing'));
    const offers = catalog.offers.filter(offer => offer.roleKey === role.roleKey);
    if (offers.some(offer => offer.status !== 'current')) uncertainties.push(issue('offer_expired'));
    const gaps = new Set(capabilities.filter(capability => !capability.tracks.length).map(capability => capability.skillKey));
    // Selección explícita: no propagar nombres de revisores, justificaciones privadas ni propiedades desconocidas.
    const route = {
      roleKey: role.roleKey, labels: role.labels, industry: role.industry, market: role.market,
      tasks: role.tasks, barriers: role.barriers, languagesRequired: role.languagesRequired, modality: role.modality,
      regulated: { ...role.regulated, status: role.regulated.isRegulated ? 'pending' : 'not_regulated' },
      sources: sources.map(({ sourceKey, type, title, url, country, language, publishedAt, consultedAt, accessible, stale, synthetic }) =>
        ({ sourceKey, type, title, url, country, language, publishedAt, consultedAt, accessible, stale, ...(synthetic ? { synthetic: true } : {}) })),
      opportunityType: offers.some(offer => offer.status === 'current') ? 'has_current_listings' : 'occupational',
      offers: offers.map(({ offerKey, title, organization, url, market, language, modality, postedAt, checkedAt, salary, verifiedAt, status, synthetic }) =>
        ({ offerKey, title, organization, url, market, language, modality, postedAt, checkedAt, salary, verifiedAt, status, ...(synthetic ? { synthetic: true } : {}) })),
      resources: catalog.resources.filter(resource => resource.roleKeys.includes(role.roleKey) && gaps.has(resource.linkedSkillKey)),
      dimensions: {
        preferenceFit: { status: !constraints.interestContextKeys.length && !constraints.preferredModalities.length ? 'unknown' :
          (!constraints.interestContextKeys.length || contextMatch) && (!constraints.preferredModalities.length || modalityMatch) ? 'matches' : contextMatch || modalityMatch ? 'partial' : 'outside_interests', contextMatch, modalityMatch },
        demonstratedTransfer: { status: !essential.length ? 'unknown' : demonstrated === essential.length ? 'strong' : demonstrated ? 'partial' : 'none_yet', capabilities },
        viability: { status: sources.every(source => source.stale) ? 'unclear' : uncertainties.length || role.barriers.length ? 'conditional' : 'clear', barriers: role.barriers },
      },
      uncertainties, verificationTask: Boolean(uncertainties.length),
      ...(role.synthetic ? { synthetic: true } : {}),
    };
    const freshness = Math.max(...sources.map(source => Date.parse(source.consultedAt)).filter(Number.isFinite), 0);
    candidates.push({ route, continuity, demonstrated, preference: contextMatch || modalityMatch, freshness });
  }
  candidates.sort((a, b) => b.demonstrated - a.demonstrated || b.freshness - a.freshness || compareKey(a.route.roleKey, b.route.roleKey));
  const used = new Set();
  for (const slot of ['continuity', 'adjacency', 'exploration']) {
    const candidate = candidates.find(candidate => !used.has(candidate.route.roleKey) && (slot === 'continuity' ? candidate.continuity :
      slot === 'adjacency' ? !candidate.continuity && candidate.demonstrated > 0 : candidate.preference));
    if (!candidate) continue;
    used.add(candidate.route.roleKey);
    const route = copy(candidate.route);
    route.slot = slot;
    if (slot === 'exploration' && !candidate.demonstrated) route.uncertainties.push(issue('insufficient_transfer'));
    route.verificationTask ||= route.uncertainties.length > 0;
    result.routes.push(route);
  }
  result.status = result.routes.length === 3 ? 'ok' : result.routes.length ? 'partial' : 'no_pertinent_catalog';
  result.humanReview.offered = result.routes.length === 0;
  return result;
}

module.exports = { calculateRoutes, tracksFor, RULE_VERSION, MODALITIES };
