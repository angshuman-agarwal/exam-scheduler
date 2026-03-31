import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Router, createPath, parsePath, type To } from 'react-router-dom'
import { getPathFromHash } from './navigation'

function normalizePathname(pathname?: string | null) {
  if (!pathname || pathname === '/') return '/home'
  return pathname.startsWith('/') ? pathname : `/${pathname}`
}

function getLocation() {
  const path = parsePath(getPathFromHash(window.location.hash))

  return {
    pathname: normalizePathname(path.pathname),
    search: path.search ?? '',
    hash: path.hash ?? '',
    state: window.history.state,
    key: 'default',
  }
}

function toHashHref(to: To) {
  const path = typeof to === 'string' ? parsePath(to) : to
  const href = createPath({
    ...path,
    pathname: normalizePathname(path.pathname),
  })

  return `#${href.replace(/^\/+/, '')}`
}

export function HashFragmentRouter({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState(getLocation)

  useEffect(() => {
    if (!window.location.hash || window.location.hash === '#') {
      window.history.replaceState(window.history.state, '', '#home')
    }

    const syncLocation = () => setLocation(getLocation())
    window.addEventListener('hashchange', syncLocation)
    window.addEventListener('popstate', syncLocation)

    return () => {
      window.removeEventListener('hashchange', syncLocation)
      window.removeEventListener('popstate', syncLocation)
    }
  }, [])

  const navigator = useMemo(
    () => ({
      createHref(to: To) {
        return toHashHref(to)
      },
      push(to: To, state?: unknown) {
        window.history.pushState(state, '', toHashHref(to))
        setLocation(getLocation())
      },
      replace(to: To, state?: unknown) {
        window.history.replaceState(state, '', toHashHref(to))
        setLocation(getLocation())
      },
      go(delta: number) {
        window.history.go(delta)
      },
      back() {
        window.history.back()
      },
      forward() {
        window.history.forward()
      },
    }),
    [],
  )

  return (
    <Router location={location} navigator={navigator}>
      {children}
    </Router>
  )
}
