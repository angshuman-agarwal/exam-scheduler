import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { usePostHog } from 'posthog-js/react'
import { getPageFromPath, getPathForPage, type AppPage } from '../lib/navigation'

export function useAppNavigation() {
  const location = useLocation()
  const navigate = useNavigate()
  const posthog = usePostHog()
  const page = getPageFromPath(location.pathname)

  useEffect(() => {
    if (location.pathname === '/' || getPathForPage(page) !== location.pathname) {
      navigate(getPathForPage(page), { replace: true })
    }
  }, [location.pathname, navigate, page])

  useEffect(() => {
    posthog?.capture('$pageview', { page })
  }, [page, posthog])

  return {
    page,
    navigateTo(nextPage: AppPage) {
      navigate(getPathForPage(nextPage))
    },
  }
}
