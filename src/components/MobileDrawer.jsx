import { NavLink } from 'react-router-dom'
import { X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { adminMobileMore } from '../nav'

export default function MobileDrawer({ open, onClose }) {
  const { user, isAdmin } = useAuth()
  if (!open || !isAdmin) return null

  return (
    <div className="fixed inset-0 z-50 print:hidden md:hidden">
      <button
        type="button"
        aria-label="Close menu"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div
        className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-3xl bg-white shadow-[0_-12px_40px_rgba(15,23,42,0.18)]"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-[var(--border)] bg-white px-5 py-4">
          <div>
            <p className="text-base font-semibold">More</p>
            <p className="text-xs text-[var(--text-muted)]">
              Hi {user?.name?.split(' ')[0] || 'there'} — admin tools
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-canvas text-[var(--text)]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 p-4">
          {adminMobileMore.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) =>
                [
                  'flex flex-col items-center gap-2 rounded-2xl border px-2 py-4 text-center text-xs font-semibold transition',
                  isActive
                    ? 'border-hospital bg-hospital-light text-hospital-dark'
                    : 'border-[var(--border)] bg-white text-[var(--text)]',
                ].join(' ')
              }
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-canvas text-hospital-dark">
                <Icon size={20} />
              </span>
              {label}
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  )
}
