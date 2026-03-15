import { useEffect } from 'react'
import type { PublicPageRecord } from '../lib/publicPages'

interface PublicSeoPageProps {
  page: PublicPageRecord
}

const X_URL = 'https://x.com/studyhourlabs'

function XIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M21.742 21.75l-7.563-11.179 7.056-8.321h-2.456l-5.691 6.714-4.54-6.714H2.359l7.29 10.776L2.25 21.75h2.456l6.035-7.118 4.818 7.118h6.191-.008zM7.739 3.818L18.81 20.182h-2.447L5.29 3.818h2.447z" />
    </svg>
  )
}

function ensureMeta(name: string, attr: 'name' | 'property') {
  const selector = `meta[${attr}="${name}"]`
  let element = document.head.querySelector<HTMLMetaElement>(selector)
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attr, name)
    document.head.appendChild(element)
  }
  return element
}

export default function PublicSeoPage({ page }: PublicSeoPageProps) {
  useEffect(() => {
    document.title = page.meta.title

    ensureMeta('description', 'name').setAttribute('content', page.meta.description)
    ensureMeta('og:url', 'property').setAttribute('content', page.meta.canonicalUrl)
    ensureMeta('og:site_name', 'property').setAttribute('content', 'Study Hour')
    ensureMeta('og:title', 'property').setAttribute('content', page.meta.ogTitle)
    ensureMeta('og:description', 'property').setAttribute('content', page.meta.ogDescription)
    ensureMeta('og:type', 'property').setAttribute('content', 'website')
    ensureMeta('twitter:card', 'name').setAttribute('content', 'summary')
    ensureMeta('twitter:site', 'name').setAttribute('content', '@studyhourlabs')
    ensureMeta('twitter:title', 'name').setAttribute('content', page.meta.twitterTitle)
    ensureMeta('twitter:description', 'name').setAttribute('content', page.meta.twitterDescription)

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.appendChild(canonical)
    }
    canonical.href = page.meta.canonicalUrl
  }, [page])

  return (
    <div
      data-testid={`seo-page-${page.id}`}
      className="min-h-screen"
      style={{ backgroundColor: '#faf9f7' }}
    >
      <section className="px-5 pt-14 pb-10 sm:pt-20 sm:pb-16 max-w-5xl mx-auto">
        <div className="flex justify-end mb-3">
          <a
            href={X_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open Study Hour on X"
            className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition"
          >
            <XIcon className="w-3.5 h-3.5" />
            <span>@studyhourlabs</span>
          </a>
        </div>
        <div className="ios-card p-6 sm:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-system-blue mb-3">
            {page.hero.eyebrow}
          </p>
          <h1 className="text-3xl sm:text-5xl font-bold text-gray-900 tracking-tight leading-tight max-w-3xl mb-4">
            {page.hero.headline}
          </h1>
          <p className="text-base text-gray-500 leading-relaxed max-w-2xl mb-6">
            {page.hero.intro}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <a
              data-testid="seo-page-primary-cta"
              href={page.cta.href}
              className="px-6 py-3 ios-button text-sm inline-flex items-center justify-center"
            >
              {page.cta.label}
            </a>
            <span className="text-xs text-gray-400">No login required. No ads. No tracking. Works offline.</span>
          </div>
        </div>
      </section>

      <section className="px-5 pb-10 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="ios-card p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 mb-3">
              Problem
            </p>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">{page.problem.title}</h2>
            <div className="space-y-3">
              {page.problem.points.map((point) => (
                <p key={point} className="text-sm text-gray-500 leading-relaxed">{point}</p>
              ))}
            </div>
          </div>
          <div className="ios-card p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 mb-3">
              Contrast
            </p>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">{page.contrast.title}</h2>
            <div className="space-y-3">
              {page.contrast.points.map((point) => (
                <p key={point} className="text-sm text-gray-500 leading-relaxed">{point}</p>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 pb-10 max-w-5xl mx-auto">
        <div className="ios-card p-6 sm:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-system-blue mb-3">
            How Study Hour helps
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">{page.solution.title}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {page.solution.points.map((point) => (
              <div key={point.title} className="rounded-2xl border border-black/5 bg-gray-50/70 p-5">
                <p className="text-sm font-semibold text-gray-900 mb-2">{point.title}</p>
                <p className="text-sm text-gray-500 leading-relaxed">{point.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 pb-10 max-w-5xl mx-auto">
        <div className="ios-card p-6 sm:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 mb-3">
            FAQs
          </p>
          <div className="space-y-5">
            {page.faq.map((item) => (
              <div key={item.question}>
                <h2 className="text-base font-semibold text-gray-900 mb-1.5">{item.question}</h2>
                <p className="text-sm text-gray-500 leading-relaxed">{item.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 pb-16 max-w-5xl mx-auto">
        <div className="ios-card p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 mb-1">
              Ready to try it?
            </p>
            <p className="text-lg font-semibold text-gray-900">Start your revision schedule and see what to revise next.</p>
          </div>
          <a
            href={page.cta.href}
            className="px-6 py-3 ios-button text-sm inline-flex items-center justify-center shrink-0"
          >
            {page.cta.label}
          </a>
        </div>
      </section>
    </div>
  )
}
