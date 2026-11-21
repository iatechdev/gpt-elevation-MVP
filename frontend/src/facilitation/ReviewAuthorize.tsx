// ES-303 (PR B) · La persona autoriza a una persona revisora con un CÓDIGO de un solo uso, y ve/actualiza/retira sus autorizaciones. Diseño aprobado: ES-303 comentarios 12827, 12828 y 12839.
// Nunca se envía ni se muestra un reviewerId; el servidor resuelve a la persona revisora dentro de la transacción. Ninguna evidencia viene marcada. El código del fragmento (#code=…) se lee y se LIMPIA de la URL al cargar;
// no se guarda en el almacenamiento del navegador ni se escribe en ningún error. Todo lo que responde el servidor se muestra como TEXTO.
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Banner, Card } from '../cartografia/pieces'
import { Chip, TextField } from '../cartografia/controls'
import { evidenceApi } from '../evidence/api'
import type { Evidence } from '../evidence/model'
import { dateText } from '../routeCatalog/person'
import { API } from '../routeCatalog/shared'
import type { AuthKey } from './reviewAuthCopy'
import { useAuthCopy } from './useAuthCopy'
import { codeComplete, codeFromHash, formatCode, latestShares, problemOf, reviewAuthApi, type Lookup, type Problem, type ShareView } from './reviewAuthApi'

type Step = 'code' | 'checking' | 'pick' | 'authorizing'
type Target = { kind: 'code' } | { kind: 'again'; shareId: number }

/** Solo lo que el servidor aceptará: confirmada, vigente, sin origen en el chat y sin marca «para revisión». El servidor lo vuelve a comprobar. */
const shareable = (rows: Evidence[]) => rows.filter(row => row.status === 'confirmed' && !row.fromChat && !row.origin?.needsReview)

/** Referrer-Policy estricta mientras esta pantalla está abierta (el código puede venir en el enlace). */
function useNoReferrer() {
  useEffect(() => {
    const meta = document.createElement('meta'); meta.name = 'referrer'; meta.content = 'no-referrer'; document.head.appendChild(meta)
    return () => { meta.remove() }
  }, [])
}

