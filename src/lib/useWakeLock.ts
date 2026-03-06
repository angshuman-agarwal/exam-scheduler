import { useState, useEffect, useRef, useCallback } from 'react'

interface WakeLockResult {
  supported: boolean
  active: boolean
  error: string | null
}

export function useWakeLock(enabled: boolean): WakeLockResult {
  const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator
  const [active, setActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sentinelRef = useRef<WakeLockSentinel | null>(null)

  const release = useCallback(async () => {
    if (sentinelRef.current) {
      try {
        await sentinelRef.current.release()
      } catch {
        // ignore
      }
      sentinelRef.current = null
      setActive(false)
    }
  }, [])

  const request = useCallback(async () => {
    if (!supported || document.hidden || sentinelRef.current) return
    try {
      sentinelRef.current = await navigator.wakeLock.request('screen')
      setActive(true)
      setError(null)
      sentinelRef.current.addEventListener('release', () => {
        sentinelRef.current = null
        setActive(false)
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Wake lock failed')
      setActive(false)
    }
  }, [supported])

  useEffect(() => {
    if (!enabled || !supported) {
      // Release without triggering setState synchronously in effect body
      const sentinel = sentinelRef.current
      if (sentinel) {
        sentinel.release().catch(() => {})
        sentinelRef.current = null
      }
      return
    }

    // Defer to avoid synchronous setState in effect body
    const id = setTimeout(() => request(), 0)

    const onVisible = () => {
      if (!document.hidden && enabled) {
        request()
      }
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearTimeout(id)
      document.removeEventListener('visibilitychange', onVisible)
      release()
    }
  }, [enabled, supported, request, release])

  return { supported, active, error }
}
