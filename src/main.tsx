import { StrictMode, useCallback, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { useRegisterSW } from 'virtual:pwa-register/react'
import './index.css'
import App from './App.tsx'
import UpdateToast from './components/UpdateToast.tsx'
import { checkVersion } from './lib/version.ts'

function AppWithPWA() {
  const { needRefresh, offlineReady, updateServiceWorker } = useRegisterSW()
  const [forceRefresh, setForceRefresh] = useState(false)

  const runVersionCheck = useCallback(async () => {
    const result = await checkVersion()
    setForceRefresh(result.forceRefresh)
  }, [])

  useEffect(() => {
    runVersionCheck()

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        runVersionCheck()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [runVersionCheck])

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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppWithPWA />
  </StrictMode>,
)
