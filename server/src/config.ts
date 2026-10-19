import fs from 'node:fs'
import path from 'node:path'

// Repo root: server/src → server → jobmatch
const root = path.resolve(import.meta.dirname, '../..')

// Minimal .env loader (no dependency). Existing env vars win.
const envPath = path.join(root, '.env')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!m) continue
    let value = m[2]
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
      (value.startsWith("'") && value.endsWith("'") && value.length > 1)
    ) {
      value = value.slice(1, -1)
    }
    if (!process.env[m[1]]) process.env[m[1]] = value
  }
}

const num = (v: string | undefined, fallback: number) => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

const stripSlash = (v: string) => v.replace(/\/+$/, '')

const openaiKey = process.env.OPENAI_API_KEY || ''

export const config = {
  root,
  host: process.env.HOST || '127.0.0.1',
  port: num(process.env.PORT, 3001),
  dataDir: process.env.DATA_DIR || path.join(root, 'data'),
  clientDist: path.join(root, 'client', 'dist'),
  sourceTimeoutMs: num(process.env.SOURCE_TIMEOUT_MS, 9000),
  enableMock: process.env.ENABLE_MOCK === '1' || process.env.ENABLE_MOCK === 'true',
  llm: {
    baseUrl: stripSlash(process.env.LLM_BASE_URL || 'https://api.openai.com/v1'),
    key: process.env.LLM_API_KEY || openaiKey,
    model: process.env.LLM_MODEL || 'gpt-4o-mini',
  },
  embedding: {
    baseUrl: stripSlash(process.env.EMBEDDING_BASE_URL || 'https://api.openai.com/v1'),
    key: process.env.EMBEDDING_API_KEY || openaiKey,
    model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
  },
}

export const llmAvailable = () => Boolean(config.llm.key)
export const embeddingsAvailable = () => Boolean(config.embedding.key)
