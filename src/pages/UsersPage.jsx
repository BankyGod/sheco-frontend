import { useMemo, useState } from 'react'
import {
  createUser,
  listUsers,
  resetPassword,
  ROLES,
  setUserActive,
} from '../api/auth'
import { useAuth } from '../context/AuthContext'

export default function UsersPage() {
  const { actor } = useAuth()
  const [tick, setTick] = useState(0)
  const users = useMemo(() => listUsers(), [tick])
  const [form, setForm] = useState({
    name: '',
    username: '',
    password: '',
    pin: '',
    role: ROLES.SALESPERSON,
  })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  function refresh() {
    setTick((t) => t + 1)
  }

  function handleCreate(e) {
    e.preventDefault()
    setError('')
    setMessage('')
    try {
      createUser(form, actor())
      setForm({ name: '', username: '', password: '', pin: '', role: ROLES.SALESPERSON })
      setMessage('User created')
      refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight">Users</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Create, deactivate, and reset passwords for pharmacy staff.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="overflow-hidden rounded-2xl bg-white shadow-[var(--shadow)]">
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
              {users.map((user) => (
                <tr key={user.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3 font-medium">{user.name}</td>
                  <td className="px-4 py-3">{user.username}</td>
                  <td className="px-4 py-3 capitalize">{user.role.replace('_', ' ')}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        user.active ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                      }`}
                    >
                      {user.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded-lg bg-hospital-light px-2 py-1 text-xs font-semibold text-hospital-dark"
                        onClick={() => {
                          const pwd = window.prompt('New password', 'changeme123')
                          if (!pwd) return
                          resetPassword(user.id, pwd, actor())
                          setMessage(`Password reset for ${user.username}`)
                          refresh()
                        }}
                      >
                        Reset password
                      </button>
                      <button
                        type="button"
                        className="rounded-lg bg-canvas px-2 py-1 text-xs font-semibold"
                        onClick={() => {
                          setUserActive(user.id, !user.active, actor())
                          refresh()
                        }}
                      >
                        {user.active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
