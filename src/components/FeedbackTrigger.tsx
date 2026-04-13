import { useState } from 'react'
import { createPortal } from 'react-dom'
import { usePostHog } from 'posthog-js/react'
import FeedbackSheet from './FeedbackSheet'

export default function FeedbackTrigger() {
  const [open, setOpen] = useState(false)
  const posthog = usePostHog()

  return (
    <>
      <button
        onClick={() => { posthog?.capture('feedback_open', { source: 'desktop_rail' }); setOpen(true) }}
        className="group mt-3 w-full rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 px-4 py-4 flex items-center gap-3.5 hover:from-blue-100 hover:to-indigo-100 hover:border-blue-200 hover:shadow-sm active:scale-[0.98] transition-all duration-150 text-left"
      >
        <div className="shrink-0 w-8 h-8 rounded-xl bg-white shadow-sm border border-blue-100 flex items-center justify-center group-hover:shadow transition-shadow">
          <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-blue-700">Share feedback</p>
          <p className="text-[11px] text-blue-400 mt-0.5">Takes a few seconds</p>
        </div>
      </button>
      {open && createPortal(<FeedbackSheet onClose={() => setOpen(false)} />, document.body)}
    </>
  )
}
