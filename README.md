# Exam Scheduler

Smart GCSE revision planner that prioritises what to study based on exam dates, confidence, and performance.

## What it does

- **Prioritised study plan** — scores every topic using a weighted blend of weakness, exam urgency, and study recency so the most important stuff surfaces first
- **12 GCSE subjects** pre-loaded with real AQA/Edexcel/OCR exam dates (May-June 2026) and topic breakdowns
- **Confidence onboarding** — single-page grid where you rate each subject with emoji faces, then the engine builds your first plan
- **Daily planner** — pick up to 4 topics per day with auto-fill, subject diversity caps, and cramming overrides for exams within 7 days
- **Performance tracking** — log session scores; the engine auto-adjusts confidence and performance via exponential moving average
- **Offline-first PWA** — installable on phone, works without internet via service worker caching and IndexedDB persistence

## Tech stack

- **React 19** + **TypeScript** + **Zustand** for state
- **Tailwind CSS v4** via Vite plugin
- **Vite 7** with **vite-plugin-pwa** (Workbox)
- **IndexedDB** (via `idb`) for persistence
- **GitHub Actions** for CI/CD to GitHub Pages

## Getting started

```bash
npm install
npm run dev
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Type-check + production build |
| `npm run preview` | Preview production build locally |
| `npm run typecheck` | Type-check only |
| `npm run lint` | ESLint |
| `npm run test` | Run tests |

## Deployment

Push to `main` and GitHub Actions auto-deploys to GitHub Pages.


