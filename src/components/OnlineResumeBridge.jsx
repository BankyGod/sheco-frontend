import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useOffline } from '../context/OfflineContext'

/**
 * If the user is working in an offline-unlock session and the network returns,
 * clear that local session and send them to online sign-in so queued sales can sync.
 */
export default function OnlineResumeBridge() {
  const { online, queueCount } = useOffline()
  const { isOfflineUnlock, user, logout } = useAuth()
  const navigate = useNavigate()
  const handlingRef = useRef(false)

  useEffect(() => {
    if (!online || !isOfflineUnlock || handlingRef.current) return

    handlingRef.current = true
    const username = user?.username || ''
    const params = new URLSearchParams({
      resume: 'online',
      reason: 'connection-restored',
    })
    if (username) params.set('user', username)
    if (queueCount > 0) params.set('queued', String(queueCount))

    logout()
    navigate(`/login?${params.toString()}`, { replace: true })
  }, [online, isOfflineUnlock, user, queueCount, logout, navigate])

  return null
}
