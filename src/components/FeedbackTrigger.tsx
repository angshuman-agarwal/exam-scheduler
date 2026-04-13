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
        type="button"
        data-testid="desktop-feedback-trigger"
        onClick={() => { posthog?.capture('feedback_open', { source: 'desktop_rail' }); setOpen(true) }}
        className="group mt-3 w-full rounded-[1.35rem] border border-blue-100/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(244,248,255,0.96))] px-4 py-4 text-left shadow-[0_10px_24px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,0.95)] transition-all duration-150 hover:translate-y-[-1px] hover:border-blue-200 hover:shadow-[0_16px_32px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.98)] active:scale-[0.985]"
      >
        <div className="flex items-center gap-3.5">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[0.95rem] border border-blue-100/80 bg-white shadow-[0_6px_16px_rgba(15,23,42,0.05),inset_0_1px_0_rgba(255,255,255,0.98)] transition-shadow group-hover:shadow-[0_10px_22px_rgba(37,99,235,0.1),inset_0_1px_0_rgba(255,255,255,0.98)]">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-[linear-gradient(180deg,#edf4ff_0%,#dce9ff_100%)] text-blue-600">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
              </svg>
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold leading-4 text-slate-800">Share feedback</p>
            <p className="mt-1 text-[10.5px] font-medium leading-4 text-slate-500">Quick thought?</p>
          </div>
        </div>
      </button>
      {open && createPortal(<FeedbackSheet onClose={() => setOpen(false)} />, document.body)}
    </>
  )
}
