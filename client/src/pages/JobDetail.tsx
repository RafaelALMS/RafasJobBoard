import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { Job, MatchBreakdown } from '@shared'
import { TONE_BG, TONE_TEXT, formatDate, scoreTone } from '@shared'
import { api } from '../api'
import { useProfile } from '../profile'

const BREAKDOWN_ROWS: Array<[keyof MatchBreakdown, string]> = [
  ['skills', 'Skills'],
  ['seniority', 'Seniority'],
  ['location', 'Location'],
  ['salary', 'Salary'],
  ['domain', 'Domain'],
]

const BAR_CLASS = { good: 'bg-good', warn: 'bg-warn', bad: 'bg-bad', none: 'bg-accent' }

function fitLabel(score: number): string {
  if (score >= 90) return 'Excellent fit'
  if (score >= 75) return 'Strong fit'
  if (score >= 50) return 'Partial fit'
  return 'Weak fit'
}

export default function JobDetail() {
  const { id = '' } = useParams()
  const { profile } = useProfile()
  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rerunning, setRerunning] = useState(false)
  const [rerunError, setRerunError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setJob(await api.job(id))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load this job')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const toggleFavorite = async () => {
    if (!job) return
    try {
      const { favorite } = await api.favorite(job.id)
      setJob({ ...job, favorite })
    } catch {
      /* ignore */
    }
  }

  const rerun = async () => {
    if (!job) return
    setRerunning(true)
    setRerunError(null)
    try {
      setJob(await api.analyze(job.id))
    } catch (err) {
      setRerunError(err instanceof Error ? err.message : 'Re-analysis failed')
    } finally {
      setRerunning(false)
    }
  }

  const copySummary = async () => {
    if (!job) return
    const a = job.analysis
    const text = [
      `${job.title} — ${job.company}${job.location ? ` (${job.location})` : ''}`,
      a ? `Match score: ${a.score}/100` : null,
      a
        ? `Breakdown: skills ${a.breakdown.skills} · seniority ${a.breakdown.seniority} · location ${a.breakdown.location} · salary ${a.breakdown.salary} · domain ${a.breakdown.domain}`
        : null,
      a && a.matched.length ? `Strengths: ${a.matched.join('; ')}` : null,
      a && a.gaps.length ? `Gaps: ${a.gaps.join('; ')}` : null,
      a ? `Verdict: ${a.verdict}` : null,
      job.url ? `Link: ${job.url}` : null,
    ]
      .filter(Boolean)
      .join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    } catch {
      setRerunError('Clipboard not available in this browser')
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
        <div className="h-4 w-32 animate-pulse rounded bg-line" />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="card h-72 animate-pulse" />
          <div className="card h-72 animate-pulse" />
        </div>
      </div>
    )
  }

  if (error || !job) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="card p-8 text-center">
          <p className="font-medium text-bad">{error ?? 'Job not found'}</p>
          <p className="mt-1 text-sm text-muted">It may have been evicted from the local cache.</p>
          <Link
            to="/"
            className="mt-4 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white"
          >
            Back to search
          </Link>
        </div>
      </div>
    )
  }

  const analysis = job.analysis
  const tone = scoreTone(job.score)

  return (
    <div className="mx-auto max-w-6xl px-4 py-5">
      <Link to="/" className="inline-block text-sm text-muted transition hover:text-accent">
        ← Back to results
      </Link>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Left: job info + description */}
        <div className="order-2 min-w-0 space-y-4 lg:order-1">
          <div className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-xl font-bold leading-snug">{job.title}</h1>
                <p className="mt-1 text-sm text-muted">
                  {job.company}
                  {job.location ? ` · ${job.location}` : ''}
                  {job.remote ? ' · 🌍 Remote' : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleFavorite}
                  className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                    job.favorite
                      ? 'border-warn/40 bg-warn/10 text-warn'
                      : 'border-line text-muted hover:border-accent hover:text-accent'
                  }`}
                >
                  {job.favorite ? '★ Saved' : '☆ Save'}
                </button>
                {job.url && (
                  <a
                    href={job.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg bg-accent px-4 py-1.5 text-xs font-medium text-white transition hover:opacity-90"
                  >
                    Apply ↗
                  </a>
                )}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
              <span className="rounded border border-line bg-bg px-1.5 py-0.5 font-medium uppercase tracking-wide">
                {job.source}
              </span>
              {job.contract && <span>{job.contract}</span>}
              {job.salary && <span className="font-medium text-fg">{job.salary}</span>}
              {job.postedAt && <span>Posted {formatDate(job.postedAt)}</span>}
              {job.category && <span>{job.category}</span>}
            </div>
          </div>

          <div className="card p-5">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
              Description
            </h2>
            <div
              className="job-html text-sm"
              dangerouslySetInnerHTML={{
                __html: job.description || '<p>No description was provided for this listing.</p>',
              }}
            />
          </div>
        </div>

        {/* Right: match analysis */}
        <aside className="order-1 space-y-4 lg:order-2 lg:sticky lg:top-[74px] lg:self-start">
          <section className="card p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
              Match analysis
            </h2>

            {!profile && (
              <p className="text-sm text-muted">
                Upload your PDF resume (button in the header) to see how well this job fits your
                profile — skills, seniority, location and more.
              </p>
            )}

            {profile && !analysis && (
              <p className="text-sm text-muted">No analysis available for this listing.</p>
            )}

            {profile && analysis && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div
                    title={`Match score ${analysis.score}/100`}
                    className={`grid h-16 w-16 shrink-0 place-items-center rounded-xl border text-2xl font-bold ${TONE_BG[tone]} ${TONE_TEXT[tone]}`}
                  >
                    {analysis.score}
                  </div>
                  <div>
                    <p className="font-semibold">{fitLabel(analysis.score)}</p>
                    <p className="text-xs text-muted">for your resume</p>
                  </div>
                </div>

                <div className="space-y-2">
                  {BREAKDOWN_ROWS.map(([key, label]) => {
                    const value = analysis.breakdown[key]
                    return (
                      <div key={key} className="flex items-center gap-2">
                        <span className="w-20 shrink-0 text-xs text-muted">{label}</span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-line">
                          <div
                            className={`h-full rounded-full ${BAR_CLASS[scoreTone(value)]}`}
                            style={{ width: `${value}%` }}
                          />
                        </div>
                        <span className="w-7 text-right text-xs font-medium">{value}</span>
                      </div>
                    )
                  })}
                </div>

                {analysis.matched.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs font-semibold text-good">✓ Matches</p>
                    <ul className="space-y-1 text-sm">
                      {analysis.matched.map((m) => (
                        <li key={m} className="text-good/90">
                          {m}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {analysis.gaps.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs font-semibold text-warn">⚠ Gaps</p>
                    <ul className="space-y-1 text-sm">
                      {analysis.gaps.map((g) => (
                        <li key={g} className="text-warn/90">
                          {g}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <p className="border-l-2 border-accent pl-3 text-sm leading-relaxed text-muted">
                  {analysis.verdict}
                </p>

                <div className="flex flex-wrap gap-2 border-t border-line pt-3">
                  <button
                    type="button"
                    onClick={copySummary}
                    className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted transition hover:border-accent hover:text-accent"
                  >
                    {copied ? '✓ Copied' : 'Copy summary'}
                  </button>
                  <button
                    type="button"
                    onClick={rerun}
                    disabled={rerunning}
                    className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted transition hover:border-accent hover:text-accent disabled:opacity-60"
                  >
                    {rerunning ? 'Re-scoring…' : 'Re-run match'}
                  </button>
                </div>
                {rerunError && <p className="text-xs text-bad">{rerunError}</p>}
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}
