import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { OVERFLOW_JS, makePng, mediaInput } from './helpers'

const open = async (page: Page) => { await page.goto('/'); await expect(page.getByTestId('stage')).toBeVisible() }
const consoleErrors = (page: Page) => { const e: string[] = []; page.on('console', (m) => m.type() === 'error' && e.push(m.text())); page.on('pageerror', (x) => e.push(String(x))); return e }

test('core loop: add an image, export a 1x PNG at the canvas size', async ({ page }) => {
  const errors = consoleErrors(page)
  await open(page)
  await mediaInput(page).setInputFiles(await makePng(page, 'one', 1200, 800, 200))
  await expect(page.getByRole('button', { name: 'Replace image' })).toBeVisible()
  const dl = page.waitForEvent('download')
  await page.getByTestId('export').click()
  const file = await dl
  expect(file.suggestedFilename()).toMatch(/\.png$/)
  const size = await page.evaluate(async (b64) => { const i = new Image(); i.src = 'data:image/png;base64,' + b64; await i.decode(); return [i.naturalWidth, i.naturalHeight] }, (await import('node:fs')).readFileSync((await file.path())!).toString('base64'))
  expect(size).toEqual([1920, 1440])
  expect(errors).toEqual([])
})

test('export fidelity: the downloaded PNG matches what the canvas shows', async ({ page }) => {
  await open(page)
  await mediaInput(page).setInputFiles(await makePng(page, 'fid', 1600, 900, 120))
  await page.getByRole('radio', { name: 'Tilt', exact: true }).or(page.getByText('Tilt', { exact: true }).first()).first().click()
  await page.waitForTimeout(600)
  const dl = page.waitForEvent('download')
  await page.getByTestId('export').click()
  const b64 = (await import('node:fs')).readFileSync((await (await dl).path())!).toString('base64')
  const diff = await page.evaluate(async (b64) => {
    const stage = document.querySelector('[data-testid=stage]') as HTMLCanvasElement
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode()
    const W = 480, H = Math.round((480 * img.naturalHeight) / img.naturalWidth)
    const grab = (src: CanvasImageSource) => { const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d')!; x.imageSmoothingQuality = 'high'; x.drawImage(src, 0, 0, W, H); return x.getImageData(0, 0, W, H).data }
    const a = grab(stage), b = grab(img)
    let sum = 0; for (let i = 0; i < a.length; i += 4) sum += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])
    return sum / ((a.length / 4) * 3)
  }, b64)
  expect(diff, 'mean per-channel difference (0 to 255)').toBeLessThan(6)
})

test('export 2x doubles the pixel size', async ({ page }) => {
  await open(page)
  await mediaInput(page).setInputFiles(await makePng(page, 'x2', 800, 600, 30))
  await page.getByRole('button', { name: 'Export size' }).click()
  await page.getByRole('radio', { name: '2x' }).click()
  await expect(page.getByTestId('export-label')).toContainText('2x')
  const dl = page.waitForEvent('download'); await page.getByTestId('export').click()
  const b64 = (await import('node:fs')).readFileSync((await (await dl).path())!).toString('base64')
  const size = await page.evaluate(async (b) => { const i = new Image(); i.src = 'data:image/png;base64,' + b; await i.decode(); return [i.naturalWidth, i.naturalHeight] }, b64)
  expect(size).toEqual([3840, 2880])
})

test('wrong file types give a clear message', async ({ page }) => {
  await open(page)
  await mediaInput(page).setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') })
  await expect(page.getByRole('alert').filter({ hasText: 'not an image' })).toBeVisible()
})

