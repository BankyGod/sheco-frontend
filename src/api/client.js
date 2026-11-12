import { getDeviceId } from '../utils/device'

const SESSION_KEY = 'sheco_session'
const DEFAULT_TIMEOUT_MS = 5000

export function getApiBase() {
  // Prefer same-origin /api in production (nginx proxies to the API).
  // Localhost fallback is only for rare builds without VITE_API_URL.
  const configured = import.meta.env.VITE_API_URL
  if (configured) return String(configured).replace(/\/$/, '')
  if (import.meta.env.PROD) return '/api'
  return 'http://localhost:8000/api'
}

export function getStoredSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')
  } catch {
    return null
  }
}

export function saveSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearStoredSession() {
  localStorage.removeItem(SESSION_KEY)
}

export class ApiError extends Error {
  constructor(message, status, detail) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

function extractDetail(payload) {
  if (!payload) return 'Request failed'
  if (typeof payload === 'string') return payload
  if (typeof payload.detail === 'string') return payload.detail
  if (Array.isArray(payload.detail)) {
    return payload.detail.map((d) => d.msg || JSON.stringify(d)).join(', ')
  }
  if (payload.message) return payload.message
  return 'Request failed'
}

function networkErrorMessage() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return "You're offline. Showing saved data where available — sales will queue until you're back online."
  }
  return "Can't reach the Sheco server. Check your connection and try again."
}

export function canUseOnlineApi() {
  const session = getStoredSession()
  if (!session?.accessToken || session?.offlineUnlock) return false
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false
  return true
}

export async function apiRequest(
  path,
  { method = 'GET', body, auth = true, headers = {}, timeoutMs = DEFAULT_TIMEOUT_MS } = {},
) {
  const session = getStoredSession()

  // Offline-unlock sessions have no JWT — fail instantly so pages can use local cache.
  if (auth && (!session?.accessToken || session?.offlineUnlock)) {
    throw new ApiError(networkErrorMessage(), 0, null)
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new ApiError(networkErrorMessage(), 0, null)
  }

  const requestHeaders = {
    Accept: 'application/json',
    'X-Device-Id': session?.deviceId || getDeviceId(),
    ...headers,
  }

  if (body !== undefined) {
    requestHeaders['Content-Type'] = 'application/json'
  }

  if (auth && session?.accessToken) {
    requestHeaders.Authorization = `Bearer ${session.accessToken}`
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let response
  try {
    response = await fetch(`${getApiBase()}${path}`, {
      method,
      headers: requestHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
  } catch {
    throw new ApiError(networkErrorMessage(), 0, null)
  } finally {
    clearTimeout(timer)
  }

  const text = await response.text()
  let payload = null
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = text
    }
  }

  if (!response.ok) {
    // Never wipe an offline-unlock session because of an online API 401.
    if (response.status === 401 && auth && !session?.offlineUnlock) {
      clearStoredSession()
    }
    throw new ApiError(extractDetail(payload), response.status, payload)
  }

  return payload
}
