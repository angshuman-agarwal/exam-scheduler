import { useEffect, useRef } from 'react'

const FEEDBACK_SHARE_URL = 'https://forms.gle/w6soC6KGVLjhmSNt7'
const FEEDBACK_EMBED_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSdCyKe8UJAyKsUMQzIVVvS8tis6pki0MiAt0H6BhJDlLxHiow/viewform?embedded=true'

export default function FeedbackSheet({ onClose }: { onClose: () => void }) {
  const backdropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose()
  }

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdrop}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-sm"
    >
      <div className="w-full max-w-lg max-h-[90vh] bg-white rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2.5">
            <svg className="w-5 h-5 text-blue-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 1 1 0-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38a1.125 1.125 0 0 1-1.536-.41 12.012 12.012 0 0 1-1.634-4.264m5.305-5.305c.688.06 1.386.09 2.09.09h.75a4.5 4.5 0 0 1 0 9h-.75c-.704 0-1.402.03-2.09.09m0-9.18c-.253-.962-.584-1.892-.985-2.783a1.125 1.125 0 0 1 .463-1.511l.657-.38c.55-.318 1.247-.106 1.536.41a12.012 12.012 0 0 1 1.634 4.264" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-gray-900">Share feedback</p>
              <p className="text-xs text-gray-400">This takes less than a minute.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden px-5 pb-2">
          <iframe
            src={FEEDBACK_EMBED_URL}
            title="Feedback form"
            className="w-full rounded-lg border border-gray-100 bg-white"
            style={{ height: '70vh', maxHeight: 'calc(90vh - 140px)' }}
          />
        </div>

        {/* Fallback link */}
        <div className="px-5 pb-4 pt-1">
          <a
            href={FEEDBACK_SHARE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-400 hover:text-gray-500 transition-colors"
          >
            Open in browser
          </a>
        </div>
      </div>
    </div>
  )
}
