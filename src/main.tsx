import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AppWithPWA from './AppWithPWA.tsx'
import { HashFragmentRouter } from './lib/hash-router.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashFragmentRouter>
      <AppWithPWA />
    </HashFragmentRouter>
  </StrictMode>,
)
