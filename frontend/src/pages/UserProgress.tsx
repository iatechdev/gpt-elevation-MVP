// frontend/src/pages/UserProgress.tsx
// HU-052 + HU-060 — «Tu progreso». ES-173 (HU-P22): migrada a «Cartografía» (diseño aprobado en ES-173, comentario 11859). El panel (progress/ProgressPanel) y el
// emparejamiento (progress/ProgressMatching) viven en sus propios componentes; esta página solo lee GET /api/user/progress y reparte los estados (cargando, error con reintento, éxito).

import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../cartografia/controls'
import { Banner } from '../cartografia/pieces'
import { CartografiaRoot } from '../cartografia/theme'
import { LangSwitch } from '../shell/Frame'
import { useLanguage } from '../i18n/useLanguage'
import { ProgressMatching } from '../progress/ProgressMatching'
import { ProgressPanel, type MoodLog, type Recommendation, type SessionRating, type Stats } from '../progress/ProgressPanel'
import '../progress/progress.css'
import './progressCopy.ts' // ES-254: catálogo de textos de esta pantalla (carga perezosa)

const API = import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '')
const getToken = () => localStorage.getItem('elevation_token') || ''

export function UserProgress() {
  const { t } = useLanguage()

  const [stats,           setStats]           = useState<Stats | null>(null)
  const [moodLogs,        setMoodLogs]        = useState<MoodLog[]>([])
  const [ratings,         setRatings]         = useState<SessionRating[]>([])
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [loading,         setLoading]         = useState(true)
  const [failed,          setFailed]          = useState(false)
  const [attempt,         setAttempt]         = useState(0)
  const [matching,        setMatching]        = useState(false)
  const titleRef = useRef<HTMLHeadingElement>(null); const retryRef = useRef<HTMLButtonElement>(null)
  // E254-3: el foco se coloca DESPUÉS de renderizar: en «Reintentar» cuando aparece el error (primera lectura o reintento) y en el título tras recuperar (el botón se desmonta), nunca en body.
  useEffect(() => { if (loading) return; if (failed) retryRef.current?.focus(); else if (attempt > 0) titleRef.current?.focus() }, [attempt, loading, failed])

  useEffect(() => {
    let cancelled = false
    const fetchProgress = async () => {
      setLoading(true); setFailed(false)
      try {
        const res = await fetch(`${API}/api/user/progress`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        })
        if (!res.ok) throw new Error()
        const data = await res.json()
        if (cancelled) return
        setStats(data.stats)
        setMoodLogs(data.moodLogs ?? [])
        setRatings((data.ratings ?? []).filter((row: SessionRating) => typeof row.rating === 'number')) // una calificación vacía no se muestra como «1 de 5»
        setRecommendations(data.recommendations ?? [])
      } catch {
        if (!cancelled) setFailed(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void fetchProgress()
    return () => { cancelled = true }
  }, [attempt])

  return (
    <CartografiaRoot className="prg">
      <a className="cg-skip" href="#progress-main">{t('pr_skip')}</a>
      <header className="cg-header">
        <Link className="cg-btn cg-btn--ghost" to="/app/chat"><span aria-hidden="true">← </span>{t('pr_back')}</Link>
        <div className="cg-header__end"><LangSwitch /></div>
      </header>

      <main id="progress-main" className="cg-page prg-main" tabIndex={-1}>
        <div className="prg-head">
          <div>
            <h1 ref={titleRef} tabIndex={-1} className="cg-h1">{t('pr_title')}</h1>
            <p className="cg-muted">{t('pr_period')}</p>
            <p role="note" className="cg-muted cg-small">{t('pr_note')}</p>
          </div>
          {/* HU-060 — encontrar profesional (emparejamiento) */}
          <Button onClick={() => setMatching(true)}>{t('pr_find_pro')}</Button>
        </div>

        {loading && <p role="status" className="cg-muted">{t('pr_loading')}</p>}

        {!loading && failed && (
          <Banner kind="error" title={t('pr_error')}>
            <div className="cg-row"><button type="button" className="cg-btn" ref={retryRef} onClick={() => setAttempt(value => value + 1)}>{t('pr_retry')}</button></div>
          </Banner>
        )}

        {!loading && !failed && <ProgressPanel stats={stats} moodLogs={moodLogs} ratings={ratings} recommendations={recommendations} />}
      </main>

      <ProgressMatching open={matching} onClose={() => setMatching(false)} />
    </CartografiaRoot>
  )
}
