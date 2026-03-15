/**
 * Post-build script: injects SEO metadata and static landing HTML
 * into dist/index.html and any configured public route pages.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distHtmlPath = resolve(__dirname, '../dist/index.html')
const landingCopyPath = resolve(__dirname, '../src/data/landing-copy.json')
const publicPagesPath = resolve(__dirname, '../src/data/public-pages.json')

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/[^\x20-\x7E\n\r\t]/g, ch => `&#${ch.codePointAt(0)};`)
}

function escapeAttr(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/[^\x20-\x7E\n\r\t]/g, ch => `&#${ch.codePointAt(0)};`)
}

function requireString(obj, path) {
  const val = path.split('.').reduce((o, k) => o?.[k], obj)
  if (typeof val !== 'string' || val.trim() === '') {
    throw new Error(`missing or empty field "${path}"`)
  }
  return val
}

function requireArray(obj, path, minLength = 1) {
  const val = path.split('.').reduce((o, k) => o?.[k], obj)
  if (!Array.isArray(val) || val.length < minLength) {
    throw new Error(`"${path}" must be an array with at least ${minLength} item(s)`)
  }
  return val
}

function buildHead(meta) {
  return [
    `<meta name="description" content="${escapeAttr(meta.description)}" />`,
    `<link rel="canonical" href="${escapeAttr(meta.canonicalUrl)}" />`,
    `<meta property="og:url" content="${escapeAttr(meta.canonicalUrl)}" />`,
    `<meta property="og:site_name" content="Study Hour" />`,
    `<meta property="og:title" content="${escapeAttr(meta.ogTitle)}" />`,
    `<meta property="og:description" content="${escapeAttr(meta.ogDescription)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta name="twitter:card" content="summary" />`,
    `<meta name="twitter:site" content="${escapeAttr(meta.twitterSite ?? '@studyhourlabs')}" />`,
    `<meta name="twitter:title" content="${escapeAttr(meta.twitterTitle)}" />`,
    `<meta name="twitter:description" content="${escapeAttr(meta.twitterDescription)}" />`,
  ].join('\n    ')
}

function injectSeo(templateHtml, title, headBlock, bodyBlock) {
  let html = templateHtml

  if (!html.includes('<!-- __SEO_HEAD__ -->')) {
    throw new Error('dist/index.html is missing <!-- __SEO_HEAD__ --> placeholder')
  }
  if (!html.includes('<!-- __SEO_BODY__ -->')) {
    throw new Error('dist/index.html is missing <!-- __SEO_BODY__ --> placeholder')
  }
  if (!html.includes('<!-- __SEO_TITLE__ -->')) {
    throw new Error('dist/index.html is missing <!-- __SEO_TITLE__ --> placeholder')
  }

  html = html.replace(/<!-- __SEO_TITLE__ -->\s*<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`)
  html = html.replace('<!-- __SEO_HEAD__ -->', headBlock)
  html = html.replace('<!-- __SEO_BODY__ -->', bodyBlock)

  if (html.includes('__SEO_HEAD__') || html.includes('__SEO_BODY__') || html.includes('__SEO_TITLE__')) {
    throw new Error('Unresolved SEO placeholders remain in dist/index.html')
  }

  return html
}

function buildLandingBody(copy) {
  const hero = copy.hero
  const stepsHtml = copy.steps.map((s) =>
    `<h3>${s.step}. ${escapeHtml(s.title)}</h3>\n<p>${escapeHtml(s.description)}</p>`
  ).join('\n')

  const scenariosHtml = copy.scenarios.map((s) =>
    `<h3>${escapeHtml(s.situation)}</h3>\n<p>${escapeHtml(s.response)}</p>`
  ).join('\n')

  const featuresHtml = copy.trustFeatures.map((f) =>
    `<li><strong>${escapeHtml(f.title)}</strong> &mdash; ${escapeHtml(f.description)}</li>`
  ).join('\n')

  const headings = copy.sectionHeadings
  return `<main style="max-width:640px;margin:0 auto;padding:48px 16px;font-family:system-ui,sans-serif">
<p>${escapeHtml(hero.tagline)}</p>
<h1>${escapeHtml(hero.headline)}</h1>
<p>${escapeHtml(hero.subheadline)}</p>
<h2>${escapeHtml(headings.howItWorks)}</h2>
${stepsHtml}
<h2>${escapeHtml(headings.scenarios)}</h2>
${scenariosHtml}
<h2>${escapeHtml(headings.trust)}</h2>
<ul>
${featuresHtml}
</ul>
</main>`
}

function buildPublicPageBody(page) {
  const problemPoints = page.problem.points.map((point) => `<li>${escapeHtml(point)}</li>`).join('\n')
  const contrastPoints = page.contrast.points.map((point) => `<li>${escapeHtml(point)}</li>`).join('\n')
  const solutionPoints = page.solution.points.map((point) =>
    `<li><strong>${escapeHtml(point.title)}</strong> &mdash; ${escapeHtml(point.description)}</li>`
  ).join('\n')
  const faqHtml = page.faq.map((item) =>
    `<h3>${escapeHtml(item.question)}</h3>\n<p>${escapeHtml(item.answer)}</p>`
  ).join('\n')

  return `<main style="max-width:720px;margin:0 auto;padding:48px 16px;font-family:system-ui,sans-serif">
<p>${escapeHtml(page.hero.eyebrow)}</p>
<h1>${escapeHtml(page.hero.headline)}</h1>
<p>${escapeHtml(page.hero.intro)}</p>
<p><a href="${escapeAttr(page.cta.href)}">${escapeHtml(page.cta.label)}</a></p>
<h2>${escapeHtml(page.problem.title)}</h2>
<ul>
${problemPoints}
</ul>
<h2>${escapeHtml(page.contrast.title)}</h2>
<ul>
${contrastPoints}
</ul>
<h2>${escapeHtml(page.solution.title)}</h2>
<ul>
${solutionPoints}
</ul>
<h2>FAQs</h2>
${faqHtml}
</main>`
}

if (!existsSync(distHtmlPath)) {
  console.error('dist/index.html not found - run vite build first')
  process.exit(1)
}

const landingCopy = JSON.parse(readFileSync(landingCopyPath, 'utf-8'))
const publicPagesData = JSON.parse(readFileSync(publicPagesPath, 'utf-8'))

requireString(landingCopy, 'meta.title')
requireString(landingCopy, 'meta.description')
requireString(landingCopy, 'meta.canonicalUrl')
requireString(landingCopy, 'meta.ogTitle')
requireString(landingCopy, 'meta.ogDescription')
requireString(landingCopy, 'meta.twitterTitle')
requireString(landingCopy, 'meta.twitterDescription')
requireString(landingCopy, 'meta.twitterSite')
requireString(landingCopy, 'hero.tagline')
requireString(landingCopy, 'hero.headline')
requireString(landingCopy, 'hero.subheadline')
requireString(landingCopy, 'sectionHeadings.howItWorks')
requireString(landingCopy, 'sectionHeadings.scenarios')
requireString(landingCopy, 'sectionHeadings.trust')
requireArray(landingCopy, 'steps')
requireArray(landingCopy, 'scenarios')
requireArray(landingCopy, 'trustFeatures')

if (!Array.isArray(publicPagesData.pages) || publicPagesData.pages.length === 0) {
  throw new Error('public-pages.json: pages must be a non-empty array')
}

for (const page of publicPagesData.pages) {
  requireString(page, 'id')
  requireString(page, 'path')
  requireString(page, 'meta.title')
  requireString(page, 'meta.description')
  requireString(page, 'meta.canonicalUrl')
  requireString(page, 'meta.ogTitle')
  requireString(page, 'meta.ogDescription')
  requireString(page, 'meta.twitterTitle')
  requireString(page, 'meta.twitterDescription')
  requireString(page, 'hero.eyebrow')
  requireString(page, 'hero.headline')
  requireString(page, 'hero.intro')
  requireString(page, 'problem.title')
  requireArray(page, 'problem.points')
  requireString(page, 'contrast.title')
  requireArray(page, 'contrast.points')
  requireString(page, 'solution.title')
  requireArray(page, 'solution.points')
  requireArray(page, 'faq')
  requireString(page, 'cta.label')
  requireString(page, 'cta.href')
}

const htmlTemplate = readFileSync(distHtmlPath, 'utf-8')

const landingHtml = injectSeo(
  htmlTemplate,
  landingCopy.meta.title,
  buildHead(landingCopy.meta),
  buildLandingBody(landingCopy),
)
writeFileSync(distHtmlPath, landingHtml)

for (const page of publicPagesData.pages) {
  const outputDir = resolve(__dirname, `../dist${page.path}`)
  mkdirSync(outputDir, { recursive: true })
  const pageHtml = injectSeo(
    htmlTemplate,
    page.meta.title,
    buildHead({ ...page.meta, twitterSite: '@studyhourlabs' }),
    buildPublicPageBody(page),
  )
  writeFileSync(resolve(outputDir, 'index.html'), pageHtml)
}

console.log('SEO head + body injected into dist/index.html and public route pages')