export function ReviewAuthorize({ token, onSession }: { token: string; onSession: () => void }) {
  const { t, lang } = useAuthCopy(); useNoReferrer()
  const api = useMemo(() => reviewAuthApi(API, token), [token])
  const evidences = useMemo(() => evidenceApi(API, token), [token])
  const codeId = useId(); const flashRef = useRef<HTMLParagraphElement>(null); const pickRef = useRef<HTMLHeadingElement>(null); const errRef = useRef<HTMLParagraphElement>(null)
  const [initialCode] = useState(() => codeFromHash(window.location.hash))
  const [step, setStep] = useState<Step>('code'); const [code, setCode] = useState(initialCode); const [fromLink, setFromLink] = useState(Boolean(initialCode))
  const [target, setTarget] = useState<Target>({ kind: 'code' }); const [lookup, setLookup] = useState<Lookup | null>(null)
  const [options, setOptions] = useState<Evidence[]>([]); const [chosen, setChosen] = useState<number[]>([])
  const [problem, setProblem] = useState<Problem | ''>(''); const [flash, setFlash] = useState<AuthKey | ''>('')
  const [shares, setShares] = useState<ShareView[] | 'loading' | 'error'>('loading'); const [attempt, setAttempt] = useState(0)
  const sent = useRef<{ requestId: string; key: string } | null>(null)

  // El código del fragmento ya se leyó al iniciar: se quita de la URL (no queda en el historial ni se envía a ningún sitio).
  useEffect(() => { if (/[#&]code=/.test(window.location.hash)) window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search) }, [])
  useEffect(() => {
    const controller = new AbortController()
    void api.shares(controller.signal).then(rows => { if (!controller.signal.aborted) setShares(latestShares(rows)) })
      .catch(error => { if (!controller.signal.aborted) { if (problemOf(error) === 'session') onSession(); else setShares('error') } })
    return () => controller.abort()
  }, [api, attempt, onSession])
  useEffect(() => { if (flash) flashRef.current?.focus() }, [flash])
  useEffect(() => { if (problem) (problem === 'invalid' || problem === 'limit' ? document.getElementById(codeId) : errRef.current)?.focus() }, [problem, codeId])
  useEffect(() => { if (step === 'pick') pickRef.current?.focus() }, [step])

  const loadOptions = useCallback(async () => {
    const rows = shareable(await evidences.list())
    setOptions(rows); setChosen(previous => previous.filter(id => rows.some(row => row.id === id)))
  }, [evidences])
  const fail = (error: unknown, back: Step) => {
    const found = problemOf(error)
    if (found === 'session') { onSession(); return }
    setProblem(found); setStep(back)
  }
  const reset = () => { setStep('code'); setCode(''); setFromLink(false); setTarget({ kind: 'code' }); setLookup(null); setChosen([]); setProblem(''); sent.current = null }

  async function submitCode(event: React.FormEvent) {
    event.preventDefault()
    if (!codeComplete(code)) { setProblem('invalid'); return }
    setProblem(''); setFlash(''); setStep('checking')
    try { const found = await api.lookup(code); await loadOptions(); setLookup(found); setTarget({ kind: 'code' }); setChosen([]); sent.current = null; setStep('pick') } catch (error) { fail(error, 'code') }
  }
  async function startAgain(share: ShareView) {
    setProblem(''); setFlash(''); setLookup(null); setTarget({ kind: 'again', shareId: share.id }); setChosen([]); sent.current = null
    try { await loadOptions(); setStep('pick') } catch (error) { fail(error, 'code') }
  }
  async function authorize() {
    if (!chosen.length) return
    const ids = [...chosen].sort((a, b) => a - b); const key = ids.join(',')
    // El MISMO conjunto reutiliza el MISMO requestId (un reintento no duplica); si cambia la selección, es otra solicitud.
    const current = sent.current?.key === key ? sent.current : { requestId: crypto.randomUUID(), key }
    sent.current = current; setProblem(''); setStep('authorizing')
    try {
      if (target.kind === 'code') await api.authorizeWithCode({ code, evidenceIds: ids, requestId: current.requestId })
      else await api.authorizeAgain({ shareId: target.shareId, evidenceIds: ids, requestId: current.requestId })
      reset(); setFlash('okTitle'); setAttempt(n => n + 1)
    } catch (error) {
      const found = problemOf(error)
      if (found === 'invalid' || found === 'gone') { const backToCode = target.kind === 'code'; reset(); setProblem(found); if (!backToCode) setFlash('gone'); return }
      if (found === 'invalidEvidence') { try { await loadOptions() } catch { /* se conserva la lista anterior */ } }
      fail(error, 'pick')
    }
  }
  async function withdraw(share: ShareView) {
    try { await api.withdraw(share.id); setFlash('withdrawn'); setAttempt(n => n + 1) } catch (error) { if (problemOf(error) === 'session') onSession(); else setProblem('network') }
  }
  const toggle = (id: number) => setChosen(previous => (previous.includes(id) ? previous.filter(value => value !== id) : [...previous, id]))
  const when = (value: string) => dateText(value, lang) ?? ''
  const name = lookup?.reviewerName ?? t('reviewer')
  const message = (found: Problem | '') => (found === 'invalid' ? t('invalidCode') : found === 'limit' ? t('tooMany') : found === 'invalidEvidence' ? t('invalidEvidence') : found === 'gone' ? t('gone') : found === 'network' ? t('authError') : '')
  const busy = step === 'checking' || step === 'authorizing'

  return (
    <>
      {flash && <p ref={flashRef} tabIndex={-1} role="status" className="cg-banner"><span className="cg-banner__title">{t(flash)}{flash === 'okTitle' ? ` ${t('okBody')}` : ''}</span></p>}
      {(step === 'code' || step === 'checking') && (
        <Card as="section" className="rv-card">
          <h2 className="cg-h2">{t('cardTitle')}</h2>
          <p className="cg-hint">{t('cardHint')}</p>
          {fromLink && step === 'code' && <Banner title={t('fromLink')} />}
          <form className="rv-form" noValidate onSubmit={event => void submitCode(event)} aria-busy={step === 'checking'}>
            <TextField id={codeId} label={t('codeLabel')} value={code} autoComplete="off" autoCorrect="off" autoCapitalize="characters" spellCheck={false} inputMode="text" className="rv-codefield"
              placeholder={t('codePlaceholder')} maxLength={19} disabled={busy} error={problem === 'invalid' || problem === 'limit' ? message(problem) : undefined}
              onChange={event => { setCode(formatCode(event.target.value)); setProblem(''); setFromLink(false) }} />
            {problem === 'network' && <p ref={errRef} tabIndex={-1} role="alert" className="cg-error">{t('authError')}</p>}
            <div className="cg-row"><button className="cg-btn" type="submit" disabled={busy}>{t('continue')}</button></div>
            <p role="status" className="cg-hint">{step === 'checking' ? t('checking') : ''}</p>
          </form>
        </Card>
      )}
      {(step === 'pick' || step === 'authorizing') && (
        <Card as="section" className="rv-card">
          <h2 className="cg-h2" ref={pickRef} tabIndex={-1}>{target.kind === 'code' ? t('cardTitle') : t('updateTitle')}</h2>
          {target.kind === 'code' && lookup && <p>{t('offer', { name, date: when(lookup.expiresAt) })}</p>}
          <fieldset className="rv-pick" disabled={step === 'authorizing'}>
            <legend className="cg-label">{t('pick')}</legend>
            <p className="cg-hint">{t('pickHint')}</p>
            {options.length === 0 && <p>{t('noEvidence')}</p>}
            {options.map(row => (
              <label key={row.id} className="rv-chk"><input type="checkbox" checked={chosen.includes(row.id)} onChange={() => toggle(row.id)} />
                <span>{row.payload.title || t('evidenceUntitled')} <span className="cg-muted">· {t('evidenceVersion', { n: row.version })}</span></span></label>
            ))}
          </fieldset>
          <p role="status" className="cg-small cg-muted">{t('selected', { n: chosen.length })}</p>
          <p className="cg-small">{t('privacy')}</p>
          {(problem === 'network' || problem === 'invalidEvidence') && <Banner kind="error" title={message(problem)}>{problem === 'network' && <div className="cg-row"><button type="button" className="cg-btn cg-btn--ghost" onClick={() => void authorize()}>{t('retry')}</button></div>}</Banner>}
          <div className="cg-row">
            <button className="cg-btn" type="button" disabled={step === 'authorizing' || chosen.length === 0} onClick={() => void authorize()}>{step === 'authorizing' ? t('authorizing') : target.kind === 'code' ? t('authorizeTo', { name }) : t('authorize')}</button>
            <button className="cg-btn cg-btn--ghost" type="button" disabled={step === 'authorizing'} onClick={reset}>{t('cancel')}</button>
          </div>
        </Card>
      )}
      <Card as="section" className="rv-card">
        <h2 className="cg-h2">{t('listTitle')}</h2>
        {shares === 'loading' && <p role="status" className="cg-muted">{t('loading')}</p>}
        {shares === 'error' && <Banner kind="error" title={t('loadError')}><div className="cg-row"><button className="cg-btn cg-btn--ghost" type="button" onClick={() => { setShares('loading'); setAttempt(n => n + 1) }}>{t('retry')}</button></div></Banner>}
        {Array.isArray(shares) && shares.length === 0 && <p>{t('none')}</p>}
        {Array.isArray(shares) && shares.length > 0 && (
          <ul className="rv-list">
            {shares.map(share => {
              const active = share.status === 'granted'
              return (
                <li key={share.id} className="rv-row">
                  <div className="rv-row__top"><strong>{share.reviewerName ?? t('reviewer')}</strong>{active ? <Chip tone="ok" symbol="✓">{t('stGranted')}</Chip> : <Chip tone="wait" symbol="○">{t('stRevoked')}</Chip>}</div>
                  <p className="cg-hint">{t('since', { date: when(share.createdAt) })} · {share.evidenceCount === 1 ? t('evidenceOne') : t('evidenceCount', { n: share.evidenceCount })}</p>
                  {active && <div className="cg-row"><button type="button" className="cg-btn cg-btn--ghost" disabled={busy} onClick={() => void startAgain(share)}>{t('update')}</button><button type="button" className="cg-btn cg-btn--ghost" disabled={busy} onClick={() => void withdraw(share)}>{t('withdraw')}</button></div>}
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </>
  )
}
