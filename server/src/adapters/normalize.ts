import { createHash } from 'node:crypto'
import sanitizeHtml from 'sanitize-html'
import type { Job } from '@shared'
import type { RawJob } from './types'

export const sha1 = (input: string) => createHash('sha1').update(input).digest('hex')

const cleanText = (v: unknown, max = 300): string =>
  String(v ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)

export const stripHtml = (html: string): string =>
  cleanText(
    String(html ?? '')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'"),
    100_000,
  )

const sanitizeDescription = (html: string): string => {
  const clean = sanitizeHtml(html, {
    allowedTags: ['p', 'br', 'ul', 'ol', 'li', 'strong', 'b', 'em', 'i', 'a', 'h3', 'h4', 'blockquote'],
    allowedAttributes: { a: ['href'] },
    allowedSchemes: ['http', 'https', 'mailto'],
  })
  return clean.replace(/\n{3,}/g, '\n\n').trim().slice(0, 20_000)
}

/** Accepts ISO strings, unix seconds or unix ms. */
export function normalizeDate(value: unknown): string | null {
  if (value == null || value === '') return null
  if (typeof value === 'number' || /^\d{9,13}$/.test(String(value))) {
    const n = Number(value)
    const ms = n < 1e12 ? n * 1000 : n
    const d = new Date(ms)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  const parsed = Date.parse(String(value))
  if (Number.isNaN(parsed)) return null
  // Guard against nonsense dates far in the future
  return new Date(Math.min(parsed, Date.now() + 86_400_000)).toISOString()
}

const REMOTE_RE = /\b(remote|work from home|wfh|telecommut|distributed|anywhere)\b/i

export function normalize(source: string, raw: RawJob): Job | null {
  const title = cleanText(raw.title)
  if (!title) return null
  const company = cleanText(raw.company) || 'Unknown company'
  const location = cleanText(raw.location) || (raw.remote ? 'Remote' : '')
  const url = String(raw.url ?? '').trim()
  const key = sha1(url || `${title}|${company}`).slice(0, 20)
  const description = sanitizeDescription(String(raw.description ?? ''))
  const remote =
    typeof raw.remote === 'boolean'
      ? raw.remote
      : REMOTE_RE.test([title, location, stripHtml(description).slice(0, 400)].join(' '))

  return {
    id: `${source}:${key}`,
    source,
    title,
    company,
    location,
    url,
    description,
    salary: cleanText(raw.salary, 120) || null,
    contract: cleanText(raw.contract, 80) || null,
    remote,
    postedAt: normalizeDate(raw.postedAt),
    category: cleanText(raw.category, 80) || null,
    score: null,
    favorite: false,
    analysis: null,
  }
}

/** Cross-source duplicate key: same role at same company. */
export function dedupeKey(job: Job): string {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  return `${norm(job.title)}|${norm(job.company)}`
}

/** True when every whitespace-separated token appears in the haystack. */
export function matchesQuery(haystack: string, q: string): boolean {
  const tokens = q.toLowerCase().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return true
  const hay = haystack.toLowerCase()
  return tokens.length <= 2
    ? tokens.every((t) => hay.includes(t))
    : tokens.some((t) => hay.includes(t))
}
