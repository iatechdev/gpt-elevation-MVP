import { useEffect, useEffectEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { listEntries, SpaceError } from './api'
import type { Entry } from './api'
import { copy } from './copy'
import { journalCopy, journalDate } from './journalCopy'

export function JournalRecentList({ entries, lang, selected }: { entries: Entry[]; lang: 'es' | 'en'; selected: number | null }) {
  const c = copy[lang]
  return <><p className="space-note">{c.limit}</p>{!entries.length && <p>{c.empty}</p>}{entries.map(row => <article className={`journal-recent-entry ${row.id === selected ? 'journal-selected' : ''}`} key={row.id}>
    <h3><time dateTime={row.date}>{journalDate(row.date, lang)}</time></h3><p className="space-private-text">{row.content.slice(0, 160)}{row.content.length > 160 ? '…' : ''}</p>
    <Link className="elv-link" aria-current={row.id === selected ? 'page' : undefined} to={`/app/diary/${row.id}`}>{c.open}<span className="sr-only"> {journalDate(row.date, lang)}</span></Link>
  </article>)}</>
}

export function JournalRecent({ token, lang, selected, onSessionExpired }: { token: string; lang: 'es' | 'en'; selected: number | null; onSessionExpired: () => void }) {
  const [state, setState] = useState<{ entries: Entry[]; loading: boolean; failed: boolean }>({ entries: [], loading: true, failed: false })
  const [attempt, setAttempt] = useState(0)
  const expire = useEffectEvent(onSessionExpired)
  useEffect(() => {
    let alive = true
    void listEntries(token).then(entries => { if (alive && localStorage.getItem('elevation_token') === token) setState({ entries, loading: false, failed: false }) })
      .catch(error => {
        if (!alive || localStorage.getItem('elevation_token') !== token) return
        if (error instanceof SpaceError && error.status === 401) { expire(); return }
        setState({ entries: [], loading: false, failed: true })
      })
    return () => { alive = false }
  }, [token, attempt])
  const c = copy[lang]
  return <aside className="journal-recent" aria-labelledby="journal-recent-title"><h2 id="journal-recent-title">{journalCopy[lang].recent}</h2><Link className="elv-btn" to="/app/diary/new">{c.new}</Link>
    {state.loading ? <p role="status">{c.loading}</p> : state.failed ? <><p role="status">{c.loadError}</p><button className="elv-btn" onClick={() => { setState({ entries: [], loading: true, failed: false }); setAttempt(value => value + 1) }}>{c.retry}</button></> : <JournalRecentList entries={state.entries} lang={lang} selected={selected} />}
  </aside>
}
