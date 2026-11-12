import { NavLink } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { adminMobilePrimary, salesMobilePrimary } from '../nav'

export default function MobileNav({ onOpenMore }) {
  const { isAdmin } = useAuth()
  const links = isAdmin ? adminMobilePrimary : salesMobilePrimary

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-white/95 shadow-[0_-8px_30px_rgba(15,23,42,0.06)] backdrop-blur-md print:hidden md:hidden"
      style={{ paddingBottom: 'max(0.35rem, env(safe-area-inset-bottom))' }}
    >
      <div className="mx-auto flex max-w-lg items-end justify-around px-1 pt-1">
        {links.map(({ to, label, icon: Icon, primary }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              [
                'flex min-w-[4.1rem] flex-col items-center gap-0.5 rounded-2xl px-1.5 py-1 text-[10px] font-semibold transition',
                primary ? '-mt-5' : '',
                !primary && isActive ? 'text-hospital-dark' : '',
                !primary && !isActive ? 'text-[var(--text-muted)]' : '',
                primary ? 'text-hospital-dark' : '',
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={[
                    'flex items-center justify-center',
                    primary
                      ? 'h-12 w-12 rounded-2xl bg-hospital text-white shadow-[0_10px_24px_rgba(46,123,168,0.35)]'
                      : isActive
                        ? 'h-9 w-9 rounded-xl bg-hospital-light text-hospital-dark'
                        : 'h-9 w-9 rounded-xl text-[var(--text-muted)]',
                  ].join(' ')}
                >
                  <Icon size={primary ? 22 : 18} />
                </span>
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}

        {isAdmin ? (
          <button
            type="button"
            onClick={onOpenMore}
            className="flex min-w-[4.1rem] flex-col items-center gap-0.5 rounded-2xl px-1.5 py-1 text-[10px] font-semibold text-[var(--text-muted)]"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl">
              <Menu size={18} />
            </span>
            More
          </button>
        ) : null}
      </div>
    </nav>
  )
}
