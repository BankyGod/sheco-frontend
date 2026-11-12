import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Boxes,
  Users,
  BarChart3,
  ScrollText,
  Settings,
  AlertTriangle,
  PlusCircle,
} from 'lucide-react'

export const adminLinks = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/pos', label: 'POS', icon: PlusCircle },
  { to: '/sales', label: 'Sales', icon: ShoppingCart },
  { to: '/needs-review', label: 'Needs review', icon: AlertTriangle },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/inventory', label: 'Inventory', icon: Boxes },
  { to: '/users', label: 'Users', icon: Users },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/audit', label: 'Audit Log', icon: ScrollText },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export const salesLinks = [
  { to: '/pos', label: 'New Sale', icon: ShoppingCart },
  { to: '/sales', label: 'My Sales', icon: ScrollText },
]

export const adminMobilePrimary = [
  { to: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { to: '/sales', label: 'Sales', icon: ShoppingCart },
  { to: '/pos', label: 'POS', icon: PlusCircle, primary: true },
  { to: '/products', label: 'Products', icon: Package },
]

export const adminMobileMore = [
  { to: '/needs-review', label: 'Needs review', icon: AlertTriangle },
  { to: '/inventory', label: 'Inventory', icon: Boxes },
  { to: '/users', label: 'Users', icon: Users },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/audit', label: 'Audit Log', icon: ScrollText },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export const salesMobilePrimary = [
  { to: '/pos', label: 'Sell', icon: ShoppingCart, primary: true },
  { to: '/sales', label: 'My Sales', icon: ScrollText },
]
