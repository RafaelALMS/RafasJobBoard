// Shared domain types and tiny pure helpers used by both client and server.

export type Seniority = 'junior' | 'mid' | 'senior' | 'lead' | 'principal' | 'manager' | 'director'

export interface MatchBreakdown {
  skills: number
  seniority: number
  location: number
  salary: number
  domain: number
}

export interface MatchAnalysis {
  score: number
  breakdown: MatchBreakdown
  matched: string[]
  gaps: string[]
  verdict: string
}

export interface Job {
  id: string
  source: string
  title: string
  company: string
  location: string
  url: string
  description: string // sanitized HTML
  salary: string | null
  contract: string | null
  remote: boolean
  postedAt: string | null // ISO date
  category: string | null
  score: number | null // 0-100, null when no resume uploaded
  favorite: boolean
  analysis: MatchAnalysis | null
}

export interface ResumeProfile {
  name: string | null
  email: string | null
  skills: string[]
  years: number | null
  seniority: Seniority | null
  languages: string[]
  location: string | null
  remote: boolean
  rawText: string
  updatedAt: number | null
}

/** Profile as sent over the wire (rawText stripped — server-only detail). */
export type PublicProfile = Omit<ResumeProfile, 'rawText'>

export type SourceKind = 'keyless' | 'api' | 'mock' | 'scraper'

export interface SourceInfo {
  id: string
  name: string
  kind: SourceKind
  available: boolean
  reason?: string
}

export type SourceStatus = 'ok' | 'error' | 'timeout' | 'disabled'

export interface SourceResult {
  id: string
  name: string
  status: SourceStatus
  count: number
  error?: string
}

export interface SearchResponse {
  jobs: Job[]
  sources: SourceResult[]
  profile: PublicProfile | null
  tookMs: number
}

export const SENIORITY_ORDER: Record<Seniority, number> = {
  junior: 0,
  mid: 1,
  senior: 2,
  lead: 3,
  principal: 4,
  manager: 3,
  director: 4,
}

export const SENIORITY_LABELS: Record<Seniority, string> = {
  junior: 'Junior',
  mid: 'Mid-level',
  senior: 'Senior',
  lead: 'Lead',
  principal: 'Principal / Staff',
  manager: 'Manager',
  director: 'Director+',
}

/** Best-effort seniority detection from a job title (null = unknown/mid). */
export function jobLevelFromTitle(title: string): Seniority | null {
  const t = title.toLowerCase()
  if (/\b(principal|staff engineer|distinguished)\b/.test(t)) return 'principal'
  if (/\b(director|head of|vice president|\bvp\b|chief|cto|cio)\b/.test(t)) return 'director'
  if (/\b(eng(ineering)? manager|team manager|product manager|project manager)\b/.test(t)) return 'manager'
  if (/\b(lead|tech lead|team lead|guild lead)\b/.test(t)) return 'lead'
  if (/\b(senior|\bsr\.?|sr )\b/.test(t)) return 'senior'
  if (/\b(junior|\bjr\.?|intern(ship)?|trainee|graduate|entry[ -]level)\b/.test(t)) return 'junior'
  if (/\bmid[ -]?level\b/.test(t)) return 'mid'
  return null
}

export type ScoreTone = 'good' | 'warn' | 'bad' | 'none'

export function scoreTone(score: number | null | undefined): ScoreTone {
  if (score == null || Number.isNaN(score)) return 'none'
  if (score >= 75) return 'good'
  if (score >= 50) return 'warn'
  return 'bad'
}

export const TONE_TEXT: Record<ScoreTone, string> = {
  good: 'text-good',
  warn: 'text-warn',
  bad: 'text-bad',
  none: 'text-muted',
}

export const TONE_BG: Record<ScoreTone, string> = {
  good: 'bg-good/10 border-good/40',
  warn: 'bg-warn/10 border-warn/40',
  bad: 'bg-bad/10 border-bad/40',
  none: 'bg-surface border-line',
}

export function formatDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const diff = Date.now() - d.getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days}d ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return d.toLocaleDateString()
}
