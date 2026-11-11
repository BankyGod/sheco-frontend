import { getDeviceId } from '../utils/device'

const SESSION_KEY = 'sheco_session'

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

export async function apiRequest(path, { method = 'GET', body, auth = true, headers = {} } = {}) {
  const session = getStoredSession()
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

  const response = await fetch(`${getApiBase()}${path}`, {
    method,
    headers: requestHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

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
    if (response.status === 401 && auth) {
      clearStoredSession()
    }
    throw new ApiError(extractDetail(payload), response.status, payload)
  }

  return payload
}
