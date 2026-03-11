/**
 * Post-build script: injects SEO metadata and static landing HTML
 * into dist/index.html from the shared landing-copy.json.
 *
 * Placeholders in the Vite template (index.html):
 *   <!-- __SEO_HEAD__ -->   → title, description, canonical, OG, Twitter tags
 *   <!-- __SEO_BODY__ -->   → static landing page HTML for crawlers
 *
 * Fails the build if placeholders are missing or the JSON schema is invalid.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distHtmlPath = resolve(__dirname, '../dist/index.html')
const copyPath = resolve(__dirname, '../src/data/landing-copy.json')

// ── Helpers ──

/** Escape for HTML text content. Converts non-ASCII to numeric entities to avoid encoding mojibake. */
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/[^\x20-\x7E\n\r\t]/g, ch => `&#${ch.codePointAt(0)};`)
}

/** Escape for HTML attribute values. Same non-ASCII handling. */
function escapeAttr(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/[^\x20-\x7E\n\r\t]/g, ch => `&#${ch.codePointAt(0)};`)
}

function requireString(obj, path) {
  const val = path.split('.').reduce((o, k) => o?.[k], obj)
  if (typeof val !== 'string' || val.trim() === '') {
    throw new Error(`landing-copy.json: missing or empty field "${path}"`)
  }
  return val
}

function requireArray(obj, path, minLength = 1) {
  const val = path.split('.').reduce((o, k) => o?.[k], obj)
  if (!Array.isArray(val) || val.length < minLength) {
    throw new Error(`landing-copy.json: "${path}" must be an array with at least ${minLength} item(s)`)
  }
  return val
}

// ── Validate ──

if (!existsSync(distHtmlPath)) {
  console.error('dist/index.html not found — run vite build first')
  process.exit(1)
}

const copy = JSON.parse(readFileSync(copyPath, 'utf-8'))

// Validate required fields
const meta = copy.meta
requireString(copy, 'meta.title')
requireString(copy, 'meta.description')
requireString(copy, 'meta.canonicalUrl')
requireString(copy, 'meta.ogTitle')
requireString(copy, 'meta.ogDescription')
requireString(copy, 'meta.twitterTitle')
requireString(copy, 'meta.twitterDescription')
requireString(copy, 'meta.twitterSite')
requireString(copy, 'hero.tagline')
requireString(copy, 'hero.headline')
requireString(copy, 'hero.subheadline')
requireString(copy, 'sectionHeadings.howItWorks')
requireString(copy, 'sectionHeadings.scenarios')
requireString(copy, 'sectionHeadings.trust')
requireArray(copy, 'steps')
requireArray(copy, 'scenarios')
requireArray(copy, 'trustFeatures')

for (const s of copy.steps) {
  if (typeof s.step !== 'number' || !s.title || !s.description) {
    throw new Error('landing-copy.json: each step must have step (number), title, description')
  }
}
for (const s of copy.scenarios) {
  if (!s.situation || !s.response) {
    throw new Error('landing-copy.json: each scenario must have situation, response')
  }
}
for (const f of copy.trustFeatures) {
  if (!f.title || !f.description) {
    throw new Error('landing-copy.json: each trustFeature must have title, description')
  }
}

// ── Build head tags ──

const headTags = [
  `<meta name="description" content="${escapeAttr(meta.description)}" />`,
  `<link rel="canonical" href="${escapeAttr(meta.canonicalUrl)}" />`,
  `<meta property="og:url" content="${escapeAttr(meta.canonicalUrl)}" />`,
  `<meta property="og:site_name" content="Study Hour" />`,
  `<meta property="og:title" content="${escapeAttr(meta.ogTitle)}" />`,
  `<meta property="og:description" content="${escapeAttr(meta.ogDescription)}" />`,
  `<meta property="og:type" content="website" />`,
  `<meta name="twitter:card" content="${meta.twitterImage || meta.ogImage ? 'summary_large_image' : 'summary'}" />`,
  `<meta name="twitter:site" content="${escapeAttr(meta.twitterSite)}" />`,
  `<meta name="twitter:title" content="${escapeAttr(meta.twitterTitle)}" />`,
  `<meta name="twitter:description" content="${escapeAttr(meta.twitterDescription)}" />`,
]

// Only add image tags if the field exists (avoid broken URLs)
if (meta.ogImage) {
  headTags.push(`<meta property="og:image" content="${escapeAttr(meta.ogImage)}" />`)
}
if (meta.twitterImage) {
  headTags.push(`<meta name="twitter:image" content="${escapeAttr(meta.twitterImage)}" />`)
}

const headBlock = headTags.join('\n    ')

// ── Build body HTML ──

const hero = copy.hero
const stepsHtml = copy.steps.map(s =>
  `<h3>${s.step}. ${escapeHtml(s.title)}</h3>\n<p>${escapeHtml(s.description)}</p>`
).join('\n')

const scenariosHtml = copy.scenarios.map(s =>
  `<h3>${escapeHtml(s.situation)}</h3>\n<p>${escapeHtml(s.response)}</p>`
).join('\n')

const featuresHtml = copy.trustFeatures.map(f =>
  `<li><strong>${escapeHtml(f.title)}</strong> &mdash; ${escapeHtml(f.description)}</li>`
).join('\n')

const headings = copy.sectionHeadings
const bodyBlock = `<main style="max-width:640px;margin:0 auto;padding:48px 16px;font-family:system-ui,sans-serif">
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

// ── Inject ──

let html = readFileSync(distHtmlPath, 'utf-8')

if (!html.includes('<!-- __SEO_HEAD__ -->')) {
  console.error('dist/index.html is missing <!-- __SEO_HEAD__ --> placeholder')
  process.exit(1)
}
if (!html.includes('<!-- __SEO_BODY__ -->')) {
  console.error('dist/index.html is missing <!-- __SEO_BODY__ --> placeholder')
  process.exit(1)
}

// Replace placeholders
if (!html.includes('<!-- __SEO_TITLE__ -->')) {
  console.error('dist/index.html is missing <!-- __SEO_TITLE__ --> placeholder')
  process.exit(1)
}
html = html.replace(/<!-- __SEO_TITLE__ -->\s*<title>[^<]*<\/title>/, `<title>${escapeHtml(meta.title)}</title>`)
html = html.replace('<!-- __SEO_HEAD__ -->', headBlock)
html = html.replace('<!-- __SEO_BODY__ -->', bodyBlock)

// Sanity check: no unresolved placeholders
if (html.includes('__SEO_HEAD__') || html.includes('__SEO_BODY__') || html.includes('__SEO_TITLE__')) {
  console.error('Unresolved SEO placeholders remain in dist/index.html')
  process.exit(1)
}

writeFileSync(distHtmlPath, html)
console.log('SEO head + body injected into dist/index.html')