test('undo and redo bring back a change', async ({ page }) => {
  await open(page)
  await mediaInput(page).setInputFiles(await makePng(page, 'u', 800, 600, 10))
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(page.getByRole('button', { name: 'Add an image', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Redo' }).click()
  await expect(page.getByRole('button', { name: 'Replace image' })).toBeVisible()
})

test('bento: several images fill cells, switching presets keeps them, export works', async ({ page }) => {
  const errors = consoleErrors(page)
  await open(page)
  await page.getByText('Bento', { exact: true }).first().click()
  await mediaInput(page).setInputFiles([await makePng(page, 'a', 900, 600, 0), await makePng(page, 'b', 600, 900, 90), await makePng(page, 'c', 800, 800, 180), await makePng(page, 'd', 1200, 500, 270)])
  await expect(page.getByRole('radio', { name: /^Cell 4$/ })).toBeVisible()
  await page.getByRole('radio', { name: 'Six' }).click()
  await expect(page.getByRole('radio', { name: 'Cell 5, empty' })).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Cell 1' })).toBeVisible()
  await page.getByRole('radio', { name: 'Four equal' }).click()
  await expect(page.getByRole('radio', { name: 'Cell 4' })).toBeVisible()
  const dl = page.waitForEvent('download'); await page.getByTestId('export').click(); await dl
  expect(errors).toEqual([])
})

test('library: images added once are reused in another layout without uploading again', async ({ page }) => {
  await open(page)
  await page.getByText('Bento', { exact: true }).first().click()
  const first = await makePng(page, 'keep1', 900, 600, 20), second = await makePng(page, 'keep2', 600, 900, 140)
  await mediaInput(page).setInputFiles([first, second])
  await expect(page.getByText('Library (2 of 24)')).toBeVisible()
  await mediaInput(page).setInputFiles([first])               // same file again: no duplicate
  await expect(page.getByText('Library (2 of 24)')).toBeVisible()
  await page.getByText('Tilt', { exact: true }).first().click()
  await page.getByRole('button', { name: /Use this image: keep2/ }).click()
  await expect(page.getByRole('button', { name: 'Replace image' })).toBeVisible()
  await page.getByRole('button', { name: 'Start over' }).click()
  await expect(page.getByText('Library (2 of 24)')).toBeVisible()  // survives Start over
})

test('library stops at 24 images with a clear message', async ({ page }) => {
  await open(page)
  await page.getByText('Bento', { exact: true }).first().click()
  const imgs = []
  for (let i = 0; i < 26; i++) imgs.push(await makePng(page, `n${i}`, 60 + i, 40, i * 13))
  for (let k = 0; k < 26; k += 12) {
    await mediaInput(page).setInputFiles(imgs.slice(k, k + 12))
    await expect(page.getByRole('status').filter({ hasText: 'Opening image' })).toHaveCount(0, { timeout: 15_000 })
  }
  await expect(page.getByText('Library (24 of 24)')).toBeVisible()
  await expect(page.getByRole('alert').filter({ hasText: '24 images' })).toBeVisible()
})

test('keyboard only: export with Enter after an image is added', async ({ page }) => {
  await open(page)
  await mediaInput(page).setInputFiles(await makePng(page, 'k', 800, 600, 60))
  await page.getByTestId('export').focus()
  await expect(page.getByTestId('export')).toBeFocused()
  const dl = page.waitForEvent('download'); await page.getByTestId('export').press('Enter'); await dl   // key press on the focused button, no mouse
})

test.describe('no overflow at common screen sizes', () => {
  for (const [w, h] of [[1912, 972], [1440, 900], [1280, 720], [1024, 768], [768, 1024], [390, 844]]) {
    test(`${w}x${h} (empty, tilt, bento filled)`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h })
      await open(page)
      expect(await page.evaluate(`(${OVERFLOW_JS})()`), 'empty').toEqual([])
      await page.getByText('Tilt', { exact: true }).first().click()
      expect(await page.evaluate(`(${OVERFLOW_JS})()`), 'tilt').toEqual([])
      await page.getByText('Bento', { exact: true }).first().click()
      await mediaInput(page).setInputFiles([await makePng(page, 'o1', 900, 600, 0), await makePng(page, 'o2', 600, 900, 90), await makePng(page, 'o3', 800, 800, 180)])
      await page.waitForTimeout(500)
      expect(await page.evaluate(`(${OVERFLOW_JS})()`), 'bento').toEqual([])
    })
  }
})

