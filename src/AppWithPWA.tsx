import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import App from './App.tsx'
import UpdateToast from './components/UpdateToast.tsx'
import { checkVersion } from './lib/version.ts'

export default function AppWithPWA() {
  const { needRefresh, offlineReady, updateServiceWorker } = useRegisterSW()
  const [forceRefresh, setForceRefresh] = useState(false)

  useEffect(() => {
    let cancelled = false
    checkVersion().then((result) => {
      if (!cancelled) setForceRefresh(result.forceRefresh)
    })
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkVersion().then((result) => {
          if (!cancelled) setForceRefresh(result.forceRefresh)
        })
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  return (
    <>
      <App />
      <UpdateToast
        needRefresh={needRefresh}
        offlineReady={offlineReady}
        updateServiceWorker={updateServiceWorker}
        forceRefresh={forceRefresh}
      />
    </>
  )
}
