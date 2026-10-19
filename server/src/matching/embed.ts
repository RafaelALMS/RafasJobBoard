import { config } from '../config.ts'
import { getVector, setVector } from '../db.ts'
import { sha1 } from '../adapters/normalize.ts'

const CHUNK = 32
const TIMEOUT_MS = 30_000

export function cosine(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length)
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  if (!na || !nb) return 0
  return dot / Math.sqrt(na * nb)
}

async function embedChunk(inputs: string[]): Promise<number[][]> {
  const res = await fetch(`${config.embedding.baseUrl}/embeddings`, {
    method: 'POST',
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${config.embedding.key}`,
    },
    body: JSON.stringify({ model: config.embedding.model, input: inputs }),
  })
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300)
    throw new Error(`Embeddings HTTP ${res.status}: ${detail}`)
  }
  const data = (await res.json()) as { data?: { embedding: number[]; index: number }[] }
  const items = (data.data ?? []).slice().sort((x, y) => x.index - y.index)
  if (items.length !== inputs.length) {
    throw new Error(`Embeddings: expected ${inputs.length} vectors, got ${items.length}`)
  }
  return items.map((d) => d.embedding)
}

/**
 * Embeds texts with per-text SQLite caching. Individual chunk failures leave
 * nulls behind instead of throwing, so ranking degrades to local scoring.
 */
export async function embedTexts(
  texts: string[],
  cacheScope: string,
): Promise<(number[] | null)[]> {
  const keys = texts.map((t) => sha1(`${cacheScope}|${config.embedding.model}|${t}`))
  const out: (number[] | null)[] = keys.map((k) => getVector(k))

  const missing: number[] = []
  out.forEach((v, i) => {
    if (!v) missing.push(i)
  })

  for (let i = 0; i < missing.length; i += CHUNK) {
    const batch = missing.slice(i, i + CHUNK)
    try {
      const vectors = await embedChunk(batch.map((idx) => texts[idx]))
      batch.forEach((idx, k) => {
        out[idx] = vectors[k]
        setVector(keys[idx], vectors[k])
      })
    } catch (err) {
      console.warn('[embed]', err instanceof Error ? err.message : err)
    }
  }
  return out
}
