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
        type="button"
        data-testid="mobile-feedback-button"
        onClick={() => { posthog?.capture('feedback_open', { source: 'mobile_fab' }); setOpen(true) }}
        className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-40 inline-flex items-center gap-2.5 rounded-full border border-blue-100/90 bg-white/92 px-3.5 py-2 text-left shadow-[0_12px_28px_rgba(15,23,42,0.12),0_3px_8px_rgba(37,99,235,0.08)] backdrop-blur-md transition-all duration-150 hover:translate-y-[-1px] hover:shadow-[0_16px_34px_rgba(15,23,42,0.14),0_6px_14px_rgba(37,99,235,0.1)] active:scale-[0.98] lg:hidden"
        aria-label="Share feedback"
      >
        <span className="grid h-8 w-8 place-items-center rounded-full bg-[linear-gradient(180deg,#4f9bff_0%,#2f7cff_100%)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_6px_12px_rgba(47,124,255,0.3)]">
          <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.9}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
          </svg>
        </span>
        <span className="min-w-0">
          <span className="block text-[12px] font-semibold leading-4 text-slate-800">Share feedback</span>
          <span className="mt-0.5 block text-[10px] font-medium leading-4 text-slate-500">Quick thought?</span>
        </span>
      </button>
      {open && createPortal(<FeedbackSheet onClose={() => setOpen(false)} />, document.body)}
    </>
  )
}
