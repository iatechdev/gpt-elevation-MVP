// ES-178 (F1): cifras, historial emocional y valoraciones de la ficha. Todo en palabras («n de 5», subió / bajó / igual), sin emojis ni estrellas ni flechas; «Sin datos» si no hay.
import { cardStyle } from './panelStyles'
import { MAX_HISTORY, averageMoodOf, averageRatingOf, moodChange, type MoodRow, type RatingRow } from './followupFormat'

type T = (key: string, params?: Record<string, string | number>) => string
const heading = { fontFamily: 'Playfair Display, serif', fontWeight: 400, fontSize: '1.1rem', color: '#1C1917', margin: 0 } as const
const muted = { margin: 0, fontSize: '0.85rem', color: '#44403C' } as const

const ofFive = (n: number | null, locale: string, t: T) => (n === null ? t('panel_no_data') : t('panel_of_five', { n: n.toLocaleString(locale, { maximumFractionDigits: 1 }) }))

export function FiguresBlock({ moodLogs, ratings, notesCount, t, locale }: { moodLogs: MoodRow[]; ratings: RatingRow[]; notesCount: number; t: T; locale: string }) {
  const cards = [
    { label: t('fu_fig_entries'), value: String(moodLogs.length) },
    { label: t('fu_fig_mood'), value: ofFive(averageMoodOf(moodLogs), locale, t) },
    { label: t('fu_fig_rating'), value: ofFive(averageRatingOf(ratings), locale, t) },
    { label: t('fu_fig_notes'), value: String(notesCount) },
  ]
  return (
    <section style={cardStyle} aria-label={t('fu_figures')}>
      <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', margin: 0 }}>
        {cards.map(card => (
          <div key={card.label}>
            <dd style={{ margin: 0, fontSize: '1.4rem', fontWeight: 600, color: '#1C1917' }}>{card.value}</dd>
            <dt style={{ fontSize: '0.78rem', color: '#44403C', marginTop: 4 }}>{card.label}</dt>
          </div>
        ))}
      </dl>
    </section>
  )
}

export function MoodHistoryBlock({ moodLogs, t, locale }: { moodLogs: MoodRow[]; t: T; locale: string }) {
  const day = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
  return (
    <section style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '0.75rem' }} aria-labelledby="fu-history-title">
      <h2 id="fu-history-title" style={heading}>{t('fu_history')}</h2>
      {moodLogs.length === 0 ? <p style={muted}>{t('fu_history_empty')}</p> : (
        <>
          {moodLogs.length >= MAX_HISTORY && <p style={{ ...muted, fontSize: '0.78rem' }}>{t('fu_history_cap', { n: MAX_HISTORY })}</p>}
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {moodLogs.map(row => {
              const change = moodChange(row)
              const parts = [
                row.checkin_mood === null ? null : t('fu_entry', { n: row.checkin_mood }),
                row.checkout_mood === null ? null : t('fu_exit', { n: row.checkout_mood }),
                change === null ? null : t(`fu_${change}`),
              ].filter((part): part is string => part !== null)
              return (
                <li key={row.id} style={{ padding: '0.6rem 0.9rem', background: '#F5F3EF', borderRadius: '0.65rem', fontSize: '0.85rem', color: '#1C1917', overflowWrap: 'anywhere' }}>
                  <strong>{day(row.date)}</strong> · {parts.length ? parts.join(' · ') : t('panel_no_data')}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}

export function RatingsBlock({ ratings, t, locale }: { ratings: RatingRow[]; t: T; locale: string }) {
  const day = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
  return (
    <section style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '0.75rem' }} aria-labelledby="fu-ratings-title">
      <h2 id="fu-ratings-title" style={heading}>{t('fu_ratings')}</h2>
      {ratings.length === 0 ? <p style={muted}>{t('fu_ratings_empty')}</p> : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {ratings.map(row => (
            <li key={row.id} style={{ padding: '0.6rem 0.9rem', background: '#F5F3EF', borderRadius: '0.65rem', fontSize: '0.85rem', color: '#1C1917' }}>
              <strong>{day(row.date)}</strong> · {row.rating === null ? t('fu_rating_none') : t('panel_of_five', { n: row.rating })}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
