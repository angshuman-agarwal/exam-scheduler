import { type ReactNode } from 'react'
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
      <aside
        data-testid="desktop-left-rail"
        className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:w-[15rem] lg:flex-col lg:border-r lg:border-slate-200/90 lg:bg-[linear-gradient(180deg,rgba(252,253,255,0.98),rgba(246,249,255,0.98))] lg:px-4 lg:py-5 lg:backdrop-blur"
      >
        <div className="mb-7 px-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#305dff,#1325ec)] text-white shadow-[0_12px_22px_rgba(48,93,255,0.2)]">
              <span className="text-base font-bold">S</span>
            </div>
            <div>
              <p className="text-[1.05rem] font-bold tracking-tight text-slate-900">StudyHour</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Revision OS</p>
            </div>
          </div>
        </div>

        <nav className="grid gap-1.5 px-1" aria-label="Desktop navigation">
          {NAV_ITEMS.map((item) => {
            const active = currentPage === item.page
            return (
              <button
                key={item.page}
                type="button"
                data-testid={`desktop-nav-${item.page}`}
                aria-current={active ? 'page' : undefined}
                onClick={() => onNavigate(item.page)}
                className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-[0.92rem] font-semibold transition ${
                  active
                    ? 'bg-blue-50/90 text-blue-700 shadow-[inset_3px_0_0_#305dff,0_10px_18px_rgba(48,93,255,0.08)]'
                    : 'text-slate-500 hover:bg-white/90 hover:text-slate-800'
                }`}
              >
                <span className={active ? 'text-blue-600' : 'text-slate-400'}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="mt-auto rounded-[1.25rem] border border-slate-200/90 bg-white/90 p-4 shadow-[0_14px_28px_rgba(15,23,42,0.05)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Stay on track</p>
          <p className="mt-2 text-[13px] leading-relaxed text-slate-600">
            Keep your plan, progress, and assistant within one focused desktop workspace.
          </p>
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
