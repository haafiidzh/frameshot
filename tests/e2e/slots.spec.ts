import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { OVERFLOW_JS, canvasPoint, compareExports, exportB64, makePng, mediaInput } from './helpers'

const open = async (page: Page) => { await page.goto('/'); await expect(page.getByTestId('stage')).toBeVisible() }
const consoleErrors = (page: Page) => { const e: string[] = []; page.on('console', (m) => m.type() === 'error' && e.push(m.text())); page.on('pageerror', (x) => e.push(String(x))); return e }
const setCount = (page: Page, n: number) => page.getByRole('radio', { name: new RegExp(`^${n} images? on screen$`) }).click()
const images = async (page: Page, n: number) => { const out = []; for (let i = 0; i < n; i++) out.push(await makePng(page, `slot${i + 1}`, 900 + i * 40, 600, i * 70)); return out }
const slider = (page: Page, name: string) => page.getByLabel(name, { exact: true })
const sliderValue = async (page: Page, name: string) => Number(await slider(page, name).inputValue())
const clickCanvas = async (page: Page, fx: number, fy: number) => { const p = await canvasPoint(page, fx, fy); await page.mouse.click(p.x, p.y) }
const dragCanvas = async (page: Page, from: [number, number], to: [number, number], steps = 12) => {
  const a = await canvasPoint(page, ...from), b = await canvasPoint(page, ...to)
  await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps }); await page.mouse.up()
}

