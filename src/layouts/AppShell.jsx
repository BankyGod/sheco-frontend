import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import MobileNav from '../components/MobileNav'
import MobileDrawer from '../components/MobileDrawer'

function searchPlaceholderFor(pathname) {
  if (pathname.includes('/products')) return 'Search products...'
  if (pathname.includes('/sales')) return 'Search receipts...'
  if (pathname.includes('/pos')) return 'Search products...'
  if (pathname.includes('/users')) return 'Search users...'
  return 'Search Sheco...'
}

export default function AppShell() {
  const [search, setSearch] = useState('')
  const [moreOpen, setMoreOpen] = useState(false)
  const location = useLocation()

  return (
    <div className="flex min-h-dvh bg-canvas">
      <div className="sticky top-0 hidden h-dvh print:hidden md:block">
        <Sidebar />
      </div>

      <div
        className="flex min-w-0 flex-1 flex-col"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <header className="sticky top-0 z-30 bg-canvas/95 px-3 pb-2 pt-2 backdrop-blur-md print:hidden md:static md:bg-transparent md:px-6 md:pb-0 md:pt-6 md:backdrop-blur-none">
          <div className="mb-2 flex items-center justify-between px-1 md:hidden">
            <div>
              <p className="text-lg font-bold tracking-tight">
                Sheco<span className="text-hospital">.</span>
              </p>
              <p className="text-[11px] text-[var(--text-muted)]">Pharmacy app</p>
            </div>
          </div>
          <TopBar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder={searchPlaceholderFor(location.pathname)}
          />
        </header>

        <main
          className="min-w-0 flex-1 px-3 pt-3 md:px-6 md:pb-6 md:pt-4 print:p-0"
          style={{
            paddingBottom: 'max(7.5rem, calc(6rem + env(safe-area-inset-bottom)))',
          }}
        >
          <Outlet context={{ search, setSearch }} />
        </main>
      </div>

      <MobileNav onOpenMore={() => setMoreOpen(true)} />
      <MobileDrawer open={moreOpen} onClose={() => setMoreOpen(false)} />
    </div>
  )
}
