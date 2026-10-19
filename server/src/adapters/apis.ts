import type { Adapter, RawJob } from './types'

const env = (k: string) => process.env[k] || ''

/** "17 hours ago" / "3 days ago" → ISO */
function relDate(value: unknown): string | null {
  const s = String(value ?? '')
  const m = s.match(/(\d+)\s*(minute|hour|day|week|month|year)s?\s*ago/i)
  if (!m) return /^\d{4}-\d{2}-\d{2}/.test(s) ? s : null
  const n = Number(m[1])
  const unit = m[2].toLowerCase()
  const ms: Record<string, number> = {
    minute: 60_000, hour: 3_600_000, day: 86_400_000,
    week: 604_800_000, month: 2_592_000_000, year: 31_536_000_000,
  }
  return new Date(Date.now() - n * (ms[unit] ?? 0)).toISOString()
}

const fmtK = (n: number) =>
  n >= 1000 ? `${Math.round(n / 1000)}k` : String(n)

const rangeSalary = (min?: number | null, max?: number | null, currency = '') => {
  const lo = Number(min) || 0
  const hi = Number(max) || 0
  const c = currency ? `${currency} ` : ''
  if (lo && hi) return `${c}${fmtK(lo)} – ${c}${fmtK(hi)}`
  if (lo) return `from ${c}${fmtK(lo)}`
  if (hi) return `up to ${c}${fmtK(hi)}`
  return null
}

/** Adzuna — free app id/key from adzuna.dev, indexes many boards. */
export const adzuna: Adapter = {
  id: 'adzuna',
  name: 'Adzuna',
  kind: 'api',
  available: () => Boolean(env('ADZUNA_APP_ID') && env('ADZUNA_APP_KEY')),
  reason: () => 'Set ADZUNA_APP_ID + ADZUNA_APP_KEY (free at adzuna.dev)',

  async search({ q, location, limit, signal }) {
    const country = env('ADZUNA_COUNTRY') || 'us'
    const url = new URL(`https://api.adzuna.com/v1/api/jobs/${country}/search/1`)
    url.searchParams.set('app_id', env('ADZUNA_APP_ID'))
    url.searchParams.set('app_key', env('ADZUNA_APP_KEY'))
    if (q) url.searchParams.set('what', q)
    if (location) url.searchParams.set('where', location)
    url.searchParams.set('results_per_page', String(Math.min(limit, 50)))

    const res = await fetch(url, { signal, headers: { accept: 'application/json' } })
    if (!res.ok) throw new Error(`Adzuna HTTP ${res.status}`)

    const data = (await res.json()) as { results?: Record<string, unknown>[] }
    return (data.results ?? []).map((r): RawJob => {
      const company = r.company as { display_name?: string } | undefined
      const loc = r.location as { display_name?: string } | undefined
      return {
        title: String(r.title ?? ''),
        company: String(company?.display_name ?? ''),
        location: String(loc?.display_name ?? ''),
        url: String(r.redirect_url ?? ''),
        description: String(r.description ?? ''),
        salary: rangeSalary(r.salary_min as number, r.salary_max as number),
        postedAt: (r.created as string) ?? null,
        category: String((r.category as { label?: string })?.label ?? '') || null,
      }
    })
  },
}

/** Jooble — free API key from jooble.org/api. */
export const jooble: Adapter = {
  id: 'jooble',
  name: 'Jooble',
  kind: 'api',
  available: () => Boolean(env('JOOBLE_API_KEY')),
  reason: () => 'Set JOOBLE_API_KEY (free at jooble.org/api)',

  async search({ q, location, limit, signal }) {
    const res = await fetch(`https://jooble.org/api/${env('JOOBLE_API_KEY')}`, {
      method: 'POST',
      signal,
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ keywords: q || 'developer', location: location || '' }),
    })
    if (!res.ok) throw new Error(`Jooble HTTP ${res.status}`)

    const data = (await res.json()) as { jobs?: Record<string, unknown>[] }
    return (data.jobs ?? []).slice(0, limit).map((j): RawJob => ({
      title: String(j.title ?? ''),
      company: String(j.company ?? ''),
      location: String(j.city ?? j.location ?? j.region ?? '') || 'Remote',
      url: String(j.url ?? ''),
      description: String(j.snippet ?? ''),
      salary: String(j.salary ?? '') || null,
      contract: String(j.type ?? '') || null,
      postedAt: relDate(j.published),
    }))
  },
}