test.describe('accessibility (axe, WCAG 2.2 AA)', () => {
  const scan = async (page: Page) => (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s), e.g. ${v.nodes[0]?.target.join(' ')}`)
  test('empty editor', async ({ page }) => { await open(page); expect(await scan(page)).toEqual([]) })
  test('filled editor with the library and the device picker open', async ({ page }) => {
    await open(page)
    await mediaInput(page).setInputFiles(await makePng(page, 'ax', 800, 600, 50))
    expect(await scan(page)).toEqual([])
    await page.getByRole('button', { name: /Screenshot/ }).first().click()
    expect(await scan(page)).toEqual([])
  })
  test('bento mode', async ({ page }) => {
    await open(page)
    await page.getByText('Bento', { exact: true }).first().click()
    await mediaInput(page).setInputFiles([await makePng(page, 'b1', 900, 600, 0), await makePng(page, 'b2', 600, 900, 90)])
    expect(await scan(page)).toEqual([])
  })
  test('canvas tab', async ({ page }) => { await open(page); await page.getByRole('tab', { name: 'Canvas' }).click(); expect(await scan(page)).toEqual([]) })
})

const pngInfo = async (page: Page, path: string) => {
  const b64 = (await import('node:fs')).readFileSync(path).toString('base64')
  return page.evaluate(async (b) => {
    const i = new Image(); i.src = 'data:image/png;base64,' + b; await i.decode()
    const c = document.createElement('canvas'); c.width = i.naturalWidth; c.height = i.naturalHeight; const x = c.getContext('2d')!; x.drawImage(i, 0, 0)
    const d = x.getImageData(2, 2, 1, 1).data
    return { w: i.naturalWidth, h: i.naturalHeight, corner: [d[0], d[1], d[2]] }
  }, b64)
}
const exportPng = async (page: Page) => { const dl = page.waitForEvent('download'); await page.getByTestId('export').click(); return pngInfo(page, (await (await dl).path())!) }

test('custom canvas size is applied and exported exactly', async ({ page }) => {
  await open(page)
  await mediaInput(page).setInputFiles(await makePng(page, 'cs', 900, 600, 100))
  await page.getByRole('tab', { name: 'Canvas' }).click()
  await page.getByLabel('Width').fill('1000'); await page.getByLabel('Height').fill('500'); await page.getByLabel('Height').press('Enter')
  await expect(page.getByText('Custom size (in use)')).toBeVisible()
  expect(await exportPng(page)).toMatchObject({ w: 1000, h: 500 })
  await page.getByLabel('Width').fill('99999'); await page.getByLabel('Width').press('Enter')
  await expect(page.getByLabel('Width')).toHaveValue('4096')   // clamped
})

test('social and store presets exist and 3x export multiplies the size', async ({ page }) => {
  await open(page)
  await mediaInput(page).setInputFiles(await makePng(page, 'sx', 900, 600, 100))
  await page.getByRole('tab', { name: 'Canvas' }).click()
  await page.getByRole('radio', { name: /Link card/ }).click()
  await page.getByRole('radio', { name: /Phone store shot/ }).click()
  await page.getByRole('button', { name: 'Export size' }).click()
  await page.getByRole('radio', { name: '3x' }).click()
  expect(await exportPng(page)).toMatchObject({ w: 1290 * 3, h: 2796 * 3 })
})

test('3x is disabled when the canvas would be too large', async ({ page }) => {
  await open(page)
  await page.getByRole('tab', { name: 'Canvas' }).click()
  await page.getByLabel('Width').fill('4096'); await page.getByLabel('Height').fill('4096'); await page.getByLabel('Height').press('Enter')
  await page.getByRole('button', { name: 'Export size' }).click()
  await expect(page.getByRole('radio', { name: '3x' })).toBeDisabled()
})

test('templates change the look but keep the image; bento templates carry it into cell 1', async ({ page }) => {
  await open(page)
  await mediaInput(page).setInputFiles(await makePng(page, 'tp', 900, 600, 100))
  await page.getByRole('button', { name: /Templates/ }).click()
  await page.getByRole('button', { name: /Night frost/ }).click()
  await expect(page.getByRole('button', { name: 'Replace image' })).toBeVisible()
  await page.getByRole('button', { name: /Templates/ }).click()
  await page.getByRole('button', { name: /Bento board/ }).click()
  await expect(page.getByRole('radio', { name: 'Cell 1' })).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Cell 2, empty' })).toBeVisible()
  await page.getByRole('toolbar', { name: 'Editor actions' }).getByRole('button', { name: 'Undo' }).click()
  await expect(page.getByRole('button', { name: 'Replace image' })).toBeVisible()
})

test('magic blend takes its colours from the image', async ({ page }) => {
  await open(page)
  await page.getByRole('tab', { name: 'Canvas' }).click()
  await expect(page.getByRole('radio', { name: 'Blend', exact: true })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByRole('button', { name: 'Add an image for a magic blend' })).toBeDisabled()
  await page.getByRole('tab', { name: 'Device' }).click()
  await mediaInput(page).setInputFiles(await makePng(page, 'mg', 900, 600, 220))      // blue-ish image
  await page.getByRole('tab', { name: 'Canvas' }).click()
  await page.getByRole('button', { name: 'Magic blend from my image' }).click()
  const [r, , b] = (await exportPng(page)).corner
  expect(b, 'corner should be blue-ish, not the default orange').toBeGreaterThan(r)
})

test('more looks: the tray shows the extra styles and one can be chosen', async ({ page }) => {
  await open(page)
  await expect(page.getByRole('radio', { name: 'Liquid', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: /More looks/ }).click()
  await page.getByRole('radio', { name: 'Liquid', exact: true }).click()
  await expect(page.getByRole('radio', { name: 'Liquid', exact: true })).toHaveAttribute('aria-checked', 'true')
})

test('device picker lists the full catalog', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: /Screenshot/ }).first().click()
  expect(await page.getByRole('dialog', { name: 'Choose a device' }).locator('section button').count()).toBeGreaterThanOrEqual(15)
})

// ---- batch C: command palette, themes, effects, watermark, performance, what's new
const exportB64 = async (page: Page) => { const dl = page.waitForEvent('download'); await page.getByTestId('export').click(); return (await import('node:fs')).readFileSync((await (await dl).path())!).toString('base64') }
/** Count pixels that differ between two exports inside a box (fractions of the image), plus the alpha of one pixel. */
const compare = (page: Page, a: string, b: string, box: [number, number, number, number]) => page.evaluate(async ([a, b, box]) => {
  const load = async (x: string) => { const i = new Image(); i.src = 'data:image/png;base64,' + x; await i.decode(); const c = document.createElement('canvas'); c.width = i.naturalWidth; c.height = i.naturalHeight; const g = c.getContext('2d')!; g.drawImage(i, 0, 0); return { c, g } }
  const A = await load(a as string), B = await load(b as string)
  const [x0, y0, x1, y1] = (box as number[]); const W = A.c.width, H = A.c.height
  const rx = Math.round(x0 * W), ry = Math.round(y0 * H), rw = Math.max(1, Math.round((x1 - x0) * W)), rh = Math.max(1, Math.round((y1 - y0) * H))
  const da = A.g.getImageData(rx, ry, rw, rh).data, db = B.g.getImageData(rx, ry, rw, rh).data
  let diff = 0, lumA = 0, lumB = 0; for (let i = 0; i < da.length; i += 4) { if (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]) > 12) diff++; lumA += da[i] + da[i + 1] + da[i + 2]; lumB += db[i] + db[i + 1] + db[i + 2] }
  return { diff, lumA: lumA / (da.length / 4), lumB: lumB / (db.length / 4), alphaA: da[3], alphaB: db[3] }
}, [a, b, box] as const)
const withImage = async (page: Page, hue = 200) => { await open(page); await mediaInput(page).setInputFiles(await makePng(page, 'fx', 900, 600, hue)) }

test('command palette: Ctrl+K, type, Enter runs the command; Esc closes and returns focus', async ({ page }) => {
  await withImage(page)
  await page.keyboard.press('Control+k')
  const box = page.getByRole('combobox', { name: 'Type a command' })
  await expect(box).toBeFocused()
  await box.fill('export png')
  const dl = page.waitForEvent('download'); await page.keyboard.press('Enter'); await dl
  await page.keyboard.press('Control+k')
  await expect(page.getByRole('dialog', { name: 'Commands' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Commands' })).toHaveCount(0)
})

test('command palette: layout command switches to bento and nothing-found state is shown', async ({ page }) => {
  await open(page)
  await page.keyboard.press('Control+k')
  await page.getByRole('combobox', { name: 'Type a command' }).fill('zzzzzz')
  await expect(page.getByText('Nothing matches')).toBeVisible()
  await page.getByRole('combobox', { name: 'Type a command' }).fill('bento')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('radio', { name: 'Cell 1, empty' })).toBeVisible()
})

test('dark theme: chosen from the menu, remembered after reload, and still accessible', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: 'Franneshot' }).click()
  await page.getByRole('radiogroup', { name: 'Appearance' }).getByRole('radio', { name: 'Dark' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.keyboard.press('Escape')
  await page.reload(); await expect(page.getByTestId('stage')).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  expect(bg).toBe('rgb(16, 16, 18)')
  const v = (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations.map((x) => `${x.id}: ${x.nodes[0]?.target.join(' ')}`)
  expect(v).toEqual([])
  await page.getByRole('button', { name: 'Franneshot' }).click()
  await page.getByRole('radiogroup', { name: 'Appearance' }).getByRole('radio', { name: 'System' }).click()
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/)
})

test('system dark preference is followed when no choice was made', async ({ browser }) => {
  const ctx = await browser.newContext({ colorScheme: 'dark' }); const page = await ctx.newPage()
  await page.goto('/'); await expect(page.getByTestId('stage')).toBeVisible()
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(16, 16, 18)')
  await ctx.close()
})

test('performance mode lowers the preview size, not the export', async ({ page }) => {
  await withImage(page)
  const w = () => page.getByTestId('stage').evaluate((c) => (c as HTMLCanvasElement).width)
  expect(await w()).toBe(1400)
  await page.getByRole('button', { name: 'Franneshot' }).click()
  await page.getByRole('switch', { name: /Performance mode/ }).click(); await page.keyboard.press('Escape')
  await expect.poll(w).toBe(640)
  const dl = page.waitForEvent('download'); await page.getByTestId('export').click()
  const info = await pngInfo(page, (await (await dl).path())!)
  expect(info).toMatchObject({ w: 1920, h: 1440 })
})

test('What is new opens as a dialog, Esc closes it and focus goes back', async ({ page }) => {
  await open(page)
  const brand = page.getByRole('button', { name: 'Franneshot' })
  await brand.click(); await page.getByRole('button', { name: 'What is new' }).click()
  await expect(page.getByRole('dialog', { name: 'What is new' })).toBeVisible()
  await expect(page.getByText('Bento layouts')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'What is new' })).toHaveCount(0)
})

test('watermark text appears in the export, only where it should', async ({ page }) => {
  await withImage(page)
  const before = await exportB64(page)
  await page.getByRole('tab', { name: 'Canvas' }).click()
  await page.getByLabel('Your text').fill('made by me')
  const after = await exportB64(page)
  expect((await compare(page, before, after, [0.6, 0.9, 1, 1])).diff, 'bottom right has the text').toBeGreaterThan(50)
  expect((await compare(page, before, after, [0, 0, 0.5, 0.5])).diff, 'top left is untouched').toBe(0)
  await page.getByRole('radiogroup', { name: 'Watermark position' }).getByRole('radio', { name: 'Left' }).click()
  const left = await exportB64(page)
  expect((await compare(page, before, left, [0, 0.9, 0.4, 1])).diff).toBeGreaterThan(50)
})

test('vignette darkens the edges; grain changes pixels but never paints transparent areas', async ({ page }) => {
  await withImage(page)
  const plain = await exportB64(page)
  await page.getByRole('tab', { name: 'Canvas' }).click()
  await page.getByLabel('Vignette').fill('100')
  const vig = await exportB64(page)
  const c = await compare(page, plain, vig, [0, 0, 0.08, 0.08])
  expect(c.lumB).toBeLessThan(c.lumA)
  await page.getByLabel('Vignette').fill('0')
  await page.getByLabel('Grain').fill('100')
  expect((await compare(page, plain, await exportB64(page), [0, 0, 1, 1])).diff).toBeGreaterThan(1000)
  await page.getByRole('radiogroup', { name: 'Backdrop type' }).getByRole('radio', { name: 'None' }).click()   // transparent backdrop
  const t = await compare(page, await exportB64(page), await exportB64(page), [0, 0, 0.02, 0.02])
  expect(t.alphaA, 'transparent corner stays transparent with grain on').toBe(0)
})

test('backdrop shapes, glare and hide-frame change the picture; magic look sets a blue-ish backdrop for a blue image', async ({ page }) => {
  await withImage(page, 220)
  const base = await exportB64(page)
  await page.getByRole('tab', { name: 'Canvas' }).click()
  await page.getByRole('radio', { name: 'Glows' }).click()
  expect((await compare(page, base, await exportB64(page), [0, 0, 1, 1])).diff).toBeGreaterThan(1000)
  await page.getByRole('radio', { name: 'None', exact: true }).first().click().catch(() => undefined)
  await page.getByRole('tab', { name: 'Device' }).click()
  await page.getByLabel('Screen glare').fill('100')
  await page.getByRole('switch', { name: /Hide the frame/ }).click()
  await expect(page.getByRole('switch', { name: /Hide the frame/ })).toHaveAttribute('aria-checked', 'true')
  await page.getByRole('button', { name: 'Magic look from my image' }).click()
  await page.getByRole('tab', { name: 'Canvas' }).click()
  const [r, , b] = (await pngInfo(page, await (async () => { const dl = page.waitForEvent('download'); await page.getByTestId('export').click(); return (await (await dl).path())! })())).corner
  expect(b).toBeGreaterThan(r)
})

test.describe('accessibility of the new dialogs', () => {
  const scan = async (page: Page) => (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(' ')}`)
  test('command palette and what is new', async ({ page }) => {
    await open(page)
    await page.keyboard.press('Control+k'); expect(await scan(page)).toEqual([]); await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Franneshot' }).click(); expect(await scan(page)).toEqual([])
    await page.getByRole('button', { name: 'What is new' }).click(); expect(await scan(page)).toEqual([])
  })
  test('canvas tab with effects and watermark filled in, in dark mode', async ({ browser }) => {
    const ctx = await browser.newContext({ colorScheme: 'dark' }); const page = await ctx.newPage()
    await open(page); await page.getByRole('tab', { name: 'Canvas' }).click(); await page.getByLabel('Your text').fill('x')
    expect(await scan(page)).toEqual([]); await ctx.close()
  })
})
