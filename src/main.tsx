import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AppWithPWA from './AppWithPWA.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppWithPWA />
  </StrictMode>,
)
