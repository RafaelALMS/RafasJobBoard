import type { Adapter, RawJob } from './types'
import { matchesQuery } from './normalize'

/** Remotive — free, no key, remote jobs only. */
export const remotive: Adapter = {
  id: 'remotive',
  name: 'Remotive',
  kind: 'keyless',
  available: () => true,

  async search({ q, location, limit, signal }) {
    const url = new URL('https://remotive.com/api/remote-jobs')
    if (q) url.searchParams.set('search', q)

    const res = await fetch(url, { signal, headers: { accept: 'application/json' } })
    if (!res.ok) throw new Error(`Remotive HTTP ${res.status}`)

    const data = (await res.json()) as { jobs?: Record<string, unknown>[] }
    let jobs = Array.isArray(data.jobs) ? data.jobs : []

    if (location) {
      const loc = location.toLowerCase()
      jobs = jobs.filter((j) => {
        const required = String(j.candidate_required_location ?? '').toLowerCase()
        if (!required || required === 'worldwide') return true
        return required.split(',').some((part) => part.trim().includes(loc) || loc.includes(part.trim()))
      })
    }

    return jobs.slice(0, limit).map(
      (j): RawJob => ({
        title: String(j.title ?? ''),
        company: String(j.company_name ?? ''),
        location: String(j.candidate_required_location || 'Worldwide'),
        url: String(j.url ?? ''),
        description: String(j.description ?? ''),
        salary: String(j.salary ?? '') || null,
        contract: String(j.job_type ?? '') || null,
        remote: true,
        postedAt: (j.publication_date as string) ?? null,
        category: String(j.category ?? '') || null,
      }),
    )
  },
}

/** Arbeitnow — free, no key, but no server-side search → filter locally. */
export const arbeitnow: Adapter = {
  id: 'arbeitnow',
  name: 'Arbeitnow',
  kind: 'keyless',
  available: () => true,

  async search({ q, location, limit, signal }) {
    const res = await fetch('https://www.arbeitnow.com/api/job-board-api', {
      signal,
      headers: { accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`Arbeitnow HTTP ${res.status}`)

    const data = (await res.json()) as { data?: Record<string, unknown>[] }
    const jobs = Array.isArray(data.data) ? data.data : []

    const out: RawJob[] = []
    for (const j of jobs) {
      const title = String(j.title ?? '')
      const tags = Array.isArray(j.tags) ? (j.tags as string[]).join(' ') : ''
      const hay = `${title} ${String(j.description ?? '')} ${tags} ${String(j.location ?? '')}`
      if (!matchesQuery(hay, q)) continue
      if (location && !hay.toLowerCase().includes(location.toLowerCase())) continue

      const jobTypes = Array.isArray(j.job_types) ? (j.job_types as string[]) : []
      out.push({
        title,
        company: String(j.company_name ?? ''),
        location: String(j.location ?? '') || 'Remote',
        url: String(j.url ?? '') || (j.slug ? `https://www.arbeitnow.com/jobs/${j.slug}` : ''),
        description: String(j.description ?? ''),
        contract: jobTypes.join(', ') || null,
        remote: jobTypes.some((t) => /remote/i.test(t)) || /remote/i.test(String(j.location ?? '')),
        postedAt: (j.posted_at as string | number) ?? null,
        category: (j.tags as string[] | undefined)?.[0] ?? null,
      })
      if (out.length >= limit) break
    }
    return out
  },
}

/** Jobicy — free, no key, remote jobs. */
export const jobicy: Adapter = {
  id: 'jobicy',
  name: 'Jobicy',
  kind: 'keyless',
  available: () => true,

  async search({ q, location, limit, signal }) {
    const url = new URL('https://jobicy.com/api/v2/remote-jobs')
    url.searchParams.set('count', '100')
    // Single simple keyword → let Jobicy do the filtering; otherwise filter locally.
    const useTag = /^[a-z0-9 .+#-]{1,25}$/i.test(q) && q.split(/\s+/).length <= 2
    if (q && useTag) url.searchParams.set('tag', q)

    const res = await fetch(url, { signal, headers: { accept: 'application/json' } })
    if (!res.ok) throw new Error(`Jobicy HTTP ${res.status}`)

    const data = (await res.json()) as { jobs?: Record<string, unknown>[] }
    let jobs = Array.isArray(data.jobs) ? data.jobs : []
    if (!useTag && q) jobs = jobs.filter((j) => matchesQuery(`${j.jobTitle} ${j.description ?? ''}`, q))
    if (location) {
      const loc = location.toLowerCase()
      jobs = jobs.filter((j) => {
        const geo = String(j.jobGeo ?? '').toLowerCase()
        return !geo || geo.includes(loc) || loc.includes(geo) || /worldwide|anywhere/.test(geo)
      })
    }

    return jobs.slice(0, limit).map((j): RawJob => {
      const min = Number(j.annualSalaryMin) || 0
      const max = Number(j.annualSalaryMax) || 0
      const currency = String(j.salaryCurrency ?? '')
      const salary = min || max
        ? `${min ? currency + ' ' + min.toLocaleString() : ''}${min && max ? ' – ' : ''}${max ? currency + ' ' + max.toLocaleString() : ''}`.trim()
        : null
      return {
        title: String(j.jobTitle ?? ''),
        company: String(j.companyName ?? ''),
        location: String(j.jobGeo || 'Worldwide'),
        url: String(j.url ?? ''),
        description: String(j.jobDescription ?? j.jobExcerpt ?? ''),
        salary,
        contract: String(j.jobType ?? '') || null,
        remote: true,
        postedAt: (j.pubDate as string) ?? (j.publicationDate as string) ?? null,
        category: String(j.jobIndustry ?? '') || null,
      }
    })
  },
}
