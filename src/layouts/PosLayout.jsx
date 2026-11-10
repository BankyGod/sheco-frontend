import { Outlet } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import { useState } from 'react'

export default function PosLayout() {
  const [search, setSearch] = useState('')

  return (
    <div className="flex min-h-screen bg-canvas">
      <div className="sticky top-0 hidden h-screen md:block">
        <Sidebar />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 md:p-6">
        <TopBar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search products by name or generic..."
        />
        <Outlet context={{ search, setSearch }} />
      </div>
    </div>
  )
}
