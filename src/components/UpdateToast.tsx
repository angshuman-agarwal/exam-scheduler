import { type Dispatch, type SetStateAction, useEffect, useRef, useState } from 'react'

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

    try {
      await Promise.race([
        updateServiceWorker(true),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
      ])
    } catch {
      // SW update failed or timed out — fall through to hard reload
    }

    // If the SW reload already navigated away, this won't run.
    // Otherwise, force a hard reload as fallback.
    location.reload()
  }

  if (forceRefresh) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/95 backdrop-blur-sm">
        <div className="text-center px-6 max-w-sm">
          <p className="text-lg font-semibold text-gray-900">Update required</p>
          <p className="text-sm text-gray-600 mt-2">
            Your version of Exam Scheduler is no longer supported. Please refresh to continue.
          </p>
          <button
            onClick={handleForceRefresh}
            className="mt-5 px-6 py-2.5 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors"
          >
            Refresh now
          </button>
        </div>
      </div>
    )
  }

  if (needRefreshValue) {
    return (
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-white border border-gray-200 rounded-xl px-5 py-4 shadow-lg max-w-sm w-[calc(100%-2rem)]">
        <p className="text-sm font-semibold text-gray-900">Update available</p>
        <p className="text-sm text-gray-600 mt-1">
          A new version of Exam Scheduler is ready.
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
