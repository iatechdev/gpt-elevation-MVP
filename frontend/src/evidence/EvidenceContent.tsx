import { useLanguage } from '../i18n/useLanguage'
import type { Payload, Claim } from './model'
export function EvidenceContent({ payload }: { payload: Payload }) {
  const { t } = useLanguage()
  const l = (key: string) => t(`evidence.${key}`)
  const showClaim = (value?: Claim) => value ? <><p>{value.text}</p><small>{l('provenance')}: {l(value.source)}</small></> : <p>{l('not_indicated')}</p>
  return <div className="evidence-content">
    <div><h3>{l('field_title')}</h3><p>{payload.title}</p></div>
    <div><h3>{l('situation')}</h3><p>{payload.situation || l('not_indicated')}</p></div>
    <div><h3>{l('responsibility')}</h3>{showClaim(payload.responsibility)}</div>
    <div><h3>{l('actions')}</h3>{payload.actions?.length ? <ul>{payload.actions.map((value, i) => <li key={i}>{showClaim(value)}</li>)}</ul> : <p>{l('not_indicated')}</p>}</div>
    <div><h3>{l('alternatives')}</h3>{payload.alternatives?.length ? <ul>{payload.alternatives.map((value, i) => <li key={i}>{value}</li>)}</ul> : <p>{l('not_indicated')}</p>}</div>
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3 evidence-comparison">
      <div><h3>{l('goal')}</h3><p>{payload.goal || l('not_indicated')}</p></div>
      <div><h3>{l('delivered')}</h3>{showClaim(payload.delivered)}</div>
      <div><h3>{l('observedEffect')}</h3>{payload.observedEffect ? payload.observedEffect.known ? showClaim(payload.observedEffect.claim) : <p>{l('unknown')}</p> : <p>{l('not_indicated')}</p>}</div>
    </div>
    <div><h3>{l('learning')}</h3><p>{payload.learning || l('not_indicated')}</p></div>
    <div><h3>{l('autonomy')}</h3><p>{l(payload.autonomy || 'unset')}</p><small>{l('autonomy_help')}</small></div>
    <div><h3>{l('artifactRefs')}</h3><p>{l('sample_help')}</p>
      {payload.artifactRefs?.length ? <ul>{payload.artifactRefs.map((ref, i) => <li key={i}>{ref.kind === 'url' ? <>{ref.url}{ref.note && <p>{ref.note}</p>}</> : ref.excerpt}</li>)}</ul> : <p>{l('no_sample')}</p>}
    </div>
  </div>
}
