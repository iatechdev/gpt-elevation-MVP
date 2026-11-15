import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage'
import { Button, Dialog, TextAreaField } from '../cartografia'
import { Notice, PersonScreen } from '../space/PersonScreen'
import { registerExerciseGuard } from './navigationGuard'
import { parseExercise, parseExercises, type Exercise } from './model'
import './exercises.css'

// ES-170: los ejercicios salen del servidor (GET /api/exercises: SOLO los publicados; un borrador, un retirado o una clave inexistente dan el mismo 404). Ya no se lee un archivo empaquetado en el build
// ni se exige una bandera: el contenido real se crea y se publica desde la aplicación (decisión 7 del PO, ES-194).
const API = import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '')
const readToken = () => { try { return localStorage.getItem('elevation_token') ?? '' } catch { return '' } }
const fill = (text: string, values: Record<string, string | number>) => Object.entries(values).reduce((out, [key, value]) => out.replace(`{${key}}`, String(value)), text)
type Phase = 'loading' | 'ready' | 'error' | 'session'
async function request(path: string, token: string): Promise<{ status: number; body: unknown }> {
  const response = await fetch(`${API.replace(/\/$/, '')}/api/exercises${path}`, { cache: 'no-store', signal: AbortSignal.timeout(15000), headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } })
  return { status: response.status, body: await response.json().catch(() => null) }
}

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
  const { lang, t } = useLanguage(); const tr = (key: string) => t(`exercise.${key}`)
  const navigate = useNavigate(); const [params] = useSearchParams(); const origin = params.get('from') === 'chat' ? '/app/chat' : '/app/dashboard'
  const [list, setList] = useState<Exercise[]>([]); const [phase, setPhase] = useState<Phase>('loading'); const [attempt, setAttempt] = useState(0)
  const [active, setActive] = useState<Exercise | null>(null); const [gone, setGone] = useState(false); const [opening, setOpening] = useState(false)
  const [notes, setNotes] = useState(''); const [status, setStatus] = useState('')
  const [copying, setCopying] = useState(false); const [target, setTarget] = useState<'selector' | 'origin' | null>(null)
  const question = useRef<HTMLHeadingElement>(null); const retryButton = useRef<HTMLButtonElement>(null)
  const live = useRef(false); const lock = useRef(false)
  const entry = active; const dirty = notes.length > 0
  useEffect(() => { live.current = true; return () => { live.current = false } }, [])
  useEffect(() => {
    let cancelled = false
    setPhase('loading')
    void request('', token).then(({ status: code, body }) => {
      if (cancelled || !live.current) return
      if (code === 401) { setPhase('session'); return }
      const rows = code === 200 ? parseExercises(body) : null
      if (!rows) { setPhase('error'); return }
      setList(rows); setPhase('ready')
    }).catch(() => { if (!cancelled && live.current) setPhase('error') })
    return () => { cancelled = true }
  }, [token, attempt])
  // Foco después de renderizar: «Reintentar» cuando aparece el error; el título del ejercicio al abrirlo; el aviso «ya no está disponible».
  useEffect(() => { if (phase === 'error') retryButton.current?.focus() }, [phase])
  useEffect(() => { if (entry) question.current?.focus() }, [entry])
  useEffect(() => { if (gone) document.getElementById('exercise-main')?.focus() }, [gone])
  useEffect(() => {
    if (!dirty && !copying) return
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault() }
    window.addEventListener('beforeunload', unload)
    const unregister = registerExerciseGuard(() => copying || !window.confirm(t('exercise.leave')))
    return () => { window.removeEventListener('beforeunload', unload); unregister() }
  }, [dirty, copying, t])
  // Abrir un ejercicio vuelve a pedirlo por clave: si entre tanto se retiró (404), se dice y se refresca la lista.
  const open = useCallback(async (key: string) => {
    if (opening) return
    setOpening(true); setStatus(''); setGone(false)
    try {
      const { status: code, body } = await request(`/${encodeURIComponent(key)}`, token)
      if (!live.current) return
      if (code === 401) { setPhase('session'); return }
      const row = code === 200 ? parseExercise(body) : null
      if (row) { setActive(row); return }
      if (code === 404) { setGone(true); setAttempt(value => value + 1); return }
      setPhase('error')
    } catch { if (live.current) setPhase('error') } finally { if (live.current) setOpening(false) }
  }, [opening, token])
  function finish(where: 'selector' | 'origin') {
    setTarget(null); setNotes(''); setActive(null); setStatus('closed')
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
  const time = (item: Exercise) => item.minutes === null ? null : <p>{fill(tr('time_range'), { a: item.minutes[0], b: item.minutes[1] })}</p>
  const review = (item: Exercise) => item.reviewStatus !== 'done' && <p className="exercise-warning">{tr('review')}</p>
  if (phase === 'session') return <Navigate to="/login" replace />
  // ES-307: Cartografía (PersonScreen, cg-card, Button, TextAreaField, Notice y Dialog). El marco de persona ya pone idioma y «Saltar al contenido»; aquí queda «Volver».
  const body = phase === 'loading' ? <Notice text={tr('loading')} />
    : phase === 'error' ? <div role="alert" className="cg-banner cg-banner--error"><p className="cg-banner__title">{tr('load_error')}</p><Button ref={retryButton} variant="ghost" onClick={() => setAttempt(value => value + 1)}>{tr('retry')}</Button></div>
      : <>
        {gone && <Notice error text={tr('gone')} />}
        <Notice error={status === 'copy_error'} text={status ? tr(status) : ''} />
        {entry ? <section className="cg-card pg-card"><h2>{entry[lang].title}</h2>{review(entry)}<p>{entry[lang].purpose}</p>{time(entry)}
          <h3 ref={question} tabIndex={-1}>{entry[lang].question}</h3><p>{entry[lang].help}</p>
          <TextAreaField label={tr('notes')} id="exercise-notes" rows={10} value={notes} disabled={copying} aria-describedby="exercise-private" onChange={event => { setNotes(event.target.value); setStatus('') }} />
          <p id="exercise-private">{tr('private')}</p><p>{tr('clipboard')}</p>
          <div className="pg-actions"><Button variant="ghost" disabled={!dirty || copying} onClick={() => void copyNotes()}>{tr('copy')}</Button><Button disabled={copying} onClick={() => leave('selector')}>{tr('close')}</Button></div>
        </section> : list.length === 0 ? <Notice text={tr('empty')} />
          : <div className="pg-grid">{list.map(item => <article className="cg-card pg-card" key={item.key}><h2>{item[lang].title}</h2>{review(item)}<p>{item[lang].purpose}</p>{time(item)}<Button disabled={opening} onClick={() => void open(item.key)}>{tr('choose')}</Button></article>)}</div>}
        {!entry && <div className="pg-actions"><Button variant="ghost" onClick={() => leave('origin')}>{tr('skip')}</Button></div>}
      </>
  return <PersonScreen title={tr('title')} lead={phase === 'ready' ? tr('intro') : undefined} wide>
    <div className="pg-actions"><Button variant="ghost" disabled={copying} onClick={() => leave('origin')}>{tr('back')}</Button></div>
    <div id="exercise-main" tabIndex={-1}>{body}</div>
    <Dialog open={!!target} onClose={() => { if (!copying) setTarget(null) }} title={tr('leave')}
      actions={<><Button variant="ghost" disabled={copying} onClick={() => setTarget(null)}>{tr('return')}</Button><Button variant="ghost" disabled={copying} onClick={() => void copyNotes()}>{tr('copy')}</Button><Button variant="danger" disabled={copying} onClick={() => { if (target) finish(target) }}>{tr('discard')}</Button></>}>
      <p>{tr('clipboard')}</p><p role="status">{status && tr(status)}</p>
    </Dialog>
  </PersonScreen>
}
