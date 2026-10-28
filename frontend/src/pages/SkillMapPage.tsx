import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage'
import { readSkillMap, SkillMapError, type MapFailure } from '../skill-map/api'
import { trackView, type Assessment, type LocalizedText, type SkillMap } from '../skill-map/model'
import '../skill-map/skillMap.css'

const backend = import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '')
const readToken = () => { try { return localStorage.getItem('elevation_token') ?? '' } catch { return '' } }
type PageState = { status: 'loading' } | { status: 'ready'; map: SkillMap; token: string } | { status: 'error'; reason: MapFailure }

function AssessmentPanel({ assessment, track }: { assessment: Assessment | null; track: 'self' | 'review' }) {
  const { t, lang } = useLanguage()
  const view = trackView(assessment)
  const next = view.stale || assessment?.catalogOutdated ? 'next_stale' : view.needsReview ? 'contradictory' : view.level === null ? 'next_empty' : 'next_current'
  return <section className="skill-map-track" aria-label={t(`skill_map.${track}`)}>
    <h3>{t(`skill_map.${track}`)}</h3>
    {track === 'review' && !assessment ? <p>{t('skill_map.no_review')}</p> : <>
      <p className="skill-map-level" data-testid="skill-level">
        {view.level === null ? t('skill_map.no_evidence') : `${t('skill_map.level')} ${view.level}`}
      </p>
      {view.state !== 'no_evidence' && <span className="elv-badge elv-badge-outline">{t(`skill_map.${view.state}`)}</span>}
      {view.stale && <p className="skill-map-warning">{t('skill_map.stale_help')}</p>}
      {assessment?.catalogOutdated && <p className="skill-map-warning">{t('skill_map.catalog_outdated')} {view.level !== null && t('skill_map.previous_rubric')}</p>}
      {assessment && !view.stale && <>
        <p>{t('skill_map.evidence_count')}: {assessment.evidenceCount}</p>
        <p className="skill-map-note">{t('skill_map.evidence_detail_unavailable')}</p>
        {view.confidence && <>
          <p>{t('skill_map.confidence')}: {t(`skill_map.${view.confidence}`)}</p>
          <p>{assessment.confidenceReason[lang] ?? t('skill_map.translation_missing')}</p>
        </>}
        <h4>{t('skill_map.rationale')}</h4>
        <p className="skill-map-free-text">{assessment.rationale || t('skill_map.no_rationale')}</p>
      </>}
      <p className="skill-map-next"><strong>{t('skill_map.next')}: </strong>{t(`skill_map.${next}`)}</p>
      {view.needsReview && <p className="skill-map-note">{t('skill_map.review_unavailable')}</p>}
    </>}
  </section>
}

export function SkillMapPage() {
  const { t, lang, setLang } = useLanguage()
  const [state, setState] = useState<PageState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const errorRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const controller = new AbortController()
    const token = readToken()
    void readSkillMap({ baseUrl: backend, token, signal: controller.signal }).then(map => {
      if (controller.signal.aborted) return
      if (readToken() !== token) { setState({ status: 'error', reason: 'expired' }); return }
      setState({ status: 'ready', map, token })
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setState({ status: 'error', reason: error instanceof SkillMapError ? error.reason : 'load_error' })
    })
    return () => controller.abort()
  }, [attempt])
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.key === 'elevation_token' || event.key === null) {
        setState({ status: 'loading' })
        setAttempt(value => value + 1)
      }
    }
    window.addEventListener('storage', changed)
    return () => window.removeEventListener('storage', changed)
  }, [])
  useEffect(() => { if (state.status === 'error') errorRef.current?.focus() }, [state.status])
  const refresh = () => { setState({ status: 'loading' }); setAttempt(value => value + 1) }
  const localized = (value: LocalizedText) => value[lang] ?? t('skill_map.translation_missing')
  // Never paint a response belonging to a token that has since changed.
  const map = state.status === 'ready' && state.token === readToken() ? state.map : null
  const error = state.status === 'error' ? state.reason : state.status === 'ready' && !map ? 'expired' : null
  return <div className="skill-map-scope">
    <a href="#skill-map-main" className="skill-map-skip elv-link">{t('skill_map.skip')}</a>
    <header className="skill-map-header">
      <span>{t('logo')}</span>
      <div className="elv-join" role="group" aria-label={t('skill_map.language')}>
        {(['es', 'en'] as const).map(language => <button key={language} type="button"
          className="elv-btn elv-btn-ghost elv-join-item" aria-pressed={lang === language} onClick={() => setLang(language)}>
          {language.toUpperCase()}
        </button>)}
      </div>
    </header>
    <main id="skill-map-main" tabIndex={-1} className="skill-map-main">
      <Link to="/app/dashboard" className="elv-link skill-map-back">{t('skill_map.back')}</Link>
      <div className="skill-map-title"><h1>{t('skill_map.title')}</h1>
        <button type="button" className="elv-btn" onClick={refresh} disabled={state.status === 'loading'}>{t('skill_map.refresh')}</button>
      </div>
      <p className="skill-map-intro">{t('skill_map.intro')}</p>
      {state.status === 'loading' && <p role="status" aria-live="polite">{t('skill_map.loading')}</p>}
      {error && <div ref={errorRef} tabIndex={-1} role="alert" className="skill-map-error">
        <p>{t(`skill_map.${error}`)}</p>
        {error === 'expired' ? <Link className="elv-link" to="/login">{t('skill_map.signin')}</Link>
          : error !== 'forbidden' && <button type="button" className="elv-btn" onClick={refresh}>{t('skill_map.retry')}</button>}
      </div>}
      {map && <>
        <p role="status" className="skill-map-catalog">{t('skill_map.catalog')}: {map.catalogVersion}</p>
        {map.skills.length === 0 ? <p role="status">{t('skill_map.empty')}</p>
          : <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 skill-map-grid">
            {map.skills.map(skill => <article key={skill.skillKey} className="elv-card skill-map-card">
              <div className="elv-card-body">
                <h2 className="elv-card-title">{localized(skill.labels)}</h2>
                <span className="elv-badge elv-badge-outline skill-map-type">{t(`skill_map.${skill.type}`)}</span>
                <AssessmentPanel assessment={skill.self} track="self" />
                <AssessmentPanel assessment={skill.review} track="review" />
                <details className="skill-map-rubric">
                  <summary>{t('skill_map.rubric')} · {map.catalogVersion}</summary>
                  <ol>
                    {[1, 2, 3, 4].map(level => <li key={level}><strong>{t('skill_map.level')} {level}: </strong>{localized(skill.rubric.levels[String(level)])}</li>)}
                  </ol>
                  <p className="skill-map-free-text">{t('skill_map.source')}: {skill.rubric.source}</p>
                  <p>{t('skill_map.verified')}: <time dateTime={skill.rubric.verifiedAt}>{skill.rubric.verifiedAt}</time></p>
                </details>
              </div>
            </article>)}
          </div>}
      </>}
    </main>
  </div>
}
