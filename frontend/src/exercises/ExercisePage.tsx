import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import catalog from '../../../shared/companion-exercises.json'
import { useLanguage } from '../i18n/useLanguage'
import { exercisesEnabled } from './publication'
import { registerExerciseGuard } from './navigationGuard'
import './exercises.css'

const readToken = () => { try { return localStorage.getItem('elevation_token') ?? '' } catch { return '' } }
export function ExercisePage() {
  const [token, setToken] = useState(readToken)
  useEffect(() => {
    const update = () => setToken(readToken())
    window.addEventListener('storage', update); window.addEventListener('focus', update)
    return () => { window.removeEventListener('storage', update); window.removeEventListener('focus', update) }
  }, [])
  return token ? <ExerciseSession key={token} token={token} /> : <Navigate to="/login" replace />
}
function ExerciseSession({ token }: { token: string }) {
  const { lang, setLang, t } = useLanguage(); const tr = (key: string) => t(`exercise.${key}`)
  const navigate = useNavigate(); const [params] = useSearchParams(); const origin = params.get('from') === 'chat' ? '/app/chat' : '/app/dashboard'
  const [active, setActive] = useState<string | null>(null); const [notes, setNotes] = useState(''); const [status, setStatus] = useState('')
  const [copying, setCopying] = useState(false); const [target, setTarget] = useState<'selector' | 'origin' | null>(null)
  const dialog = useRef<HTMLDialogElement>(null); const question = useRef<HTMLHeadingElement>(null); const live = useRef(false); const lock = useRef(false)
  const entry = catalog.exercises.find(item => item.key === active); const dirty = notes.length > 0
  useEffect(() => { live.current = true; return () => { live.current = false } }, [])
  useEffect(() => { if (entry) question.current?.focus() }, [entry])
  useEffect(() => {
    if (!dirty && !copying) return
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault() }
    window.addEventListener('beforeunload', unload)
    const unregister = registerExerciseGuard(() => copying || !window.confirm(t('exercise.leave')))
    return () => { window.removeEventListener('beforeunload', unload); unregister() }
  }, [dirty, copying, t])
  useEffect(() => { if (target) dialog.current?.showModal() }, [target])
  function finish(where: 'selector' | 'origin') {
    dialog.current?.close(); setTarget(null); setNotes(''); setActive(null); setStatus('closed')
    if (where === 'origin') navigate(origin)
  }
  function leave(where: 'selector' | 'origin') {
    if (lock.current) return
    if (dirty) setTarget(where); else finish(where)
  }
  async function copyNotes() {
    if (lock.current || !dirty || readToken() !== token) return
    lock.current = true; setCopying(true); setStatus('copying')
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(notes)
      if (live.current && readToken() === token) setStatus('copied')
    } catch { if (live.current && readToken() === token) setStatus('copy_error') }
    finally { lock.current = false; if (live.current && readToken() === token) setCopying(false) }
  }
  return <div className="exercise-scope"><a className="exercise-skip" href="#exercise-main">{tr('skip_content')}</a>
    <header><button className="elv-btn" disabled={copying} onClick={() => leave('origin')}>{tr('back')}</button><div role="group" aria-label={tr('language')}>{(['es', 'en'] as const).map(l => <button key={l} className="elv-btn" aria-pressed={lang === l} onClick={() => setLang(l)}>{l.toUpperCase()}</button>)}</div></header>
    <main id="exercise-main" tabIndex={-1}><h1>{tr('title')}</h1>
      {!exercisesEnabled ? <p>{tr('unavailable')}</p> : <>
        {catalog.reviewStatus === 'draft' && <p className="exercise-warning">{tr('review')}</p>}
        <p>{tr('intro')}</p><p role={status === 'copy_error' ? 'alert' : 'status'} aria-live="polite">{status && tr(status)}</p>
        {entry ? <section className="elv-card exercise-card"><h2>{entry[lang].title}</h2><p>{entry[lang].purpose}</p><p>{tr('time')}</p>
          <h3 ref={question} tabIndex={-1}>{entry[lang].question}</h3><p>{entry[lang].help}</p>
          <label className="exercise-control" htmlFor="exercise-notes">{tr('notes')}</label><textarea className="elv-textarea" id="exercise-notes" rows={10} value={notes} disabled={copying} aria-describedby="exercise-private" onChange={event => { setNotes(event.target.value); setStatus('') }} />
          <p id="exercise-private">{tr('private')}</p><p>{tr('clipboard')}</p>
          <div className="exercise-actions"><button className="elv-btn" disabled={!dirty || copying} onClick={() => void copyNotes()}>{tr('copy')}</button><button className="elv-btn exercise-primary" disabled={copying} onClick={() => leave('selector')}>{tr('close')}</button></div>
        </section> : <><div className="exercise-grid">{catalog.exercises.map(item => <article className="elv-card exercise-card" key={item.key}><h2>{item[lang].title}</h2><p>{item[lang].purpose}</p><p>{tr('time')}</p><button className="elv-btn" onClick={() => { setActive(item.key); setStatus('') }}>{tr('choose')}</button></article>)}</div><button className="elv-btn" onClick={() => leave('origin')}>{tr('skip')}</button></>}
      </>}
      <dialog ref={dialog} onClose={() => setTarget(null)} aria-labelledby="exercise-leave-title"><h2 id="exercise-leave-title">{tr('leave')}</h2><p>{tr('clipboard')}</p><p role="status">{status && tr(status)}</p><div className="exercise-actions"><button className="elv-btn" autoFocus onClick={() => dialog.current?.close()} disabled={copying}>{tr('return')}</button><button className="elv-btn" disabled={copying} onClick={() => void copyNotes()}>{tr('copy')}</button><button className="elv-btn exercise-primary" disabled={copying} onClick={() => { if (target) finish(target) }}>{tr('discard')}</button></div></dialog>
    </main>
  </div>
}
