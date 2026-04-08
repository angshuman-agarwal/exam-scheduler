import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PostHogProvider } from 'posthog-js/react'
import './index.css'
import AppWithPWA from './AppWithPWA.tsx'
import { HashFragmentRouter } from './lib/hash-router.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PostHogProvider
      apiKey="phc_wVj8R3WTWTNfoVZMDqg7KPsbg2dZncApt3XChAdRHHta"
      options={{
        api_host: 'https://eu.i.posthog.com',
        defaults: '2026-01-30',
        before_send: (event) => {
          if (event?.properties?.['$host']?.includes('localhost')) return null
          return event
        },
      }}
    >
      <HashFragmentRouter>
        <AppWithPWA />
      </HashFragmentRouter>
    </PostHogProvider>
  </StrictMode>,
)
