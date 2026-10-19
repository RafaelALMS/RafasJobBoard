import { useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useProfile } from '../profile'

function ThemeToggle() {
  const [dark, setDark] = useState(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
  )

  const toggle = () => {
    const next = !dark
    document.documentElement.classList.toggle('dark', next)
    try {
      localStorage.setItem('jm-theme', next ? 'dark' : 'light')
    } catch {
      /* storage unavailable */
    }
    setDark(next)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}
      className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-surface text-muted transition hover:border-accent hover:text-accent"
    >
      {dark ? (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  )
}

export default function Header() {
  const { profile, upload } = useProfile()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const location = useLocation()
  const onHome = location.pathname === '/'

  const handleFile = async (file: File | undefined | null) => {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      await upload(file)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      window.setTimeout(() => setError(null), 6000)
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
        <Link to="/" className="flex items-center gap-2" aria-label="JobMatch home">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-sm font-bold text-white">J</span>
          <span className="text-sm font-semibold tracking-tight">JobMatch</span>
        </Link>

        {!onHome && (
          <Link to="/" className="text-sm text-muted transition hover:text-accent">
            ← Results
          </Link>
        )}

        <div className="flex-1" />

        {error && (
          <span className="max-w-[180px] truncate text-xs text-bad sm:max-w-[340px]" title={error}>
            {error}
          </span>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-60 ${
            profile
              ? 'border-accent/40 bg-accent/10 text-accent hover:bg-accent/15'
              : 'border-line bg-surface hover:border-accent hover:text-accent'
          }`}
        >
          {busy ? 'Reading PDF…' : profile ? '✓ Resume · replace' : 'Upload resume'}
        </button>

        <ThemeToggle />

        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
      </div>
    </header>
  )
}
