import type { Job, MatchAnalysis, MatchBreakdown, ResumeProfile } from '@shared'
import { embeddingsAvailable, llmAvailable } from '../config.ts'
import { deleteAnalysis, getAnalysis, setAnalysis } from '../db.ts'
import { sha1, stripHtml } from '../adapters/normalize.ts'
import { cosine, embedTexts } from './embed.ts'
import { chatJSON } from './llm.ts'
import { createMatcher } from './local.ts'

const LLM_TOP_N = 12
const EMBEDDING_WEIGHT = 0.55
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n) : s)

/** Changes whenever the resume/profile changes → invalidates all caches. */
export function profileHash(profile: ResumeProfile): string {
  return sha1(
    JSON.stringify([
      profile.skills,
      profile.years,
      profile.seniority,
      profile.location,
      profile.remote,
      profile.languages,
      profile.rawText,
    ]),
  )
}

export function invalidateAnalysis(jobId: string, profile: ResumeProfile): void {
  deleteAnalysis(jobId, profileHash(profile))
}

const byScoreDesc = (a: Job, b: Job) => (b.score ?? -1) - (a.score ?? -1)

function profileEmbeddingText(profile: ResumeProfile): string {
  return clip(
    [
      `Seniority: ${profile.seniority ?? 'unknown'}`,
      `Years of experience: ${profile.years ?? 'unknown'}`,
      `Skills: ${profile.skills.join(', ')}`,
      `Location: ${profile.location ?? 'unknown'}${profile.remote ? ' (open to remote)' : ''}`,
      `Languages: ${profile.languages.join(', ') || 'unknown'}`,
      profile.rawText,
    ].join('\n'),
    4000,
  )
}

function jobEmbeddingText(job: Job): string {
  return clip(
    `${job.title} — ${job.company} (${job.location}${job.remote ? ', remote' : ''})` +
      `${job.category ? ` [${job.category}]` : ''}\n${stripHtml(job.description)}`,
    2400,
  )
}

/**
 * Full pipeline: local keyword scoring for every job → optional embedding
 * ranking → LLM analysis for the top candidates (cached in SQLite).
 * Always returns jobs with score + analysis (heuristic) when a profile exists.
 */
export async function scoreAndAnalyze(jobs: Job[], profile: ResumeProfile | null): Promise<Job[]> {
  if (!profile || jobs.length === 0) return jobs
  const matcher = createMatcher(profile)
  const hash = profileHash(profile)

  let enriched: Job[] = jobs.map((j) => {
    const m = matcher(j)
    const analysis: MatchAnalysis = {
      score: m.score,
      breakdown: m.breakdown,
      matched: m.matched,
      gaps: m.gaps,
      verdict: m.verdict,
    }
    return { ...j, score: m.score, analysis }
  })

  // Semantic ranking via embeddings (optional)
  if (embeddingsAvailable()) {
    try {
      const vectors = await embedTexts(
        [profileEmbeddingText(profile), ...enriched.map(jobEmbeddingText)],
        `profile:${hash}`,
      )
      const profileVector = vectors[0]
      if (profileVector) {
        enriched = enriched.map((j, i) => {
          const vector = vectors[i + 1]
          if (!vector) return j
          const emb = Math.max(0, Math.min(1, cosine(profileVector, vector)))
          const blended = Math.round(
            EMBEDDING_WEIGHT * emb * 100 + (1 - EMBEDDING_WEIGHT) * (j.score ?? 0),
          )
          return {
            ...j,
            score: blended,
            analysis: j.analysis ? { ...j.analysis, score: blended } : j.analysis,
          }
        })
      }
    } catch (err) {
      console.warn('[analyze] embeddings skipped:', err instanceof Error ? err.message : err)
    }
  }

  enriched.sort(byScoreDesc)

  // LLM deep analysis for the strongest candidates (cached)
  if (llmAvailable()) {
    const top = enriched.slice(0, LLM_TOP_N)
    const uncached = top.filter((j) => !getAnalysis(j.id, hash))
    if (uncached.length > 0) {
      try {
        const results = await llmAnalyze(profile, uncached)
        for (const [id, analysis] of results) setAnalysis(id, hash, analysis)
      } catch (err) {
        console.warn('[analyze] LLM analysis skipped:', err instanceof Error ? err.message : err)
      }
    }
    enriched = enriched.map((j) => {
      const cached = getAnalysis(j.id, hash)
      return cached ? { ...j, score: cached.score, analysis: cached } : j
    })
    enriched.sort(byScoreDesc)
  }

  return enriched
}

interface LlmJobResult {
  id: string
  score: number
  breakdown?: Partial<MatchBreakdown>
  matched?: string[]
  gaps?: string[]
  verdict?: string
}

const clampScore = (v: unknown, fallback = 50): number => {
  const n = Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.max(0, Math.min(100, Math.round(n)))
}

const strList = (v: unknown, cap: number): string[] =>
  Array.isArray(v)
    ? v.map((x) => String(x).trim()).filter(Boolean).slice(0, cap)
    : []

async function llmAnalyze(
  profile: ResumeProfile,
  jobs: Job[],
): Promise<Map<string, MatchAnalysis>> {
  const system = `You are an expert technical recruiter and career coach.
You receive one candidate profile and several job postings. Assess EVERY job.

Rules:
- "score": integer 0-100 (90+ excellent fit, 75-89 strong, 50-74 partial, <50 weak).
- "breakdown": skills, seniority, location, salary, domain — each an integer 0-100.
- "matched": 2-6 concrete strengths of THIS candidate for THIS job (specific, not generic praise).
- "gaps": 0-4 concrete missing/risky elements (use an empty array when there are none).
- "verdict": 1-2 honest, specific sentences. No flattery, no filler.
- Respond with ONLY JSON, no markdown, exactly one result per job id:
{"results":[{"id":"...","score":82,"breakdown":{"skills":85,"seniority":80,"location":90,"salary":50,"domain":75},"matched":["..."],"gaps":["..."],"verdict":"..."}]}`

  const user = JSON.stringify({
    profile: {
      name: profile.name,
      yearsOfExperience: profile.years,
      seniority: profile.seniority,
      skills: profile.skills,
      location: profile.location,
      openToRemote: profile.remote,
      languages: profile.languages,
      resumeExcerpt: clip(profile.rawText, 3500),
    },
    jobs: jobs.map((j) => ({
      id: j.id,
      title: j.title,
      company: j.company,
      location: j.location,
      remote: j.remote,
      contract: j.contract,
      salary: j.salary,
      description: clip(stripHtml(j.description), 900),
    })),
  })

  const parsed = await chatJSON<{ results?: LlmJobResult[] }>(system, user)
  const out = new Map<string, MatchAnalysis>()

  for (const r of parsed.results ?? []) {
    if (!r || typeof r.id !== 'string' || !jobs.some((j) => j.id === r.id)) continue
    const breakdown: MatchBreakdown = {
      skills: clampScore(r.breakdown?.skills),
      seniority: clampScore(r.breakdown?.seniority),
      location: clampScore(r.breakdown?.location),
      salary: clampScore(r.breakdown?.salary),
      domain: clampScore(r.breakdown?.domain),
    }
    out.set(r.id, {
      score: clampScore(r.score),
      breakdown,
      matched: strList(r.matched, 6),
      gaps: strList(r.gaps, 5),
      verdict: clip(String(r.verdict ?? '').trim(), 500) || 'No verdict provided.',
    })
  }
  return out
}
