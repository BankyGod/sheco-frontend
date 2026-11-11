import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  clearSession,
  getMe,
  getSession,
  login as apiLogin,
  unlockOffline as apiUnlock,
  ROLES,
} from '../api/auth'
import { saveSession } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => getSession())

  useEffect(() => {
    let active = true
    async function refreshMe() {
      const current = getSession()
      if (!current?.accessToken || current?.offlineUnlock) return
      try {
        const me = await getMe()
        if (!active) return
        const next = {
          ...current,
          user: {
            ...current.user,
            ...me,
          },
        }
        saveSession(next)
        setSession(next)
      } catch {
        if (!active) return
        clearSession()
        setSession(null)
      }
    }
    refreshMe()
    return () => {
      active = false
    }
  }, [])

  const value = useMemo(
    () => ({
      session,
      user: session?.user || null,
      isAuthenticated: Boolean(session?.user),
      isAdmin: session?.user?.role === ROLES.SUPER_ADMIN,
      isSalesperson: session?.user?.role === ROLES.SALESPERSON,
      isOfflineUnlock: Boolean(session?.offlineUnlock),
      async login(username, password) {
        const next = await apiLogin(username, password)
        setSession(next)
        return next
      },
      async unlockOffline(username, secret) {
        const next = await apiUnlock(username, secret)
        setSession(next)
        return next
      },
      updateUser(user) {
        const next = {
          ...session,
          user: {
            ...session?.user,
            ...user,
          },
        }
        saveSession(next)
        setSession(next)
        return next
      },
      logout() {
        clearSession()
        setSession(null)
      },
      actor() {
        if (!session?.user) return null
        return { id: session.user.id, deviceId: session.deviceId, role: session.user.role }
      },
    }),
    [session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
