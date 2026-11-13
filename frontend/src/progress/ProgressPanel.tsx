// ES-173 (HU-P22): panel de «Tu progreso», extraído de UserProgress.tsx y restilizado con Cartografía (sin estilos en línea).
// Solo muestra lo que el servidor devuelve como TEXTO; no inventa recomendaciones ni cifras. Escala «N de 5», tendencia con PALABRA + símbolo (nunca solo color).
import { Link } from 'react-router-dom'
import { Chip } from '../cartografia/controls'
import { Card, Figures, ItemList } from '../cartografia/pieces'
import { useLanguage } from '../i18n/useLanguage'
import { fill, level, TREND_SYMBOL, trendOf, type Trend } from './format.ts'
import '../pages/progressCopy.ts'

export interface MoodLog { id: number; date: string; checkin_mood: number | null; checkout_mood: number | null }
export interface SessionRating { id: number; date: string; rating: number }
export interface Recommendation { id: number; category: string; content: string; generatedAt: string; seenByUser: boolean }
export interface Stats { totalSessions: number; avgMood: number | null; avgRating: number | null; streak: number }

const TREND_KEY: Record<Trend, string> = { up: 'pr_up', same: 'pr_same', down: 'pr_down' }
const TREND_TONE = { up: 'ok', same: 'neutral', down: 'wait' } as const // ninguna tendencia es «mala»: la baja no usa el tono de error
const KNOWN_CATEGORIES = ['mindfulness', 'habit', 'reflection', 'resource']

export function ProgressPanel({ stats, moodLogs, ratings, recommendations }: { stats: Stats | null; moodLogs: MoodLog[]; ratings: SessionRating[]; recommendations: Recommendation[] }) {
  const { t, lang } = useLanguage()
  const locale = lang === 'es' ? 'es-CO' : 'en-US'
  const avg = (value: number | string) => Number(value).toLocaleString(locale, { maximumFractionDigits: 1 })
  const dateOf = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })
  const moodText = (value: number) => `${fill(t('pr_of5'), { n: level(value) })} (${t(`pr_mood_${level(value)}`)})`
  const category = (value: string) => t(KNOWN_CATEGORIES.includes(value) ? `pr_rec_cat_${value}` : 'pr_rec_cat_other')

  return (
    <>
      {stats && (
        <Figures items={[
          { id: 'sessions', label: t('pr_stat_sessions'), value: stats.totalSessions },
          { id: 'mood', label: t('pr_stat_mood'), value: stats.avgMood != null ? <>{fill(t('pr_of5'), { n: avg(stats.avgMood) })}<span className="prg-word"> {t(`pr_mood_${level(stats.avgMood)}`)}</span></> : '—' },
          { id: 'rating', label: t('pr_stat_rating'), value: stats.avgRating != null ? fill(t('pr_of5'), { n: avg(stats.avgRating) }) : '—' },
          { id: 'streak', label: t('pr_stat_streak'), value: `${stats.streak} ${t(stats.streak === 1 ? 'pr_day' : 'pr_days')}` },
        ]} />
      )}

      {recommendations.length > 0 && (
        <Card as="section" className="prg-card">
          <h2 className="cg-h2">{t('pr_rec_title')}</h2>
          <ItemList items={recommendations.map(rec => ({
            id: String(rec.id),
            top: <><span className="cg-tag">{category(rec.category)}</span>{!rec.seenByUser && <Chip tone="wait">{t('pr_new')}</Chip>}</>,
            body: <p className="prg-prose">{rec.content}</p>,
          }))} />
        </Card>
      )}

      <div className="prg-cols">
        <Card as="section" className="prg-card">
          <h2 className="cg-h2">{t('pr_mood_title')}</h2>
          {moodLogs.length === 0 ? (
            <>
              <p className="cg-muted">{t('pr_mood_empty')}</p>
              <p><Link className="cg-linkbtn prg-link" to="/app/checkin">{t('pr_go_checkin')}</Link></p>
            </>
          ) : (
            <ItemList label={t('pr_mood_title')} items={moodLogs.map(log => {
              const both = log.checkin_mood != null && log.checkout_mood != null
              const trend = both ? trendOf(log.checkin_mood as number, log.checkout_mood as number) : null
              return {
                id: String(log.id),
                top: <span className="cg-small cg-muted">{dateOf(log.date)}</span>,
                body: (
                  <p className="prg-mood">
                    {log.checkin_mood != null && <span>{t('pr_in')}: {moodText(log.checkin_mood)}</span>}
                    {log.checkout_mood != null && <span>{t('pr_out')}: {moodText(log.checkout_mood)}</span>}
                    {trend && <Chip tone={TREND_TONE[trend]} symbol={TREND_SYMBOL[trend]}>{t(TREND_KEY[trend])}</Chip>}
                  </p>
                ),
              }
            })} />
          )}
        </Card>

        <Card as="section" className="prg-card">
          <h2 className="cg-h2">{t('pr_ratings_title')}</h2>
          {ratings.length === 0 ? <p className="cg-muted">{t('pr_ratings_empty')}</p> : (
            <ItemList label={t('pr_ratings_title')} items={ratings.map(row => ({ id: String(row.id), top: <><span className="cg-small cg-muted">{dateOf(row.date)}</span><span>{fill(t('pr_of5'), { n: level(row.rating) })}</span></> }))} />
          )}
        </Card>
      </div>
    </>
  )
}
