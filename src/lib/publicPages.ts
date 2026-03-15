import publicPagesData from '../data/public-pages.json' with { type: 'json' }

export interface PublicPageMeta {
  title: string
  description: string
  canonicalUrl: string
  ogTitle: string
  ogDescription: string
  twitterTitle: string
  twitterDescription: string
}

export interface PublicPageRecord {
  id: string
  path: string
  meta: PublicPageMeta
  hero: {
    eyebrow: string
    headline: string
    intro: string
  }
  problem: {
    title: string
    points: string[]
  }
  contrast: {
    title: string
    points: string[]
  }
  solution: {
    title: string
    points: Array<{
      title: string
      description: string
    }>
  }
  faq: Array<{
    question: string
    answer: string
  }>
  cta: {
    label: string
    href: string
  }
  card: {
    eyebrow: string
    title: string
    description: string
  }
}

interface PublicPagesData {
  pages: PublicPageRecord[]
}

const publicPages = (publicPagesData as PublicPagesData).pages

function normalizePathname(pathname: string): string {
  if (pathname === '/') return pathname
  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
}

export function getPublicPageByPath(pathname: string): PublicPageRecord | null {
  const normalizedPathname = normalizePathname(pathname)
  return publicPages.find((page) => normalizePathname(page.path) === normalizedPathname) ?? null
}

export function getHomepageExplorePages(): PublicPageRecord[] {
  return publicPages
}

export function getPublicPages(): PublicPageRecord[] {
  return publicPages
}
