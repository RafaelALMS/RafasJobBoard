import { Link } from 'react-router-dom'
import type { MouseEvent } from 'react'
import type { Job } from '@shared'
import { TONE_BG, TONE_TEXT, formatDate, scoreTone } from '@shared'
import { api } from '../api'

interface Props {
  job: Job
  onFavorite: (id: string, favorite: boolean) => void
}

export default function JobCard({ job, onFavorite }: Props) {
  const tone = scoreTone(job.score)
  const analysis = job.analysis

  const toggleFavorite = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    api.favorite(job.id)
      .then(({ favorite }) => onFavorite(job.id, favorite))
      .catch(() => undefined)
  }

  return (
    <Link
      to={`/jobs/${encodeURIComponent(job.id)}`}
      className="card block p-4 transition hover:border-accent/60"
    >
      <div className="flex gap-3">
        {job.score !== null && (
          <div
            title={`Match score ${job.score}/100`}
            className={`grid h-12 w-12 shrink-0 place-items-center rounded-lg border text-base font-bold ${TONE_BG[tone]} ${TONE_TEXT[tone]}`}
          >
            {job.score}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug" title={job.title}>
                {job.title}
              </h3>
              <p className="mt-0.5 truncate text-sm text-muted" title={job.company}>
                {job.company}
                {job.location ? ` · ${job.location}` : ''}
                {job.remote ? ' · 🌍 Remote' : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={toggleFavorite}
              aria-label={job.favorite ? 'Remove from saved' : 'Save job'}
              title={job.favorite ? 'Saved' : 'Save'}
              className={`shrink-0 text-lg leading-none transition hover:scale-110 ${
                job.favorite ? 'text-warn' : 'text-line'
              }`}
            >
              {job.favorite ? '★' : '☆'}
            </button>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted">
            <span className="rounded border border-line bg-bg px-1.5 py-0.5 font-medium uppercase tracking-wide">
              {job.source}
            </span>
            {job.contract && <span>{job.contract}</span>}
            {job.salary && <span className="font-medium text-fg">{job.salary}</span>}
            {job.postedAt && <span>{formatDate(job.postedAt)}</span>}
            {job.category && <span className="hidden sm:inline">{job.category}</span>}
          </div>

          {analysis && (analysis.matched.length > 0 || analysis.gaps.length > 0) && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {analysis.matched.slice(0, 4).map((m) => (
                <span
                  key={`m-${m}`}
                  className="rounded-full border border-good/30 bg-good/10 px-2 py-0.5 text-[11px] text-good"
                >
                  ✓ {m}
                </span>
              ))}
              {analysis.gaps.slice(0, 2).map((g) => (
                <span
                  key={`g-${g}`}
                  className="rounded-full border border-warn/30 bg-warn/10 px-2 py-0.5 text-[11px] text-warn"
                >
                  ⚠ {g}
                </span>
              ))}
            </div>
          )}

          {analysis && (
            <p className="mt-2 line-clamp-2 text-xs text-muted">{analysis.verdict}</p>
          )}
        </div>
      </div>
    </Link>
  )
}
