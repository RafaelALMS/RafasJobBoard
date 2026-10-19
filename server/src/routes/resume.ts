import type { FastifyInstance } from 'fastify'
import type { ResumeProfile, Seniority } from '@shared'
import { clearProfile, getProfile, publicProfile, saveProfile } from '../db.ts'
import { extractPdfText } from '../resume/extract.ts'
import { parseProfile } from '../resume/profile.ts'

const SENIORITY_VALUES = new Set<Seniority>([
  'junior', 'mid', 'senior', 'lead', 'principal', 'manager', 'director',
])

const asStringList = (v: unknown, cap: number): string[] =>
  Array.isArray(v)
    ? [...new Set(v.map((x) => String(x ?? '').trim()).filter(Boolean))].slice(0, cap)
    : []

const asNullableString = (v: unknown, cap: number): string | null => {
  if (typeof v !== 'string') return null
  const s = v.trim().slice(0, cap)
  return s || null
}

export async function registerResumeRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/resume', async () => ({ profile: publicProfile(getProfile()) }))

  // Upload a PDF resume → extract text → parse profile
  app.post('/api/resume', async (req, reply) => {
    let file
    try {
      file = await req.file()
    } catch {
      reply.code(400)
      return { error: 'Expected a multipart/form-data upload with a "resume" file.' }
    }
    if (!file) {
      reply.code(400)
      return { error: 'No file received.' }
    }

    const buffer = await file.toBuffer()
    const isPdf = file.mimetype === 'application/pdf' || /\.pdf$/i.test(file.filename ?? '')
    if (!isPdf) {
      reply.code(415)
      return { error: 'Please upload a PDF file.' }
    }
    if (buffer.length === 0) {
      reply.code(422)
      return { error: 'The file is empty.' }
    }

    let text = ''
    try {
      text = await extractPdfText(buffer)
    } catch (err) {
      console.warn('[resume] PDF extraction failed:', err instanceof Error ? err.message : err)
      reply.code(422)
      return { error: 'Could not read this PDF. Make sure it is a regular (text) PDF, not a scan.' }
    }
    if (text.replace(/\s+/g, '').length < 40) {
      reply.code(422)
      return { error: 'No text found in this PDF — scanned/image-only PDFs are not supported.' }
    }

    const profile = parseProfile(text)
    saveProfile(profile)
    return { profile: publicProfile(profile) }
  })

  // Edit extracted fields (skills, seniority, location, …)
  app.patch<{ Body: Record<string, unknown> }>('/api/resume', async (req, reply) => {
    const existing = getProfile()
    const body = req.body ?? {}
    if (!existing && typeof body.rawText !== 'string') {
      reply.code(404)
      return { error: 'No resume uploaded yet.' }
    }

    const seniority = asNullableString(body.seniority, 20) as Seniority | null
    const yearsRaw = body.years
    const years =
      yearsRaw === null || yearsRaw === undefined || yearsRaw === ''
        ? null
        : Math.max(0, Math.min(50, Math.round(Number(yearsRaw))))

    const merged: ResumeProfile = {
      name: asNullableString(body.name, 120) ?? existing?.name ?? null,
      email: asNullableString(body.email, 200) ?? existing?.email ?? null,
      skills: body.skills !== undefined ? asStringList(body.skills, 60) : (existing?.skills ?? []),
      years: Number.isFinite(years as number) ? (years as number) : (existing?.years ?? null),
      seniority:
        body.seniority !== undefined
          ? seniority && SENIORITY_VALUES.has(seniority)
            ? seniority
            : null
          : (existing?.seniority ?? null),
      languages:
        body.languages !== undefined ? asStringList(body.languages, 30) : (existing?.languages ?? []),
      location:
        body.location !== undefined ? asNullableString(body.location, 120) : (existing?.location ?? null),
      remote: typeof body.remote === 'boolean' ? body.remote : (existing?.remote ?? false),
      rawText:
        typeof body.rawText === 'string' ? body.rawText : (existing?.rawText ?? ''),
      updatedAt: Date.now(),
    }

    saveProfile(merged)
    return { profile: publicProfile(merged) }
  })

  app.delete('/api/resume', async () => {
    clearProfile()
    return { ok: true }
  })
}
