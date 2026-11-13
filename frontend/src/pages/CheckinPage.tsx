import '../checkin/register.ts' // ES-232: catálogo de textos de esta pantalla (ya no va en el arranque)
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PersonFrame } from '../shell/frames'
import { Banner, Button, Card, LinkButton } from '../cartografia'
import { useLanguage } from '../i18n/useLanguage'
import { invalidateStoredSession, readStoredToken } from '../access/session'
import { contextRequest } from '../context/participantContext'
import { MoodScale } from '../checkin/MoodScale'
import { SupportNotice } from '../checkin/SupportNotice'
import { countryFor } from '../checkin/contactEntries'
import { needsSupport, saveMood, type MoodValue } from '../checkin/moodLogic'
import '../checkin/checkin.css'

type Phase = 'idle' | 'saving' | 'error' | 'saved'
const markDone = () => { try { localStorage.setItem('elevation_checkin_date', new Date().toDateString()) } catch { /* almacenamiento no disponible */ } }

/** ES-159 · Hoy: el registro del día (escala de cinco palabras). Solo la persona lo ve; guardar es opcional y un error no la deja sin conversación. */
function CheckinContent() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [value, setValue] = useState<MoodValue | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [need, setNeed] = useState(false)
  const [country, setCountry] = useState<string | null>(null)
  const sending = useRef(false)
  const askedCountry = useRef(false)
  const scaleRef = useRef<HTMLDivElement>(null)
  const savedRef = useRef<HTMLDivElement>(null)
  const errorRef = useRef<HTMLDivElement>(null)
  const support = needsSupport(value)

  // El país de los servicios de ayuda es el de residencia del punto de partida (si existe); si no, el predeterminado. Solo se pide al mostrar el aviso.
  useEffect(() => {
    if (!support || askedCountry.current) return
    askedCountry.current = true
    contextRequest().then(snapshot => countryFor(snapshot.context?.residenceCountry)).catch(() => countryFor(null)).then(setCountry)
  }, [support])
  useEffect(() => { if (phase === 'saved') savedRef.current?.focus(); if (phase === 'error') errorRef.current?.focus() }, [phase])

  const goChat = () => { markDone(); navigate('/app/chat') }
  const save = async () => {
    if (sending.current || phase === 'saving') return
    if (!value) { setNeed(true); scaleRef.current?.querySelector<HTMLInputElement>('input')?.focus(); return }
    sending.current = true; setPhase('saving'); setNeed(false)
    const token = readStoredToken()
    const result = await saveMood(value, token)
    sending.current = false
    if (result === 'expired') { invalidateStoredSession(token); return }
    if (result === 'error') { setPhase('error'); return }
    markDone()
    if (needsSupport(value)) setPhase('saved') // con «Cargado»/«Bajo» se queda el aviso a la vista antes de seguir
    else navigate('/app/chat')
  }

  return (
    <section className="ck" aria-labelledby="ck-title">
      <p className="ck-eyebrow">{t('checkin.eyebrow')}</p>
      <h1 id="ck-title">{t('checkin.title')}</h1>
      <p className="ck-intro">{t('checkin.intro')}</p>
      <Card as="div">
        <form noValidate onSubmit={event => { event.preventDefault(); void save() }}>
          <div ref={scaleRef}>
            <MoodScale value={value} disabled={phase === 'saving' || phase === 'saved'} error={need} onChange={next => { setValue(next); setNeed(false); if (phase === 'error') setPhase('idle') }} />
          </div>
          {support && <div className="ck-support"><SupportNotice country={country} /></div>}
          {phase === 'saved' ? (
            <div ref={savedRef} tabIndex={-1} role="status" className="ck-saved">
              <p>{t('checkin.saved')}</p>
              <Button onClick={goChat}>{t('checkin.continue')}</Button>
            </div>
          ) : phase === 'error' ? (
            <div ref={errorRef} tabIndex={-1} className="ck-error-box">
              <Banner kind="error" title={t('checkin.error_title')}><p>{t('checkin.error_body')}</p></Banner>
              <div className="ck-actions">
                <Button type="submit">{t('checkin.retry')}</Button>
                <LinkButton onClick={goChat}>{t('checkin.go_without_saving')}</LinkButton>
              </div>
            </div>
          ) : (
            <div className="ck-actions">
              <Button type="submit" disabled={phase === 'saving'}>{phase === 'saving' ? t('checkin.saving') : t('checkin.save')}</Button>
              <LinkButton onClick={goChat}>{t('checkin.skip')}</LinkButton>
            </div>
          )}
        </form>
      </Card>
      <p className="ck-note">{t('checkin.note')}</p>
    </section>
  )
}

export function CheckinPage() {
  return <PersonFrame migrated><CheckinContent /></PersonFrame>
}