test.describe('several images in Zoom and Tilt', () => {
  test('add 3 images at once: the chips fill, the picture shows three images', async ({ page }) => {
    const errors = consoleErrors(page)
    await open(page)
    await setCount(page, 3)
    await mediaInput(page).setInputFiles(await images(page, 3))
    await expect(page.getByRole('radio', { name: 'Image 1', exact: true })).toBeVisible()
    await expect(page.getByRole('radio', { name: 'Image 2', exact: true })).toBeVisible()
    await expect(page.getByRole('radio', { name: 'Image 3', exact: true })).toBeVisible()   // filled: no ", empty"
    await expect(page.getByText('Library (3 of 24)')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('dropping several files on a one-image picture shows that many images', async ({ page }) => {
    await open(page)
    await page.evaluate(async (files) => {
      const dt = new DataTransfer()
      for (const f of files) dt.items.add(new File([Uint8Array.from(atob(f.b64), (c) => c.charCodeAt(0))], f.name, { type: 'image/png' }))
      window.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }))
    }, (await images(page, 3)).map((i) => ({ name: i.name, b64: i.buffer.toString('base64') })))
    await expect(page.getByRole('radio', { name: 'Image 3', exact: true })).toBeVisible()
    await expect(page.getByRole('radio', { name: '3 images on screen' })).toHaveAttribute('aria-checked', 'true')
  })

  test('count 4 to 2 keeps images 1 and 2, and going back up brings 3 and 4 back', async ({ page }) => {
    await open(page)
    await setCount(page, 4)
    await mediaInput(page).setInputFiles(await images(page, 4))
    await expect(page.getByRole('radio', { name: 'Image 4', exact: true })).toBeVisible()
    await setCount(page, 2)
    await expect(page.getByRole('radio', { name: 'Image 1', exact: true })).toBeVisible()
    await expect(page.getByRole('radio', { name: 'Image 2', exact: true })).toBeVisible()
    await expect(page.getByRole('radio', { name: /^Image 3/ })).toHaveCount(0)
    await setCount(page, 4)
    await expect(page.getByRole('radio', { name: 'Image 3', exact: true })).toBeVisible()   // still filled
    await expect(page.getByRole('radio', { name: 'Image 4', exact: true })).toBeVisible()
  })

  test('arrangements are listed per count and change the picture', async ({ page }) => {
    await open(page)
    await mediaInput(page).setInputFiles(await images(page, 1))
    await setCount(page, 2)
    await mediaInput(page).setInputFiles(await images(page, 2))
    const before = await exportB64(page)
    await page.getByRole('radio', { name: 'Arrangement Cascade' }).click()
    expect((await compareExports(page, before, await exportB64(page), [0, 0, 1, 1])).diff).toBeGreaterThan(5000)
    await setCount(page, 4)
    await expect(page.getByRole('radio', { name: 'Arrangement Grid' })).toBeVisible()
    await setCount(page, 1)
    await expect(page.getByRole('radiogroup', { name: 'Arrangement' })).toHaveCount(0)
  })

  test('library: a click fills the selected slot and moves on to the next empty one', async ({ page }) => {
    await open(page)
    await setCount(page, 3)
    await mediaInput(page).setInputFiles(await images(page, 3))
    await page.getByRole('radio', { name: 'Image 2', exact: true }).click()
    await page.getByRole('button', { name: 'Remove image from slot 2' }).click()
    await page.getByRole('radio', { name: 'Image 3', exact: true }).click()
    await page.getByRole('button', { name: 'Remove image from slot 3' }).click()
    await expect(page.getByRole('radio', { name: 'Image 2, empty' })).toBeVisible()
    await page.getByRole('radio', { name: 'Image 2, empty' }).click()
    await page.getByRole('button', { name: /Put in image 2: slot2/ }).click()
    await expect(page.getByRole('radio', { name: 'Image 2', exact: true })).toBeVisible()
    await expect(page.getByRole('radio', { name: 'Image 3, empty' })).toHaveAttribute('aria-checked', 'true')   // selection moved on
  })

  test('templates and magic look keep the images and the count', async ({ page }) => {
    await open(page)
    await setCount(page, 3)
    await mediaInput(page).setInputFiles(await images(page, 3))
    await page.getByRole('button', { name: /Templates/ }).click()
    await page.getByRole('button', { name: /Night frost/ }).click()
    await expect(page.getByRole('radio', { name: '3 images on screen' })).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByRole('radio', { name: 'Image 3', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Magic look from my image' }).click()
    await expect(page.getByRole('radio', { name: '3 images on screen' })).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByRole('radio', { name: 'Image 3', exact: true })).toBeVisible()
  })

  test('the command palette can set the number of images', async ({ page }) => {
    await open(page)
    await page.keyboard.press('Control+k')
    await page.getByRole('combobox', { name: 'Type a command' }).fill('images on screen: 4')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('radio', { name: '4 images on screen' })).toHaveAttribute('aria-checked', 'true')
  })

  test('export fidelity with 3 images in Tilt: the PNG matches the canvas', async ({ page }) => {
    await open(page)
    await setCount(page, 3)
    await mediaInput(page).setInputFiles(await images(page, 3))
    await page.getByText('Tilt', { exact: true }).first().click()
    await page.waitForTimeout(700)
    const b64 = await exportB64(page)
    const diff = await page.evaluate(async (b64) => {
      const stage = document.querySelector('[data-testid=stage]') as HTMLCanvasElement
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode()
      const W = 480, H = Math.round((480 * img.naturalHeight) / img.naturalWidth)
      const grab = (src: CanvasImageSource) => { const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d')!; x.imageSmoothingQuality = 'high'; x.drawImage(src, 0, 0, W, H); return x.getImageData(0, 0, W, H).data }
      const a = grab(stage), b = grab(img)
      let sum = 0; for (let i = 0; i < a.length; i += 4) sum += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])
      return sum / ((a.length / 4) * 3)
    }, b64)
    expect(diff, 'mean per-channel difference (0 to 255); the preview also shows a white selection ring that exports leave out').toBeLessThan(6)
  })

  test('the selection ring is a preview hint only: the export has no ring', async ({ page }) => {
    await open(page)
    await setCount(page, 2)
    await mediaInput(page).setInputFiles(await images(page, 2))
    await page.getByRole('radio', { name: 'Image 1', exact: true }).click()
    const withRing = await exportB64(page)
    await page.getByTestId('stage').focus(); await page.keyboard.press('Escape')      // clears the selection (ring stays with 2 images, export must not change)
    expect((await compareExports(page, withRing, await exportB64(page), [0, 0, 1, 1])).diff).toBe(0)
  })
})

