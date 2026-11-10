import { Outlet, useLocation } from 'react-router-dom'
import { useState } from 'react'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'

export default function AdminLayout() {
  const [search, setSearch] = useState('')
  const location = useLocation()

  return (
    <div className="flex min-h-screen bg-canvas">
      <div className="sticky top-0 hidden h-screen print:hidden md:block">
        <Sidebar />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 md:p-6 print:gap-0 print:p-0">
        <div className="print:hidden">
          <TopBar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder={
              location.pathname.includes('products')
                ? 'Search products...'
                : location.pathname.includes('sales')
                  ? 'Search receipts...'
                  : 'Search Sheco...'
            }
          />
        </div>
        <div className="print:hidden md:hidden">
          <Sidebar />
        </div>
        <Outlet context={{ search, setSearch }} />
      </div>
    </div>
  )
}
