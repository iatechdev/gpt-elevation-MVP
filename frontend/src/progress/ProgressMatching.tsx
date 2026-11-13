// ES-173 (HU-P22, D1): el emparejamiento (HU-060) de /app/progress, extraído de UserProgress.tsx y restilizado con Cartografía SIN cambiar su contrato con el servidor:
// POST /api/matching/request { answers: { area, style, language } } y POST /api/matching/choose { requestId, therapistId }. Los valores enviados son los mismos de antes
// (solo cambia la etiqueta visible); las etiquetas salen del catálogo ES/EN. Lo que responde el servidor (nombre y motivo) se muestra como TEXTO.
import { useEffect, useRef, useState } from 'react'
import { Button, SelectField } from '../cartografia/controls'
import { Banner, ItemList } from '../cartografia/pieces'
import { Dialog } from '../cartografia/interactive'
import { useLanguage } from '../i18n/useLanguage'
import '../pages/progressCopy.ts'

const API = import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '')
const getToken = () => localStorage.getItem('elevation_token') || ''

interface Suggestion { therapistId: number; therapistName: string; reason: string }
type Step = 'questionnaire' | 'results' | 'done'
type Answers = { area: string; style: string; language: string }
const EMPTY: Answers = { area: '', style: '', language: '' }

// [valor enviado al servidor, clave del texto visible]. La clave interna 'anxiety' NO cambia: solo su etiqueta («Estrés y carga»).
const AREAS: [string, string][] = [['anxiety', 'pr_a_anxiety'], ['depression', 'pr_a_depression'], ['relationships', 'pr_a_relationships'], ['personal growth', 'pr_a_growth'], ['stress', 'pr_a_stress'], ['other', 'pr_a_other']]
const STYLES: [string, string][] = [['reflective and exploratory', 'pr_s_reflective'], ['structured with goals', 'pr_s_structured'], ['empathetic and listening', 'pr_s_empathetic'], ['any', 'pr_s_any']]
const LANGUAGES: [string, string][] = [['Spanish', 'pr_l_es'], ['English', 'pr_l_en'], ['No preference', 'pr_l_none']]

export function ProgressMatching({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLanguage()
  const [step, setStep] = useState<Step>('questionnaire')
  const [answers, setAnswers] = useState<Answers>(EMPTY)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [requestId, setRequestId] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<'pr_m_error' | 'pr_m_conn' | ''>('')
  const lock = useRef(false)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])

  const close = () => { setStep('questionnaire'); setAnswers(EMPTY); setSuggestions([]); setRequestId(null); setError(''); onClose() }
  const complete = answers.area !== '' && answers.style !== '' && answers.language !== ''

  async function search() {
    if (lock.current || !complete) return
    lock.current = true; setBusy(true); setError('')
    try {
      const res = await fetch(`${API}/api/matching/request`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }, body: JSON.stringify({ answers }) })
      if (!alive.current) return
      if (!res.ok) { setError('pr_m_error'); return }
      const data = await res.json()
      if (!alive.current) return
      setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []); setRequestId(data.requestId); setStep('results')
    } catch { if (alive.current) setError('pr_m_conn') }
    finally { lock.current = false; if (alive.current) setBusy(false) }
  }

  async function choose(therapistId: number) {
    if (lock.current || !requestId) return
    lock.current = true; setBusy(true); setError('')
    try {
      const res = await fetch(`${API}/api/matching/choose`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }, body: JSON.stringify({ requestId, therapistId }) })
      if (!alive.current) return
      if (!res.ok) { setError('pr_m_error'); return }
      setStep('done')
    } catch { if (alive.current) setError('pr_m_conn') }
    finally { lock.current = false; if (alive.current) setBusy(false) }
  }

  const options = (rows: [string, string][]) => rows.map(([value, key]) => <option key={value} value={value}>{t(key)}</option>)
  const title = step === 'questionnaire' ? t('pr_m_title_q') : step === 'results' ? t('pr_m_title_r') : t('pr_m_title_ok')

  let body
  let actions
  if (step === 'questionnaire') {
    body = (
      <div className="prg-form">
        <SelectField label={t('pr_m_area')} value={answers.area} onChange={event => setAnswers(previous => ({ ...previous, area: event.target.value }))}><option value="">{t('pr_m_select')}</option>{options(AREAS)}</SelectField>
        <SelectField label={t('pr_m_style')} value={answers.style} onChange={event => setAnswers(previous => ({ ...previous, style: event.target.value }))}><option value="">{t('pr_m_select')}</option>{options(STYLES)}</SelectField>
        <SelectField label={t('pr_m_lang')} value={answers.language} onChange={event => setAnswers(previous => ({ ...previous, language: event.target.value }))}><option value="">{t('pr_m_select')}</option>{options(LANGUAGES)}</SelectField>
      </div>
    )
    actions = <><Button variant="ghost" onClick={close}>{t('pr_m_close')}</Button><Button disabled={busy || !complete} onClick={() => void search()}>{busy ? t('pr_m_searching') : t('pr_m_search')}</Button></>
  } else if (step === 'results') {
    body = (
      <>
        <p className="cg-muted">{t('pr_m_intro')}</p>
        <ItemList items={suggestions.map(item => {
          const top = <strong>{item.therapistName}</strong>
          const detail = <><p className="cg-muted">{item.reason}</p><div className="cg-row"><Button disabled={busy} onClick={() => void choose(item.therapistId)}>{t('pr_m_choose')}</Button></div></>
          return { id: String(item.therapistId), top, body: detail }
        })} />
      </>
    )
    actions = <><Button variant="ghost" disabled={busy} onClick={() => { setError(''); setStep('questionnaire') }}>{t('pr_m_back')}</Button><Button variant="ghost" onClick={close}>{t('pr_m_close')}</Button></>
  } else {
    body = <p role="status">{t('pr_m_done')}</p>
    actions = <Button onClick={close}>{t('pr_m_close')}</Button>
  }
  return (
    <Dialog open={open} onClose={close} title={title} actions={actions}>
      {error && <Banner kind="error" title={t(error)} />}
      {body}
    </Dialog>
  )
}
