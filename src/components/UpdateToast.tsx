import { type Dispatch, type SetStateAction, useEffect, useRef, useState } from 'react'
import { useTimerStore } from '../stores/timer.store'

interface UpdateToastProps {
  needRefresh: [boolean, Dispatch<SetStateAction<boolean>>]
  offlineReady: [boolean, Dispatch<SetStateAction<boolean>>]
  updateServiceWorker: (reloadPage?: boolean) => Promise<void>
  forceRefresh: boolean
}

export default function UpdateToast({
  needRefresh,
  offlineReady,
  updateServiceWorker,
  forceRefresh,
}: UpdateToastProps) {
  const [needRefreshValue, setNeedRefresh] = needRefresh
  const [offlineReadyValue, setOfflineReady] = offlineReady

  const hasActiveSessionFlow = useTimerStore((s) => s.session !== null)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (offlineReadyValue) {
      timerRef.current = setTimeout(() => setOfflineReady(false), 3000)
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current)
      }
    }
  }, [offlineReadyValue, setOfflineReady])

  const handleForceRefresh = async () => {
    if (refreshing) return
    setRefreshing(true)

    let reloaded = false
    const triggerReload = () => {
      if (reloaded) return
      reloaded = true
      location.reload()
    }

    const sw = 'serviceWorker' in navigator ? navigator.serviceWorker : null

    let fallback: ReturnType<typeof setTimeout> | null = null

    const cleanup = () => {
      if (fallback) clearTimeout(fallback)
      if (sw) sw.removeEventListener('controllerchange', onControllerChange)
    }

    const onControllerChange = () => { cleanup(); triggerReload() }

    if (sw) sw.addEventListener('controllerchange', onControllerChange)

    fallback = setTimeout(() => { cleanup(); triggerReload() }, 3000)

    try {
      const reg = await sw?.getRegistration()
      await reg?.update()
      await updateServiceWorker(true)
    } catch {
      // fallback timer will fire
    }
  }

  if (forceRefresh) {
    const refreshButton = (
      <button
        onClick={handleForceRefresh}
        disabled={refreshing}
        className={`px-6 py-2.5 text-sm font-medium rounded-lg transition-colors ${
          refreshing
            ? 'opacity-60 cursor-not-allowed'
            : ''
        } ${
          hasActiveSessionFlow
            ? 'text-gray-700 bg-gray-100 hover:bg-gray-200'
            : 'text-white bg-blue-500 hover:bg-blue-600'
        }`}
      >
        {refreshing ? 'Refreshing...' : 'Refresh now'}
      </button>
    )

    if (hasActiveSessionFlow) {
      return (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-white border border-gray-200 rounded-xl px-5 py-4 shadow-lg max-w-sm w-[calc(100%-2rem)]">
          <p className="text-sm font-semibold text-gray-900">Refresh required</p>
          <p className="text-sm text-gray-600 mt-1">
            Finish this session first if needed, then refresh to continue.
          </p>
          <div className="mt-3">
            {refreshButton}
          </div>
        </div>
      )
    }

    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-white border border-gray-200 rounded-xl px-6 py-5 shadow-xl max-w-md w-[calc(100%-2rem)]">
        <p className="text-lg font-semibold text-gray-900">Update required</p>
        <p className="text-sm text-gray-600 mt-2">
          Your version of Study Hour is no longer supported. Please refresh to continue.
        </p>
        <div className="mt-4">
          {refreshButton}
        </div>
      </div>
    )
  }

  if (needRefreshValue) {
    return (
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-white border border-gray-200 rounded-xl px-5 py-4 shadow-lg max-w-sm w-[calc(100%-2rem)]">
        <p className="text-sm font-semibold text-gray-900">Update available</p>
        <p className="text-sm text-gray-600 mt-1">
          A new version of Study Hour is ready.
        </p>
        <div className="flex gap-3 mt-3">
          <button
            onClick={() => updateServiceWorker(true)}
            className="px-4 py-1.5 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors"
          >
            Refresh
          </button>
          <button
            onClick={() => setNeedRefresh(false)}
            className="px-4 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
          >
            Later
          </button>
        </div>
      </div>
    )
  }

  if (offlineReadyValue) {
    return (
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 shadow-lg">
        <p className="text-sm text-green-700">App ready offline</p>
      </div>
    )
  }

  return null
}
