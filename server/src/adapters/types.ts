import type { SourceKind } from '@shared'

/** What every adapter returns before normalization. */
export interface RawJob {
  title: string
  company?: string | null
  location?: string | null
  url?: string | null
  description?: string | null
  salary?: string | null
  contract?: string | null
  remote?: boolean | null
  /** ISO date, unix seconds or unix ms */
  postedAt?: string | number | null
  category?: string | null
}

export interface SearchArgs {
  q: string
  location: string
  remote: boolean
  limit: number
  signal: AbortSignal
}

export interface Adapter {
  id: string
  name: string
  kind: SourceKind
  available(): boolean
  reason?(): string
  search(args: SearchArgs): Promise<RawJob[]>
}
