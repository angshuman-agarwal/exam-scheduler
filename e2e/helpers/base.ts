/* eslint-disable react-hooks/rules-of-hooks */
import { test as base } from '@playwright/test'

/**
 * Extended test fixture that fails on any uncaught browser error or
 * console.error. All spec files should import { test, expect } from
 * this module instead of '@playwright/test' to get automatic runtime
 * error trapping.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    // Fail immediately on uncaught page errors (e.g. Maximum update depth exceeded)
    page.on('pageerror', (error) => {
      throw error
    })

    // Fail on console.error and React snapshot-cache warnings
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text()
        // Ignore benign service-worker / favicon 404s in preview builds
        if (text.includes('Failed to load resource') || text.includes('favicon')) return
        throw new Error(`Console error: ${text}`)
      }
      const text = msg.text()
      if (text.includes('getSnapshot should be cached')) {
        throw new Error(text)
      }
    })

    await use(page)
  },
})

export { expect } from '@playwright/test'