/** InfoJobs official API (Spain/Europe) — key + secret from developer.infojobs.net */
export const infojobs: Adapter = {
  id: 'infojobs',
  name: 'InfoJobs',
  kind: 'api',
  available: () => Boolean(env('INFOJOBS_KEY') && env('INFOJOBS_SECRET')),
  reason: () => 'Set INFOJOBS_KEY + INFOJOBS_SECRET (developer.infojobs.net)',

  async search({ q, location, limit, signal }) {
    const auth = Buffer.from(`${env('INFOJOBS_KEY')}:${env('INFOJOBS_SECRET')}`).toString('base64')
    const tokenRes = await fetch('https://api.infojobs.net/api/2/oauth/token', {
      method: 'POST',
      signal,
      headers: {
        authorization: `Basic ${auth}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    })
    if (!tokenRes.ok) throw new Error(`InfoJobs auth HTTP ${tokenRes.status}`)
    const tokenData = (await tokenRes.json()) as { access_token?: string }
    if (!tokenData.access_token) throw new Error('InfoJobs auth: no access_token')

    const url = new URL('https://api.infojobs.net/api/2/job')
    if (q) url.searchParams.set('keyword', q)
    if (location) url.searchParams.set('city', location)
    url.searchParams.set('pageSize', String(Math.min(limit, 20)))

    const res = await fetch(url, {
      signal,
      headers: { authorization: `Bearer ${tokenData.access_token}`, accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`InfoJobs HTTP ${res.status}`)

    const data = (await res.json()) as { data?: Record<string, unknown>[] }
    return (data.data ?? []).map((j): RawJob => {
      const company = j.company as { name?: string } | undefined
      const province = j.province as { name?: string } | undefined
      const city = j.city as { name?: string } | undefined
      const work = String(j.workModel ?? '')
      const skills = Array.isArray(j.skills)
        ? (j.skills as { skill?: { name?: string } }[]).map((s) => s.skill?.name).filter(Boolean).join(', ')
        : ''
      const desc = String(j.description ?? j.brief ?? '') ||
        `${j.title ?? ''}${skills ? ` — Skills: ${skills}` : ''}`
      return {
        title: String(j.title ?? ''),
        company: String(company?.name ?? ''),
        location: [city?.name, province?.name].filter(Boolean).join(', '),
        url: String(j.url ?? '') || `https://www.infojobs.net/oferta-de-trabajo/${j.id ?? ''}`,
        description: desc,
        contract: String(j.employmentContract ?? '') || null,
        remote: /teletrabajo|remote|hybrid|hibrido/i.test(work),
        postedAt: (j.posted as string) ?? (j.published as string) ?? null,
        salary: rangeSalary(j.salaryMin as number, j.salaryMax as number),
      }
    })
  },
}

/** Google Jobs data via SerpAPI (covers LinkedIn/Indeed/Glassdoor-ish aggregations). */
export const googlejobs: Adapter = {
  id: 'googlejobs',
  name: 'Google Jobs',
  kind: 'api',
  available: () => Boolean(env('SERPAPI_KEY')),
  reason: () => 'Set SERPAPI_KEY (serpapi.com — free monthly tier)',

  async search({ q, location, limit, signal }) {
    const url = new URL('https://serpapi.com/search.json')
    url.searchParams.set('engine', 'google_jobs')
    url.searchParams.set('q', q || 'software developer jobs')
    if (location) url.searchParams.set('location', location)
    url.searchParams.set('api_key', env('SERPAPI_KEY'))
    url.searchParams.set('num', String(Math.min(limit, 40)))

    const res = await fetch(url, { signal, headers: { accept: 'application/json' } })
    if (!res.ok) throw new Error(`SerpAPI HTTP ${res.status}`)

    const data = (await res.json()) as { jobs_results?: Record<string, unknown>[] }
    return (data.jobs_results ?? []).map((j): RawJob => {
      const ext = (j.detected_extensions ?? {}) as Record<string, unknown>
      const extensions = (j.extensions as string[] | undefined) ?? []
      const salary =
        (typeof ext.salary === 'string' && ext.salary) ||
        extensions.find((x) => /[$€£₹]\s?\d|\d+k\b/i.test(x)) ||
        null
      const contract =
        (typeof ext.schedule === 'string' && ext.schedule) ||
        extensions.find((x) => /full[ -]?time|part[ -]?time|contract|temporary|internship|permanent/i.test(x)) ||
        null
      const posted =
        (typeof ext.posted_date === 'string' && relDate(ext.posted_date)) ||
        extensions.map((x) => relDate(x)).find(Boolean) ||
        null
      return {
        title: String(j.title ?? ''),
        company: String(j.company_name ?? ''),
        location: String(j.location ?? ''),
        url: String(j.share_link ?? j.apply_link ?? '') || null,
        description: String(j.description ?? ''),
        salary,
        contract,
        remote: extensions.some((x) => /remote/i.test(x)) || /remote/i.test(String(j.location ?? '')),
        postedAt: posted,
        category: String(j.via ?? '') || null,
      }
    })
  },
}
