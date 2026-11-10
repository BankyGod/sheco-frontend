export default function StatCard({ label, value, trend, icon: Icon, accent = 'hospital' }) {
  const accents = {
    hospital: 'bg-hospital-light text-hospital-dark',
    warning: 'bg-amber-50 text-amber-600',
    danger: 'bg-red-50 text-red-500',
    success: 'bg-emerald-50 text-emerald-600',
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-[var(--shadow)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-[var(--text-muted)]">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text)]">{value}</p>
          {trend ? <p className="mt-2 text-xs text-[var(--text-muted)]">{trend}</p> : null}
        </div>
        {Icon ? (
          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${accents[accent]}`}>
            <Icon size={22} />
          </div>
        ) : null}
      </div>
    </div>
  )
}
