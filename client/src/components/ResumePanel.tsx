import { useRef, useState, type KeyboardEvent } from 'react'
import { SENIORITY_LABELS, type Seniority } from '@shared'
import { useProfile } from '../profile'

const SENIORITY_OPTIONS = Object.entries(SENIORITY_LABELS) as [Seniority, string][]

function Chip({
  label,
  tone,
  onRemove,
}: {
  label: string
  tone: 'accent' | 'muted'
  onRemove: () => void
}) {
  const styles =
    tone === 'accent'
      ? 'border-accent/30 bg-accent/10 text-accent'
      : 'border-line bg-bg text-muted'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${styles}`}>
      {label}
      <button
        type="button"
        aria-label={`Remove ${label}`}
        onClick={onRemove}
        className="rounded-full px-0.5 leading-none opacity-70 transition hover:opacity-100"
      >
        ×
      </button>
    </span>
  )
}

function ChipEditor({
  items,
  onChange,
  placeholder,
  tone,
}: {
  items: string[]
  onChange: (next: string[]) => void
  placeholder: string
  tone: 'accent' | 'muted'
}) {
  const [draft, setDraft] = useState('')

  const add = () => {
    const value = draft.trim()
    if (!value) return
    if (!items.some((i) => i.toLowerCase() === value.toLowerCase())) {
      onChange([...items, value])
    }
    setDraft('')
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      add()
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {items.map((item) => (
        <Chip
          key={item}
          label={item}
          tone={tone}
          onRemove={() => onChange(items.filter((i) => i !== item))}
        />
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={add}
        placeholder={placeholder}
        className="w-28 rounded-full border border-line bg-bg px-2.5 py-1 text-xs outline-none transition focus:border-accent"
      />
    </div>
  )
}

const inputCls =
  'w-full rounded-lg border border-line bg-bg px-2.5 py-1.5 text-sm outline-none transition focus:border-accent'

export default function ResumePanel() {
  const { profile, loading, upload, patch, remove } = useProfile()
  const fileRef = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const doUpload = async (file?: File | null) => {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      await upload(file)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that PDF')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const save = (patchBody: Record<string, unknown>) => {
    setError(null)
    patch(patchBody).catch((err: unknown) =>
      setError(err instanceof Error ? err.message : 'Save failed'),
    )
  }

  const fileInput = (
    <input
      ref={fileRef}
      type="file"
      accept="application/pdf,.pdf"
      className="hidden"
      onChange={(e) => void doUpload(e.target.files?.[0])}
    />
  )

  if (loading) {
    return (
      <section className="card p-4 text-sm text-muted">
        <div className="h-4 w-28 animate-pulse rounded bg-line" />
      </section>
    )
  }

  if (!profile) {
    return (
      <section className="card p-4">
        <h2 className="text-sm font-semibold">Your resume</h2>
        <p className="mb-3 mt-1 text-xs text-muted">
          Parsed locally — used only to rank jobs on this machine.
        </p>
        <div
          role="button"
          tabIndex={0}
          onClick={() => fileRef.current?.click()}
          onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDrag(true)
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDrag(false)
            void doUpload(e.dataTransfer.files?.[0])
          }}
          className={`cursor-pointer rounded-xl border-2 border-dashed px-4 py-6 text-center text-sm transition ${
            drag
              ? 'border-accent bg-accent/10 text-accent'
              : 'border-line text-muted hover:border-accent/70 hover:text-accent'
          }`}
        >
          {busy ? (
            <span className="animate-pulse">Reading your PDF…</span>
          ) : (
            <>
              Drop your <strong>PDF</strong> resume here
              <br />
              <span className="text-xs">or click to browse</span>
            </>
          )}
        </div>
        {error && <p className="mt-2 text-xs text-bad">{error}</p>}
        {fileInput}
      </section>
    )
  }

  const panel = (
    <section className="card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Your resume</h2>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-md border border-line px-2 py-1 text-[11px] text-muted transition hover:border-accent hover:text-accent"
          >
            {busy ? 'Reading…' : 'Replace'}
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Remove the uploaded resume?')) void remove()
            }}
            className="rounded-md border border-line px-2 py-1 text-[11px] text-muted transition hover:border-bad hover:text-bad"
          >
            Remove
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <label className="col-span-2 block text-xs text-muted">
            Name
            <input
              value={profile.name ?? ''}
              placeholder="Your name"
              onChange={(e) => save({ name: e.target.value })}
              className={`${inputCls} mt-1`}
            />
          </label>
          <label className="block text-xs text-muted">
            Seniority
            <select
              value={profile.seniority ?? ''}
              onChange={(e) => save({ seniority: e.target.value || null })}
              className={`${inputCls} mt-1`}
            >
              <option value="">Unknown</option>
              {SENIORITY_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-muted">
            Years exp.
            <input
              type="number"
              min={0}
              max={50}
              value={profile.years ?? ''}
              placeholder="—"
              onChange={(e) => save({ years: e.target.value === '' ? null : Number(e.target.value) })}
              className={`${inputCls} mt-1`}
            />
          </label>
        </div>

        <label className="block text-xs text-muted">
          Location
          <input
            value={profile.location ?? ''}
            placeholder="City, Country"
            onChange={(e) => save({ location: e.target.value })}
            className={`${inputCls} mt-1`}
          />
        </label>

        <label className="flex items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            checked={profile.remote}
            onChange={(e) => save({ remote: e.target.checked })}
          />
          Open to remote work
        </label>

        <div>
          <p className="mb-1.5 text-xs text-muted">
            Skills <span className="opacity-70">({profile.skills.length})</span>
          </p>
          <ChipEditor
            items={profile.skills}
            onChange={(next) => save({ skills: next })}
            placeholder="+ add skill"
            tone="accent"
          />
        </div>

        <div>
          <p className="mb-1.5 text-xs text-muted">Languages</p>
          <ChipEditor
            items={profile.languages}
            onChange={(next) => save({ languages: next })}
            placeholder="+ add language"
            tone="muted"
          />
        </div>

        {profile.email && (
          <p className="truncate text-xs text-muted" title={profile.email}>
            {profile.email}
          </p>
        )}
        {error && <p className="text-xs text-bad">{error}</p>}
      </div>
      {fileInput}
    </section>
  )

  return panel
}
