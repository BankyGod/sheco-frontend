import { NavLink } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { adminLinks, salesLinks } from '../nav'

export default function Sidebar() {
  const { isAdmin, user } = useAuth()
  const links = isAdmin ? adminLinks : salesLinks

  return (
    <aside className="flex h-full w-[250px] shrink-0 flex-col bg-[#f8f9fb] px-4 py-6">
      <div className="px-2">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">
          Sheco<span className="text-hospital">.</span>
        </h1>
        <p className="mt-1 text-xs text-[var(--text-muted)]">Pharmacy Management</p>
      </div>

      <nav className="mt-8 flex-1 space-y-1 overflow-y-auto">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              [
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                isActive
                  ? 'bg-hospital-light text-hospital-dark'
                  : 'text-[var(--text-muted)] hover:bg-white hover:text-[var(--text)]',
              ].join(' ')
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      {isAdmin ? (
        <div className="mt-4 rounded-2xl bg-hospital p-4 text-white shadow-[var(--shadow)]">
          <p className="text-sm font-semibold">Please organize your medicines</p>
          <p className="mt-1 text-xs text-white/80">
            Hi {user?.name?.split(' ')[0]}, keep stock and expiry alerts tidy.
          </p>
          <NavLink
            to="/products"
            className="mt-4 inline-flex items-center gap-1 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-hospital-dark"
          >
            <Plus size={14} /> Add Products
          </NavLink>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl bg-hospital p-4 text-white shadow-[var(--shadow)]">
          <p className="text-sm font-semibold">Ready to sell</p>
          <p className="mt-1 text-xs text-white/80">Search products and complete sales quickly.</p>
          <NavLink
            to="/pos"
            className="mt-4 inline-flex items-center gap-1 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-hospital-dark"
          >
            <Plus size={14} /> New Sale
          </NavLink>
        </div>
      )}
    </aside>
  )
}
