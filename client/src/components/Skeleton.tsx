export default function SkeletonCard() {
  return (
    <div className="card animate-pulse p-4">
      <div className="flex gap-3">
        <div className="h-12 w-12 shrink-0 rounded-lg bg-line" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-4 w-2/3 rounded bg-line" />
          <div className="h-3 w-1/3 rounded bg-line" />
          <div className="h-3 w-1/2 rounded bg-line" />
          <div className="flex gap-1.5 pt-1">
            <div className="h-5 w-20 rounded-full bg-line" />
            <div className="h-5 w-24 rounded-full bg-line" />
            <div className="h-5 w-16 rounded-full bg-line" />
          </div>
        </div>
      </div>
    </div>
  )
}
