import type { Page } from '@playwright/test'

export type Png = { name: string; mimeType: 'image/png'; buffer: Buffer }

/** Build a small test PNG in the browser (no files on disk, nothing from the reference app). */
export async function makePng(page: Page, name: string, w: number, h: number, hue: number): Promise<Png> {
  const dataUrl = await page.evaluate(([w, h, hue, name]) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h
    const x = c.getContext('2d')!
    const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, `hsl(${hue} 70% 30%)`); g.addColorStop(1, `hsl(${hue + 40} 80% 65%)`)
    x.fillStyle = g; x.fillRect(0, 0, w, h)
    x.fillStyle = '#fff'; x.font = `${Math.round(h / 12)}px sans-serif`
    for (let i = 0; i < 12; i++) x.fillText(`${name} line ${i} sample text`, w * 0.08, h * 0.1 + i * (h / 14))
    return c.toDataURL('image/png')
  }, [w, h, hue, name] as const)
  return { name, mimeType: 'image/png', buffer: Buffer.from(dataUrl.split(',')[1], 'base64') }
}

export const mediaInput = (page: Page) => page.locator('[data-testid=media-input]')

/** Checks used by the overflow test: anything outside the viewport or cut off by a clipping parent. */
export const OVERFLOW_JS = `() => {
  const vw = innerWidth, vh = innerHeight, out = [];
  const clipper = (el) => { for (let p = el.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p); if (/(auto|scroll|hidden|clip)/.test(o.overflowX + o.overflowY)) return p; } return null; };
  const doc = document.documentElement;
  if (doc.scrollWidth > vw + 1 || doc.scrollHeight > vh + 1) out.push('page scrolls ' + doc.scrollWidth + 'x' + doc.scrollHeight + ' vs ' + vw + 'x' + vh);
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || el.closest('.sr-only')) continue;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height || el.tagName === 'CANVAS') continue;
    const c = clipper(el);
    if ((r.right > vw + 1 || r.bottom > vh + 1 || r.left < -1 || r.top < -1) && (!c || c === document.body || c === document.documentElement))
      out.push('outside viewport: ' + el.tagName + ' ' + (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40));
    if (c && c !== document.body) { const cr = c.getBoundingClientRect(); if (r.right > cr.right + 1 && !/(auto|scroll)/.test(getComputedStyle(c).overflowX)) out.push('cut by parent: ' + el.tagName + ' ' + (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40)); }
    if (el.scrollWidth > el.clientWidth + 1 && cs.overflowX === 'visible' && !el.children.length && el.textContent.trim() && cs.display !== 'inline') out.push('text overflows: ' + el.textContent.trim().slice(0, 40));
  }
  return [...new Set(out)];
}`

// ---- shared by the slot tests: export, read pixels, compare exports ----
export const exportB64 = async (page: Page): Promise<string> => {
  const dl = page.waitForEvent('download'); await page.getByTestId('export').click()
  return (await import('node:fs')).readFileSync((await (await dl).path())!).toString('base64')
}

/** Pixels that differ between two exports inside a box (fractions of the image). */
export const compareExports = (page: Page, a: string, b: string, box: [number, number, number, number]) => page.evaluate(async ([a, b, box]) => {
  const load = async (x: string) => { const i = new Image(); i.src = 'data:image/png;base64,' + x; await i.decode(); const c = document.createElement('canvas'); c.width = i.naturalWidth; c.height = i.naturalHeight; const g = c.getContext('2d')!; g.drawImage(i, 0, 0); return { c, g } }
  const A = await load(a as string), B = await load(b as string)
  const [x0, y0, x1, y1] = box as number[]; const W = A.c.width, H = A.c.height
  const rx = Math.round(x0 * W), ry = Math.round(y0 * H), rw = Math.max(1, Math.round((x1 - x0) * W)), rh = Math.max(1, Math.round((y1 - y0) * H))
  const da = A.g.getImageData(rx, ry, rw, rh).data, db = B.g.getImageData(rx, ry, rw, rh).data
  let diff = 0; for (let i = 0; i < da.length; i += 4) if (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]) > 12) diff++
  return { diff, total: da.length / 4 }
}, [a, b, box] as const)

/** Where a point of the canvas (fractions) is on screen. */
export const canvasPoint = async (page: Page, fx: number, fy: number) => {
  const r = (await page.getByTestId('stage').boundingBox())!
  return { x: r.x + r.width * fx, y: r.y + r.height * fy }
}
