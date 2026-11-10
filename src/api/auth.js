import { addAudit, getStore, ROLES } from '../data/mockStore'
import { getDeviceId } from '../utils/device'

const SESSION_KEY = 'sheco_session'
const OFFLINE_UNLOCK_KEY = 'sheco_offline_unlock'

export { ROLES }

export function getSession() {
  const raw = localStorage.getItem(SESSION_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    active: user.active,
  }
}

export async function login(username, password) {
  const store = getStore()
  const user = store.users.find(
    (u) => u.username.toLowerCase() === String(username).toLowerCase() && u.active,
  )
  if (!user || user.password !== password) {
    throw new Error('Invalid username or password')
  }

  const session = {
    user: publicUser(user),
    deviceId: getDeviceId(),
    signedInAt: new Date().toISOString(),
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  localStorage.setItem(
    OFFLINE_UNLOCK_KEY,
    JSON.stringify({
      userId: user.id,
      username: user.username,
      pin: user.pin,
      password: user.password,
      name: user.name,
      role: user.role,
      unlockedUntil: Date.now() + store.settings.offlineUnlockDays * 24 * 60 * 60 * 1000,
    }),
  )
  addAudit({
    userId: user.id,
    deviceId: session.deviceId,
    action: 'sign_in',
    record: `User ${user.name}`,
  })
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
  if (secret !== unlock.password && secret !== unlock.pin) {
    throw new Error('Invalid credentials or PIN')
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
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  return session
}

export function listUsers() {
  return getStore().users.map(publicUser)
}

export function createUser({ name, username, password, pin, role }, actor) {
  const store = getStore()
  if (store.users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
    throw new Error('Username already exists')
  }
  const user = {
    id: `u_${Date.now()}`,
    name,
    username,
    password,
    pin: pin || '0000',
    role,
    active: true,
  }
  store.users.push(user)
  addAudit({
    userId: actor.id,
    deviceId: actor.deviceId,
    action: 'user_create',
    record: `Created user ${username} (${role})`,
  })
  return publicUser(user)
}

export function setUserActive(userId, active, actor) {
  const store = getStore()
  const user = store.users.find((u) => u.id === userId)
  if (!user) throw new Error('User not found')
  user.active = active
  addAudit({
    userId: actor.id,
    deviceId: actor.deviceId,
    action: 'user_update',
    record: `${active ? 'Activated' : 'Deactivated'} user ${user.username}`,
  })
  return publicUser(user)
}

export function resetPassword(userId, newPassword, actor) {
  const store = getStore()
  const user = store.users.find((u) => u.id === userId)
  if (!user) throw new Error('User not found')
  user.password = newPassword
  addAudit({
    userId: actor.id,
    deviceId: actor.deviceId,
    action: 'user_update',
    record: `Reset password for ${user.username}`,
  })
  return publicUser(user)
}
