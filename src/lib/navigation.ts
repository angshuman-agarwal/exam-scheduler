import { useEffect, useState } from 'react'

export const APP_PAGES = ['home', 'today', 'progress'] as const
export type AppPage = (typeof APP_PAGES)[number]

export function isAppPage(value: string): value is AppPage {
  return (APP_PAGES as readonly string[]).includes(value)
}

export function getPageFromHash(hash: string): AppPage {
  const value = hash.startsWith('#') ? hash.slice(1) : hash
  return isAppPage(value) ? value : 'home'
}

export function useHashPageNavigation() {
  const [page, setPage] = useState<AppPage>(() => getPageFromHash(window.location.hash))

  useEffect(() => {
    if (!isAppPage(window.location.hash.slice(1))) {
      window.history.replaceState(null, '', '#home')
    }

    const onHashChange = () => setPage(getPageFromHash(window.location.hash))
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  function navigateTo(nextPage: AppPage) {
    if (window.location.hash === '#' + nextPage) {
      setPage(nextPage)
      return
    }

    window.location.hash = '#' + nextPage
  }

  return { page, navigateTo }
}
