// Exclusivamente sintético. No representa a las seis personas ni un catálogo real.
function fixture() {
  const label = key => ({ es: `[SINTÉTICO] ${key}`, en: `[SYNTHETIC] ${key}` });
  const role = (roleKey, context, capability) => ({ roleKey, labels: label(roleKey), industry: label('industry'), market: 'CO',
    languagesRequired: ['es'], modality: ['remote'], contexts: [context], sourceKeys: ['source'], tasks: [], barriers: [],
    capabilities: [{ skillKey: capability, importance: 'essential' }], regulated: { isRegulated: false }, synthetic: true });
  return {
    catalog: { version: 1, contexts: ['education', 'operations', 'finance'].map(contextKey => ({ contextKey })),
      roles: [role('teacher', 'education', 'communication'), role('operations', 'operations', 'communication'), role('finance', 'finance', 'analysis')],
      sources: [{ sourceKey: 'source', type: 'official', url: 'https://example.org/synthetic', title: 'Synthetic source', consultedAt: '2026-10-28', accessible: true, stale: false, consultedBy: 'CANARY_PRIVATE_REVIEWER', synthetic: true }], offers: [], resources: [] },
    map: { catalogVersion: 1, skills: [{ skillKey: 'communication', self: { level: 3, state: 'initial', stale: false, evidenceCount: 1, rationale: 'CANARY_PRIVATE_RATIONALE' }, review: null }, { skillKey: 'analysis', self: null, review: null }] },
    constraints: { targetMarkets: ['CO'], languages: ['es'], modalities: ['remote'], acceptRegulated: 'unknown', originContextKey: 'education', interestContextKeys: ['finance'], preferredModalities: [] },
  };
}
module.exports = { fixture };
