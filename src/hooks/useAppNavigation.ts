import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getPageFromPath, getPathForPage, type AppPage } from '../lib/navigation'

export function useAppNavigation() {
  const location = useLocation()
  const navigate = useNavigate()
  const page = getPageFromPath(location.pathname)

  useEffect(() => {
    if (location.pathname === '/' || getPathForPage(page) !== location.pathname) {
      navigate(getPathForPage(page), { replace: true })
    }
  }, [location.pathname, navigate, page])

  return {
    page,
    navigateTo(nextPage: AppPage) {
      navigate(getPathForPage(nextPage))
    },
  }
}
