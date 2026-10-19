import type { Job, PublicProfile, SearchResponse, SourceInfo } from '@shared'

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  const data: unknown = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data
        ? String((data as { error?: unknown }).error)
        : `HTTP ${res.status}`
    throw new Error(message)
  }
  return data as T
}

export const api = {
  sources: () => request<{ sources: SourceInfo[] }>('/api/sources'),

  search: (params: {
    q: string
    location: string
    remote: boolean
    sources: string[] | null
    sort: 'match' | 'recent'
  }) => {
    const sp = new URLSearchParams()
    if (params.q) sp.set('q', params.q)
    if (params.location) sp.set('location', params.location)
    if (params.remote) sp.set('remote', 'true')
    if (params.sources) sp.set('sources', params.sources.join(','))
    sp.set('sort', params.sort)
    return request<SearchResponse>(`/api/jobs/search?${sp.toString()}`)
  },

  job: (id: string) => request<Job>(`/api/jobs/${encodeURIComponent(id)}`),

  favorite: (id: string) =>
    request<{ favorite: boolean }>(`/api/jobs/${encodeURIComponent(id)}/favorite`, {
      method: 'POST',
    }),

  analyze: (id: string) =>
    request<Job>(`/api/jobs/${encodeURIComponent(id)}/analyze`, { method: 'POST' }),

  getResume: () => request<{ profile: PublicProfile | null }>('/api/resume'),

  uploadResume: (file: File) => {
    const fd = new FormData()
    fd.append('resume', file)
    return request<{ profile: PublicProfile }>('/api/resume', { method: 'POST', body: fd })
  },

  patchResume: (patch: Record<string, unknown>) =>
    request<{ profile: PublicProfile }>('/api/resume', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    }),

  deleteResume: () => request<{ ok: boolean }>('/api/resume', { method: 'DELETE' }),
}
