import { useEffect, useMemo, useState } from 'react'
import { jobLevelFromTitle, type SearchResponse, type SourceInfo } from '@shared'
import { api } from '../api'
import { useProfile } from '../profile'
import SearchBar from '../components/SearchBar'
import ResumePanel from '../components/ResumePanel'
import Filters from '../components/Filters'
import JobCard from '../components/JobCard'
import SkeletonCard from '../components/Skeleton'

interface SearchParams {
  q: string
  location: string
  remote: boolean
  sources: string[] | null
  sort: 'match' | 'recent'
}

const INITIAL_PARAMS: SearchParams = { q: '', location: '', remote: false, sources: null, sort: 'match' }

const DATE_WINDOWS: Record<string, number> = { '24h': 1, '7d': 7, '30d': 30 }

export default function Home() {
  const { profile } = useProfile()

  // Pending inputs — applied on Search
  const [q, setQ] = useState('')
  const [location, setLocation] = useState('')

  // Executed search
  const [params, setParams] = useState<SearchParams>(INITIAL_PARAMS)
  const [result, setResult] = useState<SearchResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Client-side filters
  const [level, setLevel] = useState('')
  const [minScore, setMinScore] = useState(0)
  const [datePosted, setDatePosted] = useState('')

  const [sourceList, setSourceList] = useState<SourceInfo[]>([])
  const [panelOpen, setPanelOpen] = useState(false)

  useEffect(() => {
    api.sources()
      .then((r) => setSourceList(r.sources))
      .catch(() => undefined)
  }, [])

  // Run search whenever executed params change (also the initial search)
  useEffect(() => {
    let stale = false
    setLoading(true)
    setError(null)
    api.search(params)
      .then((res) => {
        if (!stale) setResult(res)
      })
      .catch((err: unknown) => {
        if (!stale) setError(err instanceof Error ? err.message : 'Search failed')
      })
      .finally(() => {
        if (!stale) setLoading(false)
      })
    return () => {
      stale = true
    }
  }, [params])

  const submit = () => setParams((p) => ({ ...p, q, location }))
  const patchParams = (patch: Partial<SearchParams>) => setParams((p) => ({ ...p, ...patch }))

  const visible = useMemo(() => {
    let jobs = result?.jobs ?? []
    if (level) {
      jobs = jobs.filter((j) => {
        const detected = jobLevelFromTitle(j.title)
        return !detected || detected === level
      })
    }
    if (minScore > 0) jobs = jobs.filter((j) => (j.score ?? -1) >= minScore)
    const days = DATE_WINDOWS[datePosted]
    if (days) {
      const cutoff = Date.now() - days * 86_400_000
      jobs = jobs.filter((j) => !j.postedAt || Date.parse(j.postedAt) >= cutoff)
    }
    return jobs
  }, [result, level, minScore, datePosted])

  const setFavorite = (id: string, favorite: boolean) => {
    setResult((prev) =>
      prev ? { ...prev, jobs: prev.jobs.map((j) => (j.id === id ? { ...j, favorite } : j)) } : prev,
    )
  }

  const sourceResults = result?.sources ?? []
  const okSources = sourceResults.filter((s) => s.status === 'ok')
  const failedSources = sourceResults.filter((s) => s.status === 'error' || s.status === 'timeout')

  return (
    <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 lg:grid-cols-[300px_minmax(0,1fr)]">
      {/* Sidebar: resume + filters */}
      <aside
        className={`order-2 space-y-4 lg:order-1 lg:sticky lg:top-[74px] lg:max-h-[calc(100vh-90px)] lg:self-start lg:overflow-y-auto ${
          panelOpen ? 'block' : 'hidden'
        } lg:block`}
      >
        <ResumePanel />
        <Filters
          sources={sourceList}
          selected={params.sources}
          onSelect={(ids) => patchParams({ sources: ids })}
          level={level}
          onLevel={setLevel}
          minScore={minScore}
          onMinScore={setMinScore}
          datePosted={datePosted}
          onDatePosted={setDatePosted}
          hasProfile={Boolean(profile)}
        />
      </aside>

      {/* Main column */}
      <main className="order-1 min-w-0 space-y-4 lg:order-2">
        <SearchBar
          q={q}
          location={location}
          remote={params.remote}
          loading={loading}
          onQ={setQ}
          onLocation={setLocation}
          onRemote={(remote) => patchParams({ remote })}
          onSubmit={submit}
        />

        <button
          type="button"
          onClick={() => setPanelOpen((o) => !o)}
          className="card flex w-full items-center justify-between px-4 py-2.5 text-sm lg:hidden"
        >
          <span>⚙ Resume & filters</span>
          <span className="text-xs font-medium text-accent">{panelOpen ? 'Hide' : 'Show'}</span>
        </button>

        {!profile && (
          <div className="rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 text-sm text-muted">
            <strong className="font-semibold text-fg">No resume uploaded yet.</strong> Add your PDF
            to rank these jobs by fit and see matched skills per listing.
          </div>
        )}

        {/* Status row */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted">
          {error ? (
            <span className="text-bad">⚠ {error}</span>
          ) : (
            <>
              <span>
                <strong className="text-fg">{visible.length}</strong> jobs
                {profile ? ' · ranked for your resume' : ''}
              </span>
              {okSources.length > 0 && (
                <span>
                  {okSources.length} source{okSources.length > 1 ? 's' : ''} ·{' '}
                  {okSources.map((s) => s.name).join(', ')}
                </span>
              )}
              {result && <span>{(result.tookMs / 1000).toFixed(1)}s</span>}
            </>
          )}
          {failedSources.map((s) => (
            <span
              key={s.id}
              title={`${s.name}: ${s.error ?? s.status}`}
              className="rounded border border-warn/40 bg-warn/10 px-1.5 py-0.5 text-warn"
            >
              {s.name}: {s.status === 'timeout' ? 'timeout' : 'error'}
            </span>
          ))}
        </div>

        {/* Results toolbar */}
        {result && !error && (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted">
              {loading ? 'Updating…' : `Showing ${visible.length} of ${result.jobs.length}`}
            </p>
            <select
              value={params.sort}
              onChange={(e) => patchParams({ sort: e.target.value as 'match' | 'recent' })}
              aria-label="Sort results"
              className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs outline-none transition focus:border-accent"
            >
              <option value="match">Best match</option>
              <option value="recent">Most recent</option>
            </select>
          </div>
        )}

        {/* Results */}
        <div className={`space-y-3 transition ${loading && result ? 'pointer-events-none opacity-60' : ''}`}>
          {loading && !result && (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          )}

          {!loading && !error && result && visible.length === 0 && (
            <div className="card p-8 text-center">
              <p className="font-medium">No jobs match your filters.</p>
              <p className="mt-1 text-sm text-muted">
                Try other keywords, clear the score/level filters, or enable more sources in the
                sidebar.
              </p>
            </div>
          )}

          {visible.map((job) => (
            <JobCard key={job.id} job={job} onFavorite={setFavorite} />
          ))}
        </div>

        {error && result && (
          <button
            type="button"
            onClick={submit}
            className="rounded-lg border border-line bg-surface px-4 py-2 text-sm hover:border-accent hover:text-accent"
          >
            Retry search
          </button>
        )}
      </main>
    </div>
  )
}
