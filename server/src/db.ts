import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type { Job, MatchAnalysis, PublicProfile, ResumeProfile } from '@shared'
import { config } from './config.ts'

fs.mkdirSync(config.dataDir, { recursive: true })

const db = new DatabaseSync(path.join(config.dataDir, 'jobmatch.db'))

db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS jobs (
    id          TEXT PRIMARY KEY,
    source      TEXT NOT NULL,
    title       TEXT NOT NULL,
    company     TEXT NOT NULL DEFAULT '',
    location    TEXT NOT NULL DEFAULT '',
    url         TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    salary      TEXT,
    contract    TEXT,
    remote      INTEGER NOT NULL DEFAULT 0,
    posted_at   TEXT,
    category    TEXT,
    fetched_at  INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS favorites (
    job_id     TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS vectors (
    cache_key  TEXT PRIMARY KEY,
    vector     TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS analysis (
    job_id       TEXT NOT NULL,
    profile_hash TEXT NOT NULL,
    data         TEXT NOT NULL,
    created_at   INTEGER NOT NULL,
    PRIMARY KEY (job_id, profile_hash)
  );
  CREATE TABLE IF NOT EXISTS profile (
    id         INTEGER PRIMARY KEY CHECK (id = 1),
    data       TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
`)

const bool = (v: unknown) => (v ? 1 : 0)

// ── Jobs ────────────────────────────────────────────────────────────

export function saveJobs(jobs: Job[]): void {
  const stmt = db.prepare(`
    INSERT INTO jobs (id, source, title, company, location, url, description, salary,
                      contract, remote, posted_at, category, fetched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      source = excluded.source, title = excluded.title, company = excluded.company,
      location = excluded.location, url = excluded.url, description = excluded.description,
      salary = excluded.salary, contract = excluded.contract, remote = excluded.remote,
      posted_at = excluded.posted_at, category = excluded.category, fetched_at = excluded.fetched_at
  `)
  const now = Date.now()
  db.exec('BEGIN')
  try {
    for (const j of jobs) {
      stmt.run(
        j.id, j.source, j.title, j.company, j.location, j.url, j.description,
        j.salary, j.contract, bool(j.remote), j.postedAt, j.category, now,
      )
    }
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

function rowToJob(row: Record<string, unknown>, favorite: boolean): Job {
  return {
    id: String(row.id),
    source: String(row.source),
    title: String(row.title),
    company: String(row.company ?? ''),
    location: String(row.location ?? ''),
    url: String(row.url ?? ''),
    description: String(row.description ?? ''),
    salary: (row.salary as string | null) ?? null,
    contract: (row.contract as string | null) ?? null,
    remote: Boolean(row.remote),
    postedAt: (row.posted_at as string | null) ?? null,
    category: (row.category as string | null) ?? null,
    score: null,
    favorite,
    analysis: null,
  }
}

export function getJob(id: string): Job | null {
  const row = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined
  if (!row) return null
  const fav = db.prepare('SELECT 1 FROM favorites WHERE job_id = ?').get(id)
  return rowToJob(row, Boolean(fav))
}

export function getFavoriteIds(): Set<string> {
  const rows = db.prepare('SELECT job_id FROM favorites').all() as Record<string, unknown>[]
  return new Set(rows.map((r) => String(r.job_id)))
}

export function toggleFavorite(id: string): boolean {
  const existing = db.prepare('SELECT 1 FROM favorites WHERE job_id = ?').get(id)
  if (existing) {
    db.prepare('DELETE FROM favorites WHERE job_id = ?').run(id)
    return false
  }
  db.prepare('INSERT INTO favorites (job_id, created_at) VALUES (?, ?)').run(id, Date.now())
  return true
}

export function listFavorites(): Job[] {
  const rows = db.prepare(`
    SELECT j.*, 1 AS fav FROM jobs j
    INNER JOIN favorites f ON f.job_id = j.id
    ORDER BY f.created_at DESC
  `).all() as Record<string, unknown>[]
  return rows.map((r) => rowToJob(r, true))
}

// ── Embedding cache ─────────────────────────────────────────────────

export function getVector(cacheKey: string): number[] | null {
  const row = db.prepare('SELECT vector FROM vectors WHERE cache_key = ?').get(cacheKey) as
    | { vector: string }
    | undefined
  if (!row) return null
  try {
    const parsed = JSON.parse(row.vector)
    return Array.isArray(parsed) ? (parsed as number[]) : null
  } catch {
    return null
  }
}

export function setVector(cacheKey: string, vector: number[]): void {
  db.prepare(
    'INSERT OR REPLACE INTO vectors (cache_key, vector, created_at) VALUES (?, ?, ?)',
  ).run(cacheKey, JSON.stringify(vector), Date.now())
}

// ── Match analysis cache ────────────────────────────────────────────

export function getAnalysis(jobId: string, profileHash: string): MatchAnalysis | null {
  const row = db.prepare(
    'SELECT data FROM analysis WHERE job_id = ? AND profile_hash = ?',
  ).get(jobId, profileHash) as { data: string } | undefined
  if (!row) return null
  try {
    return JSON.parse(row.data) as MatchAnalysis
  } catch {
    return null
  }
}

export function setAnalysis(jobId: string, profileHash: string, data: MatchAnalysis): void {
  db.prepare(`
    INSERT OR REPLACE INTO analysis (job_id, profile_hash, data, created_at) VALUES (?, ?, ?, ?)
  `).run(jobId, profileHash, JSON.stringify(data), Date.now())
}

export function deleteAnalysis(jobId: string, profileHash: string): void {
  db.prepare('DELETE FROM analysis WHERE job_id = ? AND profile_hash = ?').run(jobId, profileHash)
}

// ── Profile (single user, single row) ───────────────────────────────

export function getProfile(): ResumeProfile | null {
  const row = db.prepare('SELECT data FROM profile WHERE id = 1').get() as
    | { data: string }
    | undefined
  if (!row) return null
  try {
    return JSON.parse(row.data) as ResumeProfile
  } catch {
    return null
  }
}

export function saveProfile(profile: ResumeProfile): void {
  db.prepare(`
    INSERT INTO profile (id, data, updated_at) VALUES (1, ?, ?)
    ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
  `).run(JSON.stringify(profile), Date.now())
}

export function clearProfile(): void {
  db.prepare('DELETE FROM profile WHERE id = 1').run()
}

export function publicProfile(profile: ResumeProfile | null): PublicProfile | null {
  if (!profile) return null
  const { rawText: _raw, ...rest } = profile
  return rest
}
