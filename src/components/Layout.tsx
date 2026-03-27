import { type ReactNode } from 'react'
import type { AppPage } from '../lib/navigation'

interface LayoutProps {
  children: ReactNode
  currentPage: AppPage
  onNavigate: (page: AppPage) => void
}

export default function Layout({ children, currentPage, onNavigate }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 overflow-y-auto pb-20">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 ios-glass flex z-50">
        <button
          type="button"
          aria-current={currentPage === 'home' ? 'page' : undefined}
          onClick={() => onNavigate('home')}
          className={`flex-1 py-3 text-sm font-medium text-center transition-colors ${
            currentPage === 'home' ? 'text-system-blue' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <svg className="w-5 h-5 mx-auto mb-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
          </svg>
          Home
        </button>
        <button
          type="button"
          aria-current={currentPage === 'today' ? 'page' : undefined}
          onClick={() => onNavigate('today')}
          className={`flex-1 py-3 text-sm font-medium text-center transition-colors ${
            currentPage === 'today' ? 'text-system-blue' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <svg className="w-5 h-5 mx-auto mb-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          Today
        </button>
        <button
          type="button"
          aria-current={currentPage === 'progress' ? 'page' : undefined}
          onClick={() => onNavigate('progress')}
          className={`flex-1 py-3 text-sm font-medium text-center transition-colors ${
            currentPage === 'progress' ? 'text-system-blue' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <svg className="w-5 h-5 mx-auto mb-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Progress
        </button>
      </nav>
    </div>
  )
}
