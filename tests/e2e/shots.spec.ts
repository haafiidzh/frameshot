import { test, type Page } from '@playwright/test'
import { canvasPoint, makePng, mediaInput } from './helpers'

// Documentation screenshots, not part of the normal run:  SHOTS=1 pnpm exec playwright test tests/e2e/shots.spec.ts --project=chromium
test.skip(!process.env.SHOTS, 'screenshots are made on request only')
const OUT = '../replica/clone-screens/'
const imgs = async (page: Page, n: number) => { const o = []; for (let i = 0; i < n; i++) o.push(await makePng(page, `screen ${i + 1}`, 1000 + i * 60, 640, i * 80 + 20)); return o }

test('multi-image screenshots', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/'); await page.waitForTimeout(1500)
  await page.getByRole('radio', { name: '3 images on screen' }).click()
  await mediaInput(page).setInputFiles(await imgs(page, 3)); await page.waitForTimeout(1500)
  await page.screenshot({ path: OUT + 'S30-three-images-cascade.png' })
  await page.getByRole('radio', { name: 'Arrangement In a row' }).click(); await page.waitForTimeout(700)
  await page.getByText('Tilt', { exact: true }).first().click(); await page.waitForTimeout(1200)
  await page.screenshot({ path: OUT + 'S30-three-images-tilt-row.png' })
  await page.getByText('Zoom', { exact: true }).first().click()
  await page.getByRole('radio', { name: '4 images on screen' }).click(); await page.waitForTimeout(500)
  await mediaInput(page).setInputFiles(await imgs(page, 4)); await page.waitForTimeout(1500)
  await page.screenshot({ path: OUT + 'S30-four-images-grid.png' })
  await page.getByRole('radio', { name: '2 images on screen' }).click(); await page.waitForTimeout(500)
  const a = await canvasPoint(page, 0.3, 0.5), b = await canvasPoint(page, 0.34, 0.22)
  await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 14 }); await page.waitForTimeout(500)
  await page.screenshot({ path: OUT + 'S31-dragging-an-image.png' })
  await page.mouse.up()
  await page.getByRole('radio', { name: 'Image 1', exact: true }).click(); await page.waitForTimeout(400)
  await page.getByText('Position of image 1').scrollIntoViewIfNeeded()
  await page.screenshot({ path: OUT + 'S31-position-controls.png' })
})
