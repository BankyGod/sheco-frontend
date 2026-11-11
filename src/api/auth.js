import {
  apiRequest,
  clearStoredSession,
  getStoredSession,
  saveSession,
} from './client'
import { getDeviceId } from '../utils/device'

const OFFLINE_UNLOCK_KEY = 'sheco_offline_unlock'

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  SALESPERSON: 'salesperson',
}

async function hashSecret(secret) {
  const data = new TextEncoder().encode(String(secret))
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function getSession() {
  return getStoredSession()
}

export function clearSession() {
  clearStoredSession()
}

export async function login(username, password) {
  const deviceId = getDeviceId()
  const data = await apiRequest('/auth/login', {
    method: 'POST',
    auth: false,
    body: {
      username,
      password,
      deviceId,
    },
  })

  const session = {
    user: data.user,
    deviceId: data.deviceId || deviceId,
    signedInAt: data.signedInAt,
    accessToken: data.accessToken,
    tokenType: data.tokenType || 'bearer',
  }
  saveSession(session)

  const days = data.offlineUnlockDays ?? 7
  localStorage.setItem(
    OFFLINE_UNLOCK_KEY,
    JSON.stringify({
      userId: data.user.id,
      username: data.user.username,
      name: data.user.name,
      role: data.user.role,
      passwordHash: await hashSecret(password),
      unlockedUntil: Date.now() + days * 24 * 60 * 60 * 1000,
    }),
  )

  return session
}

export async function unlockOffline(username, secret) {
  const raw = localStorage.getItem(OFFLINE_UNLOCK_KEY)
  if (!raw) throw new Error('No offline unlock available on this device')
  const unlock = JSON.parse(raw)
  if (Date.now() > unlock.unlockedUntil) {
    throw new Error('Offline unlock period has expired. Connect to sign in again.')
  }
  if (unlock.username.toLowerCase() !== String(username).toLowerCase()) {
    throw new Error('User is not unlocked on this device')
  }
  const secretHash = await hashSecret(secret)
  if (secretHash !== unlock.passwordHash) {
    throw new Error('Invalid credentials')
  }

  const session = {
    user: {
      id: unlock.userId,
      name: unlock.name,
      username: unlock.username,
      role: unlock.role,
      active: true,
    },
    deviceId: getDeviceId(),
    signedInAt: new Date().toISOString(),
    offlineUnlock: true,
    accessToken: null,
  }
  saveSession(session)
  return session
}

export async function listUsers() {
  return apiRequest('/users')
}

export async function createUser({ name, username, password, pin, role }) {
  return apiRequest('/users', {
    method: 'POST',
    body: { name, username, password, pin: pin || '0000', role },
  })
}

export async function setUserActive(userId, active) {
  return apiRequest(`/users/${userId}/active`, {
    method: 'PATCH',
    body: { active },
  })
}

export async function deleteUser(userId) {
  return apiRequest(`/users/${userId}`, {
    method: 'DELETE',
  })
}

export async function resetPassword(userId, newPassword) {
  return apiRequest(`/users/${userId}/reset-password`, {
    method: 'POST',
    body: { password: newPassword },
  })
}

export async function getMe() {
  return apiRequest('/auth/me')
}

export async function updateProfile({ name, username }) {
  return apiRequest('/auth/me', {
    method: 'PATCH',
    body: { name, username },
  })
}

export async function changePassword({ currentPassword, newPassword }) {
  return apiRequest('/auth/change-password', {
    method: 'POST',
    body: { currentPassword, newPassword },
  })
}

export async function changePin({ currentPassword, newPin }) {
  return apiRequest('/auth/change-pin', {
    method: 'POST',
    body: { currentPassword, newPin },
  })
}

export async function refreshOfflineUnlock({ username, name, role, password }) {
  const session = getStoredSession()
  if (!session?.user) return
  const raw = localStorage.getItem(OFFLINE_UNLOCK_KEY)
  let previous = {}
  if (raw) {
    try {
      previous = JSON.parse(raw) || {}
    } catch {
      previous = {}
    }
  }
  localStorage.setItem(
    OFFLINE_UNLOCK_KEY,
    JSON.stringify({
      userId: session.user.id,
      username: username || session.user.username,
      name: name || session.user.name,
      role: role || session.user.role,
      passwordHash: password ? await hashSecret(password) : previous.passwordHash,
      unlockedUntil: previous.unlockedUntil || Date.now() + 7 * 24 * 60 * 60 * 1000,
    }),
  )
}