test.describe('change position', () => {
  test('drag an image: it moves, and its old place shows the backdrop again', async ({ page }) => {
    await open(page)
    await setCount(page, 2)
    await mediaInput(page).setInputFiles(await images(page, 2))
    const before = await exportB64(page)
    await dragCanvas(page, [0.3, 0.5], [0.3, 0.2])
    const after = await exportB64(page)
    const moved = await compareExports(page, before, after, [0.05, 0.05, 0.55, 0.45])   // where it arrived
    const left = await compareExports(page, before, after, [0.05, 0.62, 0.45, 0.9])     // where it was
    expect(moved.diff).toBeGreaterThan(moved.total * 0.1)
    expect(left.diff).toBeGreaterThan(left.total * 0.1)
    expect(await sliderValue(page, 'Vertical')).toBeLessThan(-20)
    expect(await sliderValue(page, 'Horizontal')).toBeLessThanOrEqual(1)
  })

  test('undoing a drag is one step, and redo brings it back', async ({ page }) => {
    await open(page)
    await setCount(page, 2)
    await mediaInput(page).setInputFiles(await images(page, 2))
    await dragCanvas(page, [0.3, 0.5], [0.55, 0.3], 20)
    expect(await sliderValue(page, 'Horizontal')).toBeGreaterThan(10)
    const bar = page.getByRole('toolbar', { name: 'Editor actions' })
    await bar.getByRole('button', { name: 'Undo' }).click()
    expect(await sliderValue(page, 'Horizontal')).toBe(0)
    expect(await sliderValue(page, 'Vertical')).toBe(0)
    await bar.getByRole('button', { name: 'Redo' }).click()
    expect(await sliderValue(page, 'Horizontal')).toBeGreaterThan(10)
  })

  test('a click selects the clicked image and the Position section follows it', async ({ page }) => {
    await open(page)
    await setCount(page, 2)
    await mediaInput(page).setInputFiles(await images(page, 2))
    await clickCanvas(page, 0.7, 0.5)
    await expect(page.getByRole('radio', { name: 'Image 2', exact: true })).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByText('Position of image 2')).toBeVisible()
    await clickCanvas(page, 0.3, 0.5)
    await expect(page.getByText('Position of image 1')).toBeVisible()
  })

  test('arrow keys nudge the selected image (Shift is bigger), Escape clears the selection', async ({ page }) => {
    await open(page)
    await mediaInput(page).setInputFiles((await images(page, 1))[0])
    await page.getByTestId('stage').focus()
    await page.keyboard.press('Enter')
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight')
    expect(await sliderValue(page, 'Horizontal')).toBe(3)
    await page.keyboard.press('Shift+ArrowDown')
    expect(await sliderValue(page, 'Vertical')).toBe(5)
    await page.keyboard.press('Escape')
    await page.keyboard.press('ArrowLeft')                                             // ignored: nothing selected
    expect(await sliderValue(page, 'Horizontal')).toBe(3)
  })

  test('Reset position puts the image back and disables itself', async ({ page }) => {
    await open(page)
    await mediaInput(page).setInputFiles((await images(page, 1))[0])
    const reset = page.getByRole('button', { name: 'Reset position' })
    await expect(reset).toBeDisabled()
    await dragCanvas(page, [0.5, 0.5], [0.65, 0.6])
    await expect(reset).toBeEnabled()
    await reset.click()
    await expect(reset).toBeDisabled()
    expect(await sliderValue(page, 'Horizontal')).toBe(0)
    expect(await sliderValue(page, 'Size')).toBe(100)
  })

  test('keyboard only: the sliders move and resize the image and the export changes', async ({ page }) => {
    await open(page)
    await mediaInput(page).setInputFiles((await images(page, 1))[0])
    const before = await exportB64(page)
    await slider(page, 'Horizontal').focus()
    for (let i = 0; i < 12; i++) await page.keyboard.press('ArrowRight')
    await slider(page, 'Size').focus()
    for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowLeft')
    expect(await sliderValue(page, 'Horizontal')).toBe(12)
    expect(await sliderValue(page, 'Size')).toBe(90)
    expect((await compareExports(page, before, await exportB64(page), [0, 0, 1, 1])).diff).toBeGreaterThan(3000)
  })

  test('dragging on empty backdrop does not move anything and clears the selection', async ({ page }) => {
    await open(page)
    await mediaInput(page).setInputFiles((await images(page, 1))[0])
    await clickCanvas(page, 0.5, 0.5)
    await dragCanvas(page, [0.03, 0.03], [0.1, 0.1])
    expect(await sliderValue(page, 'Horizontal')).toBe(0)
  })

  test('clicking an empty slot opens the picker for that slot', async ({ page }) => {
    await open(page)
    await setCount(page, 2)
    await mediaInput(page).setInputFiles((await images(page, 1))[0])
    const chooser = page.waitForEvent('filechooser')
    await clickCanvas(page, 0.7, 0.5)
    await (await chooser).setFiles((await images(page, 2))[1])
    await expect(page.getByRole('radio', { name: 'Image 2', exact: true })).toBeVisible()      // slot 2 now filled
  })

  test('bento: dragging inside a selected cell pans its crop in one undo step', async ({ page }) => {
    await open(page)
    await page.getByText('Bento', { exact: true }).first().click()
    await mediaInput(page).setInputFiles(await makePng(page, 'wide', 1800, 700, 120))
    await slider(page, 'Zoom').fill('250')
    expect(await sliderValue(page, 'Left to right')).toBe(50)
    await dragCanvas(page, [0.4, 0.3], [0.1, 0.3])                                             // drag left: the crop moves right
    expect(await sliderValue(page, 'Left to right')).toBeGreaterThan(60)
    await page.getByRole('toolbar', { name: 'Editor actions' }).getByRole('button', { name: 'Undo' }).click()
    expect(await sliderValue(page, 'Left to right')).toBe(50)
  })

  test('bento: arrow keys pan the crop of the selected cell', async ({ page }) => {
    await open(page)
    await page.getByText('Bento', { exact: true }).first().click()
    await mediaInput(page).setInputFiles(await makePng(page, 'wide', 1800, 700, 200))
    await slider(page, 'Zoom').fill('250')
    await page.getByTestId('stage').focus()
    await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight')
    expect(await sliderValue(page, 'Left to right')).toBe(54)
  })
})

