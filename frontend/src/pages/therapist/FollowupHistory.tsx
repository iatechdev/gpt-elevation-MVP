// ES-178 (F1): cifras, historial emocional y valoraciones de la ficha. Todo en palabras («n de 5», subió / bajó / igual), sin emojis ni estrellas ni flechas; «Sin datos» si no hay.
// ES-309 (PR 2): en Cartografía (cg-card, Figures, cg-items); sin estilos en línea. Ni la lógica ni los textos cambian.
import { Figures } from '../../cartografia'
import { MAX_HISTORY, averageMoodOf, averageRatingOf, moodChange, type MoodRow, type RatingRow } from './followupFormat'

type T = (key: string, params?: Record<string, string | number>) => string
const ofFive = (n: number | null, locale: string, t: T) => (n === null ? t('panel_no_data') : t('panel_of_five', { n: n.toLocaleString(locale, { maximumFractionDigits: 1 }) }))

export function FiguresBlock({ moodLogs, ratings, notesCount, t, locale }: { moodLogs: MoodRow[]; ratings: RatingRow[]; notesCount: number; t: T; locale: string }) {
  const cards = [
    // E226-2: el servidor devuelve como máximo los últimos 60 registros; con el tope alcanzado, las cifras lo dicen junto al número (sin inventar un total).
    { id: 'entries', label: t(moodLogs.length >= MAX_HISTORY ? 'fu_fig_entries_cap' : 'fu_fig_entries', { n: MAX_HISTORY }), value: String(moodLogs.length) },
    { id: 'mood', label: t(moodLogs.length >= MAX_HISTORY ? 'fu_fig_mood_cap' : 'fu_fig_mood', { n: MAX_HISTORY }), value: ofFive(averageMoodOf(moodLogs), locale, t) },
    { id: 'rating', label: t(ratings.length >= MAX_HISTORY ? 'fu_fig_rating_cap' : 'fu_fig_rating', { n: MAX_HISTORY }), value: ofFive(averageRatingOf(ratings), locale, t) },
    { id: 'notes', label: t('fu_fig_notes'), value: String(notesCount) },
  ]
  return (
    <section className="cg-card pf-block" aria-label={t('fu_figures')}>
      <Figures items={cards} />
    </section>
  )
}

export function MoodHistoryBlock({ moodLogs, t, locale }: { moodLogs: MoodRow[]; t: T; locale: string }) {
  const day = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
  return (
    <section className="cg-card pf-block" aria-labelledby="fu-history-title">
      <h2 id="fu-history-title">{t('fu_history')}</h2>
      {moodLogs.length === 0 ? <p className="pf-small">{t('fu_history_empty')}</p> : (
        <>
          {moodLogs.length >= MAX_HISTORY && <p className="pf-small">{t('fu_history_cap', { n: MAX_HISTORY })}</p>}
          <ul className="cg-items">
            {moodLogs.map(row => {
              const change = moodChange(row)
              const parts = [
                row.checkin_mood === null ? null : t('fu_entry', { n: row.checkin_mood }),
                row.checkout_mood === null ? null : t('fu_exit', { n: row.checkout_mood }),
                change === null ? null : t(`fu_${change}`),
              ].filter((part): part is string => part !== null)
              return (
                <li key={row.id} className="cg-item">
                  <p className="pf-line"><strong>{day(row.date)}</strong> · {parts.length ? parts.join(' · ') : t('panel_no_data')}</p>
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
    <section className="cg-card pf-block" aria-labelledby="fu-ratings-title">
      <h2 id="fu-ratings-title">{t('fu_ratings')}</h2>
      {ratings.length === 0 ? <p className="pf-small">{t('fu_ratings_empty')}</p> : (
        <ul className="cg-items">
          {ratings.map(row => (
            <li key={row.id} className="cg-item">
              <p className="pf-line"><strong>{day(row.date)}</strong> · {row.rating === null ? t('fu_rating_none') : t('panel_of_five', { n: row.rating })}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
