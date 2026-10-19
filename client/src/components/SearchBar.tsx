import type { FormEvent } from 'react'

interface Props {
  q: string
  location: string
  remote: boolean
  loading: boolean
  onQ: (v: string) => void
  onLocation: (v: string) => void
  onRemote: (v: boolean) => void
  onSubmit: () => void
}

const fieldCls =
  'rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none transition focus:border-accent'

export default function SearchBar({ q, location, remote, loading, onQ, onLocation, onRemote, onSubmit }: Props) {
  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit()
  }

  return (
    <form onSubmit={submit} className="card flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <svg
          viewBox="0 0 24 24"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          value={q}
          onChange={(e) => onQ(e.target.value)}
          placeholder="Role or skills — e.g. senior react developer"
          aria-label="Search keywords"
          className={`${fieldCls} w-full py-2 pl-9`}
        />
      </div>

      <input
        value={location}
        onChange={(e) => onLocation(e.target.value)}
        placeholder="Location"
        aria-label="Location"
        className={`${fieldCls} sm:w-44`}
      />

      <button
        type="button"
        onClick={() => onRemote(!remote)}
        aria-pressed={remote}
        className={`rounded-lg border px-3 py-2 text-sm transition ${
          remote
            ? 'border-accent bg-accent text-white'
            : 'border-line bg-bg text-muted hover:border-accent hover:text-accent'
        }`}
      >
        Remote
      </button>

      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
      >
        {loading ? 'Searching…' : 'Search'}
      </button>
    </form>
  )
}
