import { type ReactNode } from 'react'
import FeedbackTrigger from './FeedbackTrigger'
import MobileFeedbackButton from './MobileFeedbackButton'
import type { AppPage } from '../lib/navigation'

interface LayoutProps {
  assistantDocked?: boolean
  children: ReactNode
  currentPage: AppPage
  onNavigate: (page: AppPage) => void
  showMobileBottomNav?: boolean
}

const NAV_ITEMS: Array<{
  label: string
  page: AppPage
  icon: ReactNode
}> = [
  {
    label: 'Home',
    page: 'home',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
      </svg>
    ),
  },
  {
    label: 'Today',
    page: 'today',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  {
    label: 'Progress',
    page: 'progress',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
]

export default function Layout({
  assistantDocked = false,
  children,
  currentPage,
  onNavigate,
  showMobileBottomNav = true,
}: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col lg:pl-[15rem]">
      <MobileFeedbackButton />
      <aside
        data-testid="desktop-left-rail"
        className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:w-[15rem] lg:flex-col lg:border-r lg:border-slate-200/85 lg:bg-[linear-gradient(180deg,rgba(252,253,255,0.98),rgba(244,247,253,0.98))] lg:px-4 lg:py-4 lg:backdrop-blur"
      >
        <nav className="grid gap-2 px-1 pt-2" aria-label="Desktop navigation">
          {NAV_ITEMS.map((item) => {
            const active = currentPage === item.page
            return (
              <button
                key={item.page}
                type="button"
                data-testid={`desktop-nav-${item.page}`}
                aria-current={active ? 'page' : undefined}
                onClick={() => onNavigate(item.page)}
                className={`group flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-[0.92rem] font-semibold transition ${
                  active
                    ? 'relative mr-[-0.75rem] rounded-[1.15rem] rounded-r-none border border-blue-100/80 bg-[linear-gradient(90deg,rgba(240,246,255,0.96),rgba(232,240,255,0.7)_70%,rgba(232,240,255,0.12)_100%)] text-blue-700 shadow-[inset_3px_0_0_#305dff,0_12px_28px_rgba(48,93,255,0.12)]'
                    : 'mr-[-0.75rem] rounded-[1.15rem] rounded-r-none border border-transparent text-slate-500 hover:border-white/80 hover:bg-[linear-gradient(90deg,rgba(255,255,255,0.96),rgba(255,255,255,0.64)_75%,rgba(255,255,255,0.16)_100%)] hover:text-slate-800 hover:shadow-[0_10px_24px_rgba(15,23,42,0.05)]'
                }`}
              >
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-full transition-all ${
                    active
                      ? 'bg-[linear-gradient(180deg,#ffffff_0%,#eef4ff_100%)] text-blue-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_6px_14px_rgba(48,93,255,0.16)]'
                      : 'bg-white/72 text-slate-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] group-hover:text-slate-600'
                  }`}
                >
                  {item.icon}
                </span>
                <span className="tracking-[-0.01em]">{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="mx-1 mt-auto">
          <FeedbackTrigger />
        </div>
      </aside>

      <main
        className={`flex-1 overflow-y-auto pb-20 transition-[padding] duration-300 ${
          assistantDocked ? 'lg:pr-[22rem]' : ''
        }`}
      >
        {children}
      </main>

      {showMobileBottomNav && (
        <nav data-testid="mobile-bottom-nav" className="fixed bottom-0 left-0 right-0 ios-glass flex z-50 lg:hidden">
          {NAV_ITEMS.map((item) => {
            const active = currentPage === item.page
            return (
              <button
                key={item.page}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => onNavigate(item.page)}
                className={`flex-1 py-3 text-sm font-medium text-center transition-colors ${
                  active ? 'text-system-blue' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <span className="mx-auto mb-0.5 block w-5 h-5">{item.icon}</span>
                {item.label}
              </button>
            )
          })}
        </nav>
      )}
    </div>
  )
}
