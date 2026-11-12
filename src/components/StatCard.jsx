export default function StatCard({ label, value, trend, icon: Icon, accent = 'hospital', compact = false }) {
  const accents = {
    hospital: 'bg-hospital-light text-hospital-dark',
    warning: 'bg-amber-50 text-amber-600',
    danger: 'bg-red-50 text-red-500',
    success: 'bg-emerald-50 text-emerald-600',
  }

  return (
    <div
      className={`rounded-2xl bg-white shadow-[var(--shadow)] ${
        compact ? 'p-3.5 sm:p-5' : 'p-5'
      }`}
    >
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0">
          <p className={`text-[var(--text-muted)] ${compact ? 'text-xs sm:text-sm' : 'text-sm'}`}>
            {label}
          </p>
          <p
            className={`mt-1.5 font-semibold tracking-tight text-[var(--text)] sm:mt-2 ${
              compact ? 'text-xl sm:text-3xl' : 'text-3xl'
            }`}
          >
            {value}
          </p>
          {trend ? (
            <p
              className={`mt-1.5 text-[var(--text-muted)] sm:mt-2 ${
                compact ? 'line-clamp-2 text-[10px] leading-snug sm:text-xs' : 'text-xs'
              }`}
            >
              {trend}
            </p>
          ) : null}
        </div>
        {Icon ? (
          <div
            className={`flex shrink-0 items-center justify-center rounded-2xl ${accents[accent]} ${
              compact ? 'h-9 w-9 sm:h-12 sm:w-12' : 'h-12 w-12'
            }`}
          >
            <Icon size={compact ? 18 : 22} className="sm:hidden" />
            <Icon size={22} className="hidden sm:block" />
          </div>
        ) : null}
      </div>
    </div>
  )
}
