import { test, expect } from './helpers/base'

test('app boots without runtime errors', async ({ page }) => {
  await page.goto('/')
  await page.locator('text=Loading...').waitFor({ state: 'hidden', timeout: 10000 })
  await expect(page.locator('text=Pick your subjects')).toBeVisible({ timeout: 5000 })
})
