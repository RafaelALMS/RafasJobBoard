import type { SourceInfo } from '@shared'

const LEVELS = [
  ['', 'Any level'],
  ['junior', 'Junior'],
  ['mid', 'Mid-level'],
  ['senior', 'Senior'],
  ['lead', 'Lead'],
  ['principal', 'Principal / Staff'],
  ['manager', 'Manager'],
  ['director', 'Director+'],
]

const DATES = [
  ['', 'Any time'],
  ['24h', 'Last 24 hours'],
  ['7d', 'Last 7 days'],
  ['30d', 'Last 30 days'],
]

const KIND_DOT: Record<string, string> = {
  keyless: 'bg-good',
  api: 'bg-accent',
  mock: 'bg-warn',
  scraper: 'bg-muted',
}

interface Props {
  sources: SourceInfo[]
  selected: string[] | null
  onSelect: (ids: string[] | null) => void
  level: string
  onLevel: (v: string) => void
  minScore: number
  onMinScore: (v: number) => void
  datePosted: string
  onDatePosted: (v: string) => void
  hasProfile: boolean
}

const selectCls =
  'w-full rounded-lg border border-line bg-bg px-2.5 py-1.5 text-sm outline-none transition focus:border-accent'

export default function Filters({
  sources,
  selected,
  onSelect,
  level,
  onLevel,
  minScore,
  onMinScore,
  datePosted,
  onDatePosted,
  hasProfile,
}: Props) {
  const availableIds = sources.filter((s) => s.available).map((s) => s.id)

  const toggleSource = (id: string) => {
    const current = selected ?? availableIds
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    onSelect(next.length === availableIds.length ? null : next)
  }

  return (
    <section className="card space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Filters</h2>
        {(selected || level || minScore > 0 || datePosted) && (
          <button
            type="button"
            onClick={() => {
              onSelect(null)
              onLevel('')
              onMinScore(0)
              onDatePosted('')
            }}
            className="text-[11px] text-accent hover:underline"
          >
            Reset
          </button>
        )}
      </div>

      <label className="block text-xs text-muted">
        Experience level
        <select value={level} onChange={(e) => onLevel(e.target.value)} className={`${selectCls} mt-1`}>
          {LEVELS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <div>
        <div className="flex items-center justify-between text-xs text-muted">
          <span>Min. match score</span>
          <span className={hasProfile ? 'font-semibold text-fg' : ''}>
            {hasProfile ? `${minScore}%` : '—'}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={90}
          step={10}
          value={minScore}
          disabled={!hasProfile}
          onChange={(e) => onMinScore(Number(e.target.value))}
          className="mt-2 w-full disabled:opacity-40"
        />
        {!hasProfile && (
          <p className="mt-1 text-[11px] text-muted">Upload a resume to enable scoring.</p>
        )}
      </div>

      <label className="block text-xs text-muted">
        Posted
        <select
          value={datePosted}
          onChange={(e) => onDatePosted(e.target.value)}
          className={`${selectCls} mt-1`}
        >
          {DATES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <div>
        <p className="mb-2 text-xs text-muted">Sources</p>
        <div className="space-y-1.5">
          {sources.map((s) => {
            const checked = (selected ?? availableIds).includes(s.id)
            if (!s.available) {
              return (
                <div
                  key={s.id}
                  title={s.reason}
                  className="flex cursor-not-allowed items-center gap-2 text-xs opacity-45"
                >
                  <span className={`h-2 w-2 rounded-full ${KIND_DOT[s.kind] ?? 'bg-muted'}`} />
                  <span className="line-through decoration-muted/60">{s.name}</span>
                  <span className="ml-auto text-[10px] uppercase tracking-wide">n/a</span>
                </div>
              )
            }
            return (
              <label key={s.id} className="flex cursor-pointer items-center gap-2 text-xs">
                <input type="checkbox" checked={checked} onChange={() => toggleSource(s.id)} />
                <span className={`h-2 w-2 rounded-full ${KIND_DOT[s.kind] ?? 'bg-muted'}`} />
                <span>{s.name}</span>
              </label>
            )
          })}
          {sources.length === 0 && <p className="text-xs text-muted">Loading sources…</p>}
        </div>
      </div>
    </section>
  )
}
