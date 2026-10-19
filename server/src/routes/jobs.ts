import type { FastifyInstance } from 'fastify'
import { jobLevelFromTitle } from '@shared'
import type { Job } from '@shared'
import { fanOut, getSourceInfos } from '../adapters/index.ts'
import { getFavoriteIds, getJob, getProfile, publicProfile, saveJobs, toggleFavorite } from '../db.ts'
import { invalidateAnalysis, scoreAndAnalyze } from '../matching/analyze.ts'

const DATE_WINDOWS: Record<string, number> = { '24h': 1, '7d': 7, '30d': 30 }
const LEVELS = new Set(['junior', 'mid', 'senior', 'lead', 'principal', 'manager', 'director'])

export async function registerJobRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/sources', async () => ({ sources: getSourceInfos() }))

  app.get<{ Querystring: Record<string, string | undefined> }>('/api/jobs/search', async (req) => {
    const q = (req.query.q ?? '').trim().slice(0, 200)
    const location = (req.query.location ?? '').trim().slice(0, 120)
    const remote = req.query.remote === 'true' || req.query.remote === '1'
    const level = (req.query.level ?? '').toLowerCase()
    const minScore = Math.max(0, Math.min(100, Number(req.query.minScore) || 0))
    const datePosted = req.query.datePosted ?? ''
    const sort = req.query.sort === 'recent' ? 'recent' : 'match'
    const sources =
      req.query.sources === undefined
        ? null
        : req.query.sources.split(',').map((s) => s.trim()).filter(Boolean)

    const started = Date.now()
    const profile = getProfile()

    const { jobs, sources: sourceResults } = await fanOut({
      q,
      location,
      remote,
      sourceIds: sources && sources.length > 0 ? sources : null,
      limitPerSource: 40,
    })

    saveJobs(jobs)
    const favorites = getFavoriteIds()
    let visible: Job[] = jobs
      .filter((j) => !remote || j.remote)
      .map((j) => ({ ...j, favorite: favorites.has(j.id) }))

    visible = await scoreAndAnalyze(visible, profile)

    if (minScore > 0) visible = visible.filter((j) => (j.score ?? -1) >= minScore)

    const windowDays = DATE_WINDOWS[datePosted]
    if (windowDays) {
      const cutoff = Date.now() - windowDays * 86_400_000
      // null postedAt = just fetched → treat as fresh
      visible = visible.filter((j) => !j.postedAt || Date.parse(j.postedAt) >= cutoff)
    }

    if (level && LEVELS.has(level)) {
      visible = visible.filter((j) => {
        const detected = jobLevelFromTitle(j.title)
        return !detected || detected === level
      })
    }

    visible.sort(
      sort === 'recent'
        ? (a, b) => (b.postedAt ? Date.parse(b.postedAt) : 0) - (a.postedAt ? Date.parse(a.postedAt) : 0)
        : (a, b) => (b.score ?? -1) - (a.score ?? -1),
    )

    return {
      jobs: visible.slice(0, 60),
      sources: sourceResults,
      profile: publicProfile(profile),
      tookMs: Date.now() - started,
    }
  })

  app.get<{ Params: { id: string } }>('/api/jobs/:id', async (req, reply) => {
    const job = getJob(decodeURIComponent(req.params.id))
    if (!job) {
      reply.code(404)
      return { error: 'Job not found — run a new search.' }
    }
    const profile = getProfile()
    const [scored] = await scoreAndAnalyze([job], profile)
    return scored
  })

  app.post<{ Params: { id: string } }>('/api/jobs/:id/favorite', async (req, reply) => {
    const id = decodeURIComponent(req.params.id)
    if (!getJob(id)) {
      reply.code(404)
      return { error: 'Job not found' }
    }
    return { favorite: toggleFavorite(id) }
  })

  /** Clears the cached analysis for this job and recomputes it. */
  app.post<{ Params: { id: string } }>('/api/jobs/:id/analyze', async (req, reply) => {
    const id = decodeURIComponent(req.params.id)
    const job = getJob(id)
    if (!job) {
      reply.code(404)
      return { error: 'Job not found' }
    }
    const profile = getProfile()
    if (profile) invalidateAnalysis(id, profile)
    const [scored] = await scoreAndAnalyze([job], profile)
    return scored
  })
}
