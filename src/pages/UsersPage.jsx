import { useCallback, useEffect, useState } from 'react'
import {
  createUser,
  deleteUser,
  listUsers,
  resetPassword,
  ROLES,
  setUserActive,
} from '../api/auth'

export default function UsersPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
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
    try {
      setUsers(await listUsers())
    } catch (err) {
      setError(err.message)
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
      setMessage('User created')
      await refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight">Users</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Create, deactivate, or delete salesperson accounts. Deleted staff stay in sales
          records for accounting.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="overflow-hidden rounded-2xl bg-white shadow-[var(--shadow)]">
          {loading ? (
            <p className="p-6 text-sm text-[var(--text-muted)]">Loading users...</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-canvas text-[var(--text-muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
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
                    <tr key={user.id} className="border-t border-[var(--border)]">
                      <td className="px-4 py-3 font-medium">{user.name}</td>
                      <td className="px-4 py-3">
                        {isDeleted ? (
                          <span className="text-[var(--text-muted)]">—</span>
                        ) : (
                          user.username
                        )}
                      </td>
                      <td className="px-4 py-3 capitalize">{user.role.replace('_', ' ')}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${statusClass}`}
                        >
                          {statusLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {isDeleted ? (
                          <span className="text-xs text-[var(--text-muted)]">
                            Sales history retained
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="rounded-lg bg-hospital-light px-2 py-1 text-xs font-semibold text-hospital-dark"
                              onClick={async () => {
                                const pwd = window.prompt('New password', '')
                                if (!pwd) return
                                try {
                                  await resetPassword(user.id, pwd)
                                  setMessage(`Password reset for ${user.username}`)
                                } catch (err) {
                                  setError(err.message)
                                }
                              }}
                            >
                              Reset password
                            </button>
                            <button
                              type="button"
                              className="rounded-lg bg-canvas px-2 py-1 text-xs font-semibold"
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
                                className="rounded-lg bg-red-50 px-2 py-1 text-xs font-semibold text-red-600"
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
          )}
        </div>

        <form onSubmit={handleCreate} className="space-y-3 rounded-2xl bg-white p-5 shadow-[var(--shadow)]">
          <h3 className="text-lg font-semibold">Add user</h3>
          {['name', 'username', 'password', 'pin'].map((field) => (
            <label key={field} className="block text-sm capitalize">
              <span className="mb-1 block font-medium">{field}</span>
              <input
                value={form[field]}
                onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5 outline-none focus:border-hospital"
                required={field !== 'pin'}
                type={field === 'password' ? 'password' : 'text'}
              />
            </label>
          ))}
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Role</span>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full rounded-xl border border-[var(--border)] px-3 py-2.5 outline-none focus:border-hospital"
            >
              <option value={ROLES.SALESPERSON}>Salesperson</option>
              <option value={ROLES.SUPER_ADMIN}>Super Admin</option>
            </select>
          </label>
          {error ? <p className="text-sm text-red-500">{error}</p> : null}
          {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
          <button type="submit" className="w-full rounded-xl bg-hospital py-3 font-semibold text-white">
            Create user
          </button>
        </form>
      </div>
    </div>
  )
}
