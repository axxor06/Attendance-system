export function SkeletonLine({ className = '' }) {
  return <div className={`skeleton rounded-lg ${className}`} style={{ height: '14px' }} />;
}

export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-line bg-cream p-5 shadow-[0_5px_18px_rgba(79,70,165,0.04)] space-y-3">
      <SkeletonLine className="w-1/3" />
      <div className="skeleton rounded-xl" style={{ height: '36px', width: '60%' }} />
      <SkeletonLine className="w-1/2" />
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-cream shadow-[0_5px_18px_rgba(79,70,165,0.04)]">
      <div className="flex gap-4 border-b border-line bg-paper-dim px-5 py-3">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="flex-1"><SkeletonLine className="w-3/4" /></div>
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 border-b border-ink/5 last:border-0 px-5 py-3.5">
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="flex-1">
              <SkeletonLine className={c === 0 ? 'w-full' : 'w-2/3'} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
