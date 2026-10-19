import type { Job, SourceInfo, SourceResult } from '@shared'
import { config } from '../config.ts'
import { adzuna, googlejobs, infojobs, jooble } from './apis.ts'
import { arbeitnow, jobicy, remotive } from './keyless.ts'
import { mock } from './mock.ts'
import { glassdoor, indeed, linkedin } from './scrapers.ts'
import type { Adapter } from './types'
import { dedupeKey, normalize } from './normalize.ts'

/** Registry order = priority when deduplicating across sources. */
export const adapters: Adapter[] = [
  mock,
  remotive,
  arbeitnow,
  jobicy,
  adzuna,
  jooble,
  infojobs,
  googlejobs,
  linkedin,
  indeed,
  glassdoor,
]

export function getSourceInfos(): SourceInfo[] {
  return adapters.map((a) => ({
    id: a.id,
    name: a.name,
    kind: a.kind,
    available: a.available(),
    reason: a.available() ? undefined : a.reason?.(),
  }))
}

export interface FanOutArgs {
  q: string
  location: string
  remote: boolean
  sourceIds: string[] | null
  limitPerSource: number
}

export interface FanOutResult {
  jobs: Job[]
  sources: SourceResult[]
}

const MAX_TOTAL = 80

export async function fanOut(args: FanOutArgs): Promise<FanOutResult> {
  const { q, location, remote, sourceIds, limitPerSource } = args

  const selected = adapters.filter((a) =>
    sourceIds ? sourceIds.includes(a.id) : a.available(),
  )

  const settled = await Promise.all(
    selected.map(async (a): Promise<{ result: SourceResult; jobs: Job[] }> => {
      if (!a.available()) {
        return {
          result: { id: a.id, name: a.name, status: 'disabled', count: 0, error: a.reason?.() },
          jobs: [],
        }
      }
      try {
        const raw = await a.search({
          q,
          location,
          remote,
          limit: limitPerSource,
          signal: AbortSignal.timeout(config.sourceTimeoutMs),
        })
        const jobs = raw.map((r) => normalize(a.id, r)).filter((j): j is Job => j !== null)
        return {
          result: { id: a.id, name: a.name, status: 'ok', count: jobs.length },
          jobs,
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        const timedOut =
          (err instanceof Error && err.name === 'TimeoutError') || /timeout|abort/i.test(message)
        return {
          result: {
            id: a.id,
            name: a.name,
            status: timedOut ? 'timeout' : 'error',
            count: 0,
            error: message,
          },
          jobs: [],
        }
      }
    }),
  )

  const seen = new Map<string, Job>()
  for (const { jobs } of settled) {
    for (const job of jobs) {
      const key = dedupeKey(job)
      if (!seen.has(key)) seen.set(key, job)
    }
  }

  return {
    jobs: [...seen.values()].slice(0, MAX_TOTAL),
    sources: settled.map((s) => s.result),
  }
}
