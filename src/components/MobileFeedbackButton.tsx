import { useState } from 'react'
import { createPortal } from 'react-dom'
import { usePostHog } from 'posthog-js/react'
import FeedbackSheet from './FeedbackSheet'

export default function MobileFeedbackButton() {
  const [open, setOpen] = useState(false)
  const posthog = usePostHog()

  return (
    <>
      <button
        onClick={() => { posthog?.capture('feedback_open', { source: 'mobile_fab' }); setOpen(true) }}
        className="lg:hidden fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-5 z-40 w-10 h-10 rounded-full bg-gradient-to-b from-blue-400 to-blue-500 border border-blue-600/30 flex items-center justify-center transition-all duration-150 active:scale-95"
        style={{ boxShadow: '0 2px 0 #2563eb, 0 4px 10px rgba(59,130,246,0.35), 0 1px 3px rgba(0,0,0,0.10)' }}
        aria-label="Share feedback"
      >
        <svg className="w-5 h-5 text-white drop-shadow-sm" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
        </svg>
      </button>
      {open && createPortal(<FeedbackSheet onClose={() => setOpen(false)} />, document.body)}
    </>
  )
}
