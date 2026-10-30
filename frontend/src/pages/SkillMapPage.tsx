import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage'
import { readSkillMap, SkillMapError, type MapFailure } from '../skill-map/api'
import { ConsentError, readBridgeStatus, revokeBridge, type BridgeStatus } from '../skill-map/consent'
import type { SkillMap } from '../skill-map/model'
import { MapGuide } from '../skill-map/MapAccess'
import { AiAnalysisPanel } from '../skill-map/AiAnalysisPanel'
import { RadarBoard } from '../skill-map/RadarView'
import { SkillDetail, TerritoryList, TerritoryMap, UnassignedCard } from '../skill-map/SkillViews'
import { noLevelAnywhere } from '../skill-map/status'
import { resolveTerritories, territories } from '../skill-map/territories'
import '../skill-map/skillMap.css'
import '../skill-map/radar.css'

const backend = import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '')
const readToken = () => { try { return localStorage.getItem('elevation_token') ?? '' } catch { return '' } }
type PageState = { status: 'loading' } | { status: 'ready'; map: SkillMap; token: string } | { status: 'error'; reason: MapFailure }
type Revoke = 'idle' | 'confirm' | 'saving' | 'done' | 'error' | 'expired'

export function SkillMapPage() {
  const { t, lang, setLang } = useLanguage()
  const [state, setState] = useState<PageState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [listView, setListView] = useState(false)
  const [view, setView] = useState<'radar' | 'territories'>('radar')
  const [ai, setAi] = useState<string[] | null>(null)
  const aiRef = useRef<HTMLDivElement>(null)
  const [bridge, setBridge] = useState<BridgeStatus | 'loading'>('loading')
  const [revoke, setRevoke] = useState<Revoke>('idle')
  const [saved, setSaved] = useState('')
  const errorRef = useRef<HTMLDivElement>(null)
  const detailRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const revokeButton = useRef<HTMLButtonElement>(null)
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
    void readBridgeStatus({ baseUrl: backend, token, signal: controller.signal }).then(setBridge).catch(() => { if (!controller.signal.aborted) setBridge('unknown') })
    return () => controller.abort()
  }, [attempt])
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.key === 'elevation_token' || event.key === null) {
        setState({ status: 'loading' }); setSelected(null); setBridge('loading'); setRevoke('idle')
        setAttempt(value => value + 1)
      }
    }
    window.addEventListener('storage', changed)
    return () => window.removeEventListener('storage', changed)
  }, [])
  useEffect(() => { if (state.status === 'error') errorRef.current?.focus() }, [state.status])
  useEffect(() => {
    const dialog = dialogRef.current; if (!dialog) return
    if (revoke === 'confirm' || revoke === 'saving') { if (!dialog.open) dialog.showModal() } else if (dialog.open) dialog.close()
  }, [revoke])
  const refresh = () => { setState({ status: 'loading' }); setSelected(null); setBridge('loading'); setRevoke('idle'); setAttempt(value => value + 1) }
  const pick = (key: string) => {
    setSelected(key); setSaved('')
    window.setTimeout(() => detailRef.current?.scrollIntoView({ block: 'nearest', behavior: 'auto' }), 0)
  }
  const register = (key: string) => { pick(key); window.setTimeout(() => detailRef.current?.focus(), 0) }
  const openAi = (keys: string[]) => { setAi(keys); window.setTimeout(() => aiRef.current?.scrollIntoView({ block: 'nearest', behavior: 'auto' }), 0) }
  // Se vuelve a leer el mapa SIN pasar por «cargando» tras guardar propuestas de la IA (para no desmontar el panel con el resultado) y tras «Revocar todos» (QA H-86-03).
  const reloadMap = async () => {
    const token = readToken(); if (!token) return
    try { const next = await readSkillMap({ baseUrl: backend, token }); if (readToken() === token) setState({ status: 'ready', map: next, token }) } catch { /* el siguiente «Actualizar mapa» lo reintenta */ }
  }
  const close = () => { setRevoke('idle'); window.setTimeout(() => revokeButton.current?.focus(), 0) }
  const confirm = async () => {
    setRevoke('saving')
    try { await revokeBridge({ baseUrl: backend, token: readToken() }); setBridge('revoked'); setRevoke('done'); void reloadMap() }
    catch (error) { setRevoke(error instanceof ConsentError && error.reason === 'expired' ? 'expired' : 'error') }
    window.setTimeout(() => revokeButton.current?.focus(), 0)
  }
  // Never paint a response belonging to a token that has since changed.
  const map = state.status === 'ready' && state.token === readToken() ? state.map : null
  const error = state.status === 'error' ? state.reason : state.status === 'ready' && !map ? 'expired' : null
  const skill = map?.skills.find(item => item.skillKey === selected) ?? null
  // H-86-02: sin ninguna capacidad con territorio no se dibujan cinco recuadros vacíos: se muestra el aviso y la lista.
  const noTerritories = !!map && map.skills.length > 0 && resolveTerritories(map.skills, territories).groups.every(group => group.skills.length === 0)
  const nothingToRevoke = bridge === 'revoked' || bridge === 'undecided'
  const message = revoke === 'done' ? t('skill_map.revoke_done') : revoke === 'error' ? t('skill_map.revoke_error') : revoke === 'expired' ? t('skill_map.expired')
    : nothingToRevoke ? t('skill_map.revoke_none') : ''
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
      <div className="skill-map-title">
        <div>
          <p className="skill-map-eyebrow">{t('skill_map.eyebrow')}</p>
          <h1>{t('skill_map.title')}</h1>
          <p className="skill-map-intro">{t('skill_map.intro')}</p>
        </div>
        <div className="skill-map-tools">
          <div className="skill-map-views" role="group" aria-label={t('skill_map.views')}>
            <button type="button" aria-pressed={view === 'radar'} onClick={() => setView('radar')}>{t('skill_map.view_radar')}</button>
            <button type="button" aria-pressed={view === 'territories'} onClick={() => setView('territories')}>{t('skill_map.view_territories')}</button>
          </div>
          {view === 'territories' && <>
            <ul className="skill-map-legend" aria-label={t('skill_map.legend')}>
              <li><span className="skill-map-dot dot-level" aria-hidden="true" />{t('skill_map.status_evidence')}</li>
              <li><span className="skill-map-dot dot-none" aria-hidden="true" />{t('skill_map.no_evidence')}</li>
            </ul>
            {!noTerritories && <button type="button" className="elv-btn skill-map-view-toggle" aria-pressed={listView} onClick={() => setListView(value => !value)}>
              {t(listView ? 'skill_map.view_map' : 'skill_map.view_list')}
            </button>}
          </>}
          <button type="button" className="elv-btn" ref={revokeButton} onClick={() => setRevoke('confirm')}
            disabled={bridge === 'loading' || nothingToRevoke || revoke === 'saving'}>{t('skill_map.revoke_all')}</button>
          <button type="button" className="elv-btn" onClick={refresh} disabled={state.status === 'loading'}>{t('skill_map.refresh')}</button>
        </div>
      </div>
      <p className="skill-map-reading">{t(view === 'radar' ? 'skill_map.radar_reading' : 'skill_map.reading')}</p>
      <p role="status" aria-live="polite" className="skill-map-revoke-status">{message}</p>
      {state.status === 'loading' && <p role="status" aria-live="polite">{t('skill_map.loading')}</p>}
      {error && <div ref={errorRef} tabIndex={-1} role="alert" className="skill-map-error">
        <p>{t(`skill_map.${error}`)}</p>
        {error === 'expired' ? <Link className="elv-link" to="/login">{t('skill_map.signin')}</Link>
          : error !== 'forbidden' && <button type="button" className="elv-btn" onClick={refresh}>{t('skill_map.retry')}</button>}
      </div>}
      {map && <>
        <p role="status" className="skill-map-catalog">{t('skill_map.catalog')}: {map.catalogVersion}</p>
        {map.skills.length === 0 ? <p role="status">{t('skill_map.empty')}</p> : <>
          {noLevelAnywhere(map.skills) && <MapGuide />}
          {view === 'radar' ? <RadarBoard skills={map.skills} selected={selected} onSelect={pick} onRegister={register} onAnalyze={() => openAi(map.skills.slice(0, 8).map(item => item.skillKey))} lang={lang} t={t} />
            : <>
              {noTerritories && <p role="status" className="skill-map-note skill-map-no-territories">{t('skill_map.no_territories')}</p>}
              <div className={`skill-map-board${listView || noTerritories ? ' is-list' : ''}`}>
                <div className="skill-map-canvas">
                  <TerritoryMap skills={map.skills} territories={territories} selected={selected} onSelect={pick} lang={lang} t={t} />
                </div>
                <TerritoryList skills={map.skills} territories={territories} selected={selected} onSelect={pick} lang={lang} t={t} />
              </div>
              {!noTerritories && <UnassignedCard skills={map.skills} territories={territories} selected={selected} onSelect={pick} lang={lang} t={t} />}
            </>}
          {ai && state.status === 'ready' && <div ref={aiRef}><AiAnalysisPanel skills={map.skills} initialKeys={ai} lang={lang} t={t} backend={backend} token={state.token}
            onSaved={reloadMap} onClose={() => setAi(null)} /></div>}
          <div ref={detailRef} tabIndex={-1} className="skill-map-detail-wrap" aria-live="polite">
            {skill ? <>{saved && <p role="status" className="skill-map-notice">{saved}</p>}<SkillDetail skill={skill} catalogVersion={map.catalogVersion} territories={territories} lang={lang} t={t} onAnalyze={key => openAi([key])}
              self={{ backend, token: state.status === 'ready' ? state.token : '', onChanged: kind => { setSaved(t(kind === 'saved' ? 'skill_map.reg_saved' : 'skill_map.reg_retired')); setAttempt(value => value + 1) } }} /></>
              : <p className="skill-map-note">{t('skill_map.select_hint')}</p>}
          </div>
          <p className="skill-map-note">{t('skill_map.revoke_scope')}</p>
        </>}
      </>}
    </main>
    <dialog ref={dialogRef} className="skill-map-dialog" aria-labelledby="skill-map-revoke-title" onCancel={event => { event.preventDefault(); if (revoke !== 'saving') close() }}>
      <h2 id="skill-map-revoke-title">{t('skill_map.revoke_title')}</h2>
      <p>{t('skill_map.revoke_body')}</p>
      <div className="skill-map-dialog-actions">
        <button type="button" className="elv-btn" autoFocus onClick={close} disabled={revoke === 'saving'}>{t('skill_map.revoke_cancel')}</button>
        <button type="button" className="elv-btn skill-map-danger" onClick={() => void confirm()} disabled={revoke === 'saving'}>
          {revoke === 'saving' ? t('skill_map.revoke_saving') : t('skill_map.revoke_confirm')}
        </button>
      </div>
    </dialog>
  </div>
}
