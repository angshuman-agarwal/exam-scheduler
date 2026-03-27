export const APP_PAGES = ['home', 'today', 'progress'] as const
export type AppPage = (typeof APP_PAGES)[number]

export function isAppPage(value: string): value is AppPage {
  return (APP_PAGES as readonly string[]).includes(value)
}

export function getPageFromHash(hash: string): AppPage {
  const value = hash.startsWith('#') ? hash.slice(1) : hash
  return isAppPage(value) ? value : 'home'
}

export function getPageFromPath(pathname: string): AppPage {
  const value = pathname.replace(/^\/+/, '')
  return isAppPage(value) ? value : 'home'
}

export function getPathForPage(page: AppPage): `/${AppPage}` {
  return `/${page}`
}

export function getPathFromHash(hash: string): `/${AppPage}` {
  return getPathForPage(getPageFromHash(hash))
}