test.describe('overflow and accessibility with several images', () => {
  for (const [w, h] of [[1912, 972], [1440, 900], [1280, 720], [1024, 768], [768, 1024], [390, 844]]) {
    test(`no overflow at ${w}x${h} with 3 images and a slot selected`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h })
      await open(page)
      await setCount(page, 3)
      await mediaInput(page).setInputFiles(await images(page, 3))
      await page.getByRole('radio', { name: 'Image 2', exact: true }).click()
      await page.waitForTimeout(400)
      expect(await page.evaluate(`(${OVERFLOW_JS})()`)).toEqual([])
      await page.getByText('Tilt', { exact: true }).first().click()
      await page.waitForTimeout(300)
      expect(await page.evaluate(`(${OVERFLOW_JS})()`)).toEqual([])
    })
  }

  const scan = async (page: Page) => (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(' ')}`)
  test('axe: 3 images with a slot selected, in light and dark', async ({ browser }) => {
    for (const scheme of ['light', 'dark'] as const) {
      const ctx = await browser.newContext({ colorScheme: scheme }); const page = await ctx.newPage()
      await open(page); await setCount(page, 3)
      await mediaInput(page).setInputFiles(await images(page, 3))
      await page.getByRole('radio', { name: 'Image 2', exact: true }).click()
      expect(await scan(page), scheme).toEqual([])
      await ctx.close()
    }
  })
  test('axe: an empty slot and the arrangement tiles', async ({ page }) => {
    await open(page); await setCount(page, 4)
    expect(await scan(page)).toEqual([])
  })
})
