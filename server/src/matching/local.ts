import type { Job, MatchBreakdown, ResumeProfile } from '@shared'
import { SENIORITY_ORDER, jobLevelFromTitle } from '@shared'
import { stripHtml } from '../adapters/normalize'
import { findSkills } from '../resume/profile'

const STOPWORDS = new Set(
  `a about above after again against all am an and any are as at be because been before being below
   between both but by can cannot could did do does doing done down during each few for from further
   had has have having he her here hers herself him himself his how i if in into is it its itself just
   let me more most must my myself no nor not of off on once only or other ought our ours ourselves out
   over own same shall she should so some such than that the their theirs them themselves then there
   these they this those through to too under until up very was we were what when where which while
   who whom why will with would you your yours yourself yourselves also per via etc using use work
   works role roles job jobs position positions team teams company companies year years experience
   skills skill knowledge strong good excellent new across within look looking seeking help helps
   looking ideal youll weve youll e g etc including include includes able ensure within
   `.split(/\s+/).filter(Boolean),
)

export function tokenize(text: string, cap = 120): Map<string, number> {
  const counts = new Map<string, number>()
  const words = text
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .filter((w) => w.length > 2 && w.length < 25 && !STOPWORDS.has(w) && !/^\d+(\.\d+)?$/.test(w))
  for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1)
  if (counts.size > cap) {
    return new Map([...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, cap))
  }
  return counts
}

/** Cosine similarity between two term-frequency maps. */
function overlap(a: Map<string, number>, b: Map<string, number>): number {
  let inter = 0
  let na = 0
  let nb = 0
  for (const v of a.values()) na += v * v
  for (const v of b.values()) nb += v * v
  for (const [k, v] of a) {
    const w = b.get(k)
    if (w) inter += v * w
  }
  if (!na || !nb) return 0
  return inter / Math.sqrt(na * nb)
}

function computeLocationFit(profile: ResumeProfile, job: Job): number {
  const jobLoc = job.location.toLowerCase()
  if (!profile.location || profile.location === 'Remote') {
    if (profile.remote) return job.remote ? 1 : 0.5
    return 0.65
  }
  if (!jobLoc) return 0.6
  if (job.remote && profile.remote) return 0.95
  const p = profile.location.toLowerCase()
  if (jobLoc.includes(p) || p.includes(jobLoc)) return 1
  if (/worldwide|anywhere|remote|\bglobal\b/.test(jobLoc)) return 0.9
  const tokens = p.split(/[^a-zà-ÿ0-9]+/).filter((t) => t.length > 2 && !['usa', 'kingdom'].includes(t))
  if (tokens.some((t) => jobLoc.includes(t))) return 0.95
  return 0.15
}

export interface LocalMatch {
  score: number
  breakdown: MatchBreakdown
  matched: string[]
  gaps: string[]
  verdict: string
}

/** Builds a reusable job→score matcher for one resume profile. */
export function createMatcher(profile: ResumeProfile): (job: Job) => LocalMatch {
  const profileSkillSet = new Set(profile.skills.map((s) => s.toLowerCase()))
  const profileTerms = tokenize(`${profile.skills.join(' ')} ${profile.rawText}`.slice(0, 12_000))

  return (job: Job): LocalMatch => {
    const jobText = `${job.title} ${job.category ?? ''} ${stripHtml(job.description)}`.slice(0, 30_000)
    const jobSkillNames = findSkills(jobText).slice(0, 50)
    const jobSkillSet = new Set(jobSkillNames.map((s) => s.toLowerCase()))

    const matched = profile.skills.filter((s) => jobSkillSet.has(s.toLowerCase()))
    const missing = jobSkillNames.filter((s) => !profileSkillSet.has(s)).slice(0, 4)

    let skillsFit: number
    if (profile.skills.length && jobSkillNames.length) {
      const precision = matched.length / jobSkillNames.length
      const recall = matched.length / profile.skills.length
      skillsFit = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0
    } else {
      skillsFit = 0.45 // not enough signal either way
    }

    const termFit = overlap(profileTerms, tokenize(jobText))

    const pLevel = profile.seniority
    const jLevel = jobLevelFromTitle(job.title)
    let seniorityFit = 0.6
    const levelDiff = pLevel && jLevel ? Math.abs(SENIORITY_ORDER[pLevel] - SENIORITY_ORDER[jLevel]) : null
    if (levelDiff !== null) seniorityFit = levelDiff === 0 ? 1 : levelDiff === 1 ? 0.7 : 0.35

    const locationFit = computeLocationFit(profile, job)
    const salaryFit = 0.5 // no salary expectation in the profile yet
    const domainFit = Math.min(1, overlap(profileTerms, tokenize(job.title)) * 4)

    const breakdown: MatchBreakdown = {
      skills: Math.round(skillsFit * 100),
      seniority: Math.round(seniorityFit * 100),
      location: Math.round(locationFit * 100),
      salary: Math.round(salaryFit * 100),
      domain: Math.round(domainFit * 100),
    }

    // Gentle monotonic curve so local-only scores land in a realistic range
    // (raw weighted sums top out around 60-70 for strong matches).
    const raw =
      0.4 * skillsFit +
      0.2 * termFit +
      0.15 * seniorityFit +
      0.15 * locationFit +
      0.05 * salaryFit +
      0.05 * domainFit
    const calibrated = 0.45 * raw + 0.55 * Math.pow(raw, 0.6)
    const score = Math.round(100 * Math.min(1, calibrated))

    const gaps = [...missing]
    if (levelDiff !== null && levelDiff >= 2) gaps.push(`Level: role reads “${jLevel}”, profile is “${pLevel}”`)
    if (locationFit < 0.4 && job.location) gaps.push(`Location: ${job.location}`)

    const verdict = [
      matched.length
        ? `${matched.length} shared skill${matched.length > 1 ? 's' : ''}: ${matched.slice(0, 3).join(', ')}`
        : 'Few exact skill matches',
      jLevel ? `${jLevel} role` : null,
      locationFit >= 0.9
        ? 'location/remote fit'
        : locationFit < 0.4 && job.location
          ? `job in ${job.location}`
          : null,
    ]
      .filter(Boolean)
      .join(' · ')
      .slice(0, 300)

    return { score, breakdown, matched: matched.slice(0, 8), gaps: gaps.slice(0, 5), verdict }
  }
}
