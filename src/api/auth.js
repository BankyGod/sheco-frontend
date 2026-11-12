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

function readUnlockRecord() {
  const raw = localStorage.getItem(OFFLINE_UNLOCK_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function writeUnlockRecord(record) {
  localStorage.setItem(OFFLINE_UNLOCK_KEY, JSON.stringify(record))
}

export function getOfflineUnlockMeta() {
  const unlock = readUnlockRecord()
  if (!unlock) return null
  return {
    username: unlock.username,
    name: unlock.name,
    role: unlock.role,
    hasPin: Boolean(unlock.pinHash),
    unlockedUntil: unlock.unlockedUntil,
    expired: Date.now() > Number(unlock.unlockedUntil || 0),
  }
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
  const previous = readUnlockRecord() || {}
  const sameUser =
    previous.username &&
    String(previous.username).toLowerCase() === String(data.user.username).toLowerCase()

  writeUnlockRecord({
    userId: data.user.id,
    username: data.user.username,
    name: data.user.name,
    role: data.user.role,
    // Keep existing PIN for this user; wipe PIN if a different account signs in.
    pinHash: sameUser ? previous.pinHash || null : null,
    unlockedUntil: Date.now() + days * 24 * 60 * 60 * 1000,
  })

  return session
}

export async function saveOfflinePin(pin) {
  const normalized = String(pin || '').replace(/\D/g, '')
  if (!/^\d{4}$/.test(normalized)) {
    throw new Error('Offline PIN must be exactly 4 digits')
  }
  const session = getStoredSession()
  const previous = readUnlockRecord() || {}
  if (!session?.user && !previous.username) {
    throw new Error('Sign in online before setting an offline PIN')
  }
  writeUnlockRecord({
    userId: session?.user?.id || previous.userId,
    username: session?.user?.username || previous.username,
    name: session?.user?.name || previous.name,
    role: session?.user?.role || previous.role,
    pinHash: await hashSecret(normalized),
    unlockedUntil: previous.unlockedUntil || Date.now() + 7 * 24 * 60 * 60 * 1000,
  })
  return true
}

export async function unlockOffline(username, pin) {
  const unlock = readUnlockRecord()
  if (!unlock) throw new Error('No offline unlock available on this device')
  if (Date.now() > unlock.unlockedUntil) {
    throw new Error('Offline unlock period has expired. Connect to sign in again.')
  }
  if (unlock.username.toLowerCase() !== String(username).toLowerCase()) {
    throw new Error('User is not unlocked on this device')
  }

  const normalized = String(pin || '').replace(/\D/g, '')
  if (!/^\d{4}$/.test(normalized)) {
    throw new Error('Enter your 4-digit offline PIN')
  }
  if (!unlock.pinHash) {
    throw new Error('No offline PIN set on this device. Sign in online and create a 4-digit PIN first.')
  }
  const secretHash = await hashSecret(normalized)
  if (secretHash !== unlock.pinHash) {
    throw new Error('Invalid PIN')
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

export async function refreshOfflineUnlock({ username, name, role, pin } = {}) {
  const session = getStoredSession()
  if (!session?.user) return
  const previous = readUnlockRecord() || {}
  writeUnlockRecord({
    userId: session.user.id,
    username: username || session.user.username,
    name: name || session.user.name,
    role: role || session.user.role,
    pinHash: pin ? await hashSecret(String(pin).replace(/\D/g, '')) : previous.pinHash || null,
    unlockedUntil: previous.unlockedUntil || Date.now() + 7 * 24 * 60 * 60 * 1000,
  })
}
