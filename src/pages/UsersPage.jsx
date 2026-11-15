import { useCallback, useEffect, useState } from 'react'
import { KeyRound, LayoutGrid, List, Shield, Trash2, UserCheck, UserX } from 'lucide-react'
import {
  createUser,
  deleteUser,
  listUsers,
  resetPassword,
  ROLES,
  setUserActive,
} from '../api/auth'
import { getCachedUsers } from '../utils/offlineStore'

export default function UsersPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [fromCache, setFromCache] = useState(false)
  const [mobileViewMode, setMobileViewMode] = useState('cards') // 'cards' | 'table'
  const [form, setForm] = useState({
    name: '',
    username: '',
    password: '',
    pin: '',
    role: ROLES.SALESPERSON,
  })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setUsers(await listUsers())
      setFromCache(false)
    } catch (err) {
      const cached = await getCachedUsers()
      if (cached?.users?.length) {
        setUsers(cached.users)
        setFromCache(true)
      } else {
        setUsers([])
        setError(err.message || 'No saved users on this device yet.')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function handleCreate(e) {
    e.preventDefault()
    setError('')
    setMessage('')
    try {
      await createUser(form)
      setForm({ name: '', username: '', password: '', pin: '', role: ROLES.SALESPERSON })
      setMessage('User created successfully')
      await refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">Staff & Users</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Create, manage, deactivate, or reset passwords for staff accounts.
          </p>
        </div>

        {/* Mobile View Toggle */}
        <div className="inline-flex self-start rounded-xl bg-canvas p-1 md:hidden">
          <button
            type="button"
            onClick={() => setMobileViewMode('cards')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              mobileViewMode === 'cards'
                ? 'bg-white font-semibold text-hospital-dark shadow-sm'
                : 'text-[var(--text-muted)]'
            }`}
          >
            <LayoutGrid size={14} /> Cards
          </button>
          <button
            type="button"
            onClick={() => setMobileViewMode('table')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              mobileViewMode === 'table'
                ? 'bg-white font-semibold text-hospital-dark shadow-sm'
                : 'text-[var(--text-muted)]'
            }`}
          >
            <List size={14} /> Table
          </button>
        </div>
      </div>

      {fromCache ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Showing saved users on this device. User modifications require an active online session.
        </p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        {/* Users List Container */}
        <div className="overflow-hidden rounded-2xl bg-white shadow-[var(--shadow)] w-full max-w-full min-w-0">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <span className="font-semibold text-[var(--text)]">All Users</span>
            <span className="text-xs text-[var(--text-muted)]">{users.length} accounts</span>
          </div>

          {loading ? (
            <p className="p-6 text-sm text-[var(--text-muted)]">Loading users...</p>
          ) : (
            <>
              {/* Mobile Card Layout */}
              <div className={mobileViewMode === 'cards' ? 'space-y-3 p-3 md:hidden' : 'hidden'}>
                {users.map((user) => {
                  const isDeleted = Boolean(user.deleted)
                  const statusLabel = isDeleted ? 'Deleted' : user.active ? 'Active' : 'Inactive'
                  const statusClass = isDeleted
                    ? 'bg-slate-100 text-slate-600'
                    : user.active
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-red-50 text-red-600'

                  return (
                    <article
                      key={user.id}
                      className="rounded-2xl border border-[var(--border)] bg-canvas/40 p-4 transition hover:border-hospital-soft"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-base text-[var(--text)]">{user.name}</p>
                          <p className="text-xs font-mono text-[var(--text-muted)]">
                            @{user.username || '—'}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusClass}`}>
                            {statusLabel}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--text-muted)] capitalize">
                            <Shield size={11} className="text-hospital" />
                            {user.role.replace('_', ' ')}
                          </span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      {!isDeleted ? (
                        <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--border)] pt-3">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-xl bg-hospital-light px-3 py-1.5 text-xs font-semibold text-hospital-dark transition hover:bg-hospital hover:text-white"
                            onClick={async () => {
                              const pwd = window.prompt(`New password for ${user.username}:`, '')
                              if (!pwd) return
                              try {
                                await resetPassword(user.id, pwd)
                                setMessage(`Password reset successfully for ${user.username}`)
                              } catch (err) {
                                setError(err.message)
                              }
                            }}
                          >
                            <KeyRound size={13} /> Reset PIN/Pwd
                          </button>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-1.5 text-xs font-semibold shadow-sm border border-[var(--border)] transition hover:bg-slate-100"
                            onClick={async () => {
                              try {
                                await setUserActive(user.id, !user.active)
                                await refresh()
                              } catch (err) {
                                setError(err.message)
                              }
                            }}
                          >
                            {user.active ? (
                              <>
                                <UserX size={13} className="text-amber-600" /> Deactivate
                              </>
                            ) : (
                              <>
                                <UserCheck size={13} className="text-emerald-600" /> Activate
                              </>
                            )}
                          </button>
                          {user.role === ROLES.SALESPERSON ? (
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-xl bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-500 hover:text-white ml-auto"
                              onClick={async () => {
                                const ok = window.confirm(
                                  `Delete user ${user.name}? They will no longer be able to log in, but sales history will be preserved for accounting.`,
                                )
                                if (!ok) return
                                try {
                                  await deleteUser(user.id)
                                  setMessage(`${user.name} deleted.`)
                                  await refresh()
                                } catch (err) {
                                  setError(err.message)
                                }
                              }}
                            >
                              <Trash2 size={13} /> Delete
                            </button>
                          ) : null}
                        </div>
                      ) : (
                        <p className="mt-3 text-xs text-[var(--text-muted)] italic border-t border-[var(--border)] pt-2">
                          Account deleted. Historical sales retained.
                        </p>
                      )}
                    </article>
                  )
                })}
              </div>

              {/* Table Layout (Desktop & Toggleable Mobile) */}
              <div className={mobileViewMode === 'table' ? 'block' : 'hidden md:block'}>
                {mobileViewMode === 'table' && (
                  <p className="px-4 py-1.5 text-[11px] text-[var(--text-muted)] bg-slate-50 border-b border-[var(--border)] md:hidden">
                    ← Swipe table horizontally to view all columns →
                  </p>
                )}
                <div className="table-scroll">
                  <table className="w-full min-w-[620px] text-left text-sm">
                    <thead className="bg-canvas text-[var(--text-muted)]">
                      <tr>
                        <th className="sticky left-0 bg-canvas z-20 px-4 py-3 font-medium shadow-[1px_0_0_0_#e5e7eb] min-w-[140px]">
                          Name
                        </th>
                        <th className="px-4 py-3 font-medium">Username</th>
                        <th className="px-4 py-3 font-medium">Role</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => {
                        const isDeleted = Boolean(user.deleted)
                        const statusLabel = isDeleted ? 'Deleted' : user.active ? 'Active' : 'Inactive'
                        const statusClass = isDeleted
                          ? 'bg-slate-100 text-slate-600'
                          : user.active
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-red-50 text-red-600'
                        return (
                          <tr key={user.id} className="border-t border-[var(--border)] hover:bg-slate-50/50">
                            <td className="sticky left-0 bg-white z-10 px-4 py-3 font-medium shadow-[1px_0_0_0_#e5e7eb] min-w-[140px]">
                              {user.name}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                              {isDeleted ? (
                                <span className="text-[var(--text-muted)]">—</span>
                              ) : (
                                user.username
                              )}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 capitalize">{user.role.replace('_', ' ')}</td>
                            <td className="whitespace-nowrap px-4 py-3">
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass}`}
                              >
                                {statusLabel}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3">
                              {isDeleted ? (
                                <span className="text-xs text-[var(--text-muted)]">
                                  Sales history retained
                                </span>
                              ) : (
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <button
                                    type="button"
                                    className="rounded-lg bg-hospital-light px-2.5 py-1 text-xs font-semibold text-hospital-dark transition hover:bg-hospital hover:text-white"
                                    onClick={async () => {
                                      const pwd = window.prompt(`New password for ${user.username}:`, '')
                                      if (!pwd) return
                                      try {
                                        await resetPassword(user.id, pwd)
                                        setMessage(`Password reset for ${user.username}`)
                                      } catch (err) {
                                        setError(err.message)
                                      }
                                    }}
                                  >
                                    Reset Pwd
                                  </button>
                                  <button
                                    type="button"
                                    className="rounded-lg bg-canvas px-2.5 py-1 text-xs font-semibold transition hover:bg-slate-200"
                                    onClick={async () => {
                                      try {
                                        await setUserActive(user.id, !user.active)
                                        await refresh()
                                      } catch (err) {
                                        setError(err.message)
                                      }
                                    }}
                                  >
                                    {user.active ? 'Deactivate' : 'Activate'}
                                  </button>
                                  {user.role === ROLES.SALESPERSON ? (
                                    <button
                                      type="button"
                                      className="rounded-lg bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-500 hover:text-white"
                                      onClick={async () => {
                                        const ok = window.confirm(
                                          `Delete ${user.name}? They will no longer be able to sign in. Their sales will remain in reports for accounting.`,
                                        )
                                        if (!ok) return
                                        try {
                                          await deleteUser(user.id)
                                          setMessage(
                                            `${user.name} deleted. Sales history kept for accounting.`,
                                          )
                                          await refresh()
                                        } catch (err) {
                                          setError(err.message)
                                        }
                                      }}
                                    >
                                      Delete
                                    </button>
                                  ) : null}
                                </div>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Add User Form */}
        <form onSubmit={handleCreate} className="space-y-3.5 rounded-2xl bg-white p-5 shadow-[var(--shadow)]">
          <h3 className="text-lg font-semibold">Add New User</h3>
          {['name', 'username', 'password', 'pin'].map((field) => (
            <label key={field} className="block text-sm capitalize">
              <span className="mb-1 block font-medium">
                {field === 'pin' ? 'Quick POS PIN (4 digits)' : field}
              </span>
              <input
                value={form[field]}
                onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-hospital"
                required={field !== 'pin'}
                type={field === 'password' ? 'password' : 'text'}
                placeholder={field === 'pin' ? 'e.g. 1234' : ''}
              />
            </label>
          ))}
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Role</span>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm outline-none focus:border-hospital"
            >
              <option value={ROLES.SALESPERSON}>Salesperson</option>
              <option value={ROLES.SUPER_ADMIN}>Super Admin</option>
            </select>
          </label>
          {error ? <p className="text-sm text-red-500">{error}</p> : null}
          {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
          <button type="submit" className="w-full rounded-xl bg-hospital py-3 font-semibold text-white transition hover:bg-hospital-dark">
            Create user
          </button>
        </form>
      </div>
    </div>
  )
}
