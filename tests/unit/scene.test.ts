import { describe, expect, it } from 'vitest'
import { BENTO_PRESETS, CANVAS_PRESETS, LAYOUT_PRESETS, defaultBento, defaultScene, fitCells, getBentoPreset } from '@/lib/scene'
import { DEVICES, getDevice } from '@/lib/devices'

describe('bento presets', () => {
  it.each(BENTO_PRESETS.map((p) => [p.id, p] as const))('%s tiles the 12 x 12 grid exactly (no gaps, no overlaps)', (_id, p) => {
    const grid = Array.from({ length: 12 }, () => Array<number>(12).fill(0))
    for (const [c, r, w, h] of p.rects) {
      expect(c + w).toBeLessThanOrEqual(12)
      expect(r + h).toBeLessThanOrEqual(12)
      for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) grid[y][x]++
    }
    expect(grid.flat().every((n) => n === 1)).toBe(true)
  })
  it('has unique ids and 2 to 9 cells each', () => {
    expect(new Set(BENTO_PRESETS.map((p) => p.id)).size).toBe(BENTO_PRESETS.length)
    for (const p of BENTO_PRESETS) { expect(p.rects.length).toBeGreaterThanOrEqual(2); expect(p.rects.length).toBeLessThanOrEqual(9) }
  })
  it('falls back to the first preset for an unknown id', () => expect(getBentoPreset('nope').id).toBe(BENTO_PRESETS[0].id))
})

describe('fitCells', () => {
  it('keeps existing cells (and their images) when the new preset has the same or more cells', () => {
    const six = fitCells([], 'six-bento').map((c, i) => ({ ...c, mediaId: `m${i}` }))
    const four = fitCells(six, 'quad')
    expect(four.map((c) => c.mediaId)).toEqual(['m0', 'm1', 'm2', 'm3'])
    const back = fitCells(four, 'six-bento')
    expect(back).toHaveLength(6)
    expect(back.slice(0, 4).map((c) => c.mediaId)).toEqual(['m0', 'm1', 'm2', 'm3'])
    expect(back[4].mediaId).toBeUndefined()
  })
  it('creates the right number of empty cells by default', () => {
    const b = defaultBento('five')
    expect(b.cells).toHaveLength(5)
    expect(b.cells.every((c) => !c.mediaId && !c.framed && c.fit === 'fill' && c.zoom === 100)).toBe(true)
  })
})

describe('scene defaults and catalogs', () => {
  it('default scene is a single mockup in a known canvas preset', () => {
    const s = defaultScene()
    expect(s.mockup.layout.family).toBe('zoom')
    expect(CANVAS_PRESETS.some((p) => p.id === s.canvas.preset && p.w === s.canvas.w && p.h === s.canvas.h)).toBe(true)
  })
  it('layout presets are unique per family and the default exists', () => {
    expect(new Set(LAYOUT_PRESETS.map((p) => p.id)).size).toBe(LAYOUT_PRESETS.length)
    expect(LAYOUT_PRESETS.some((p) => p.id === defaultScene().mockup.layout.preset)).toBe(true)
  })
  it('devices have unique slugs and sane geometry; unknown slug falls back', () => {
    expect(new Set(DEVICES.map((d) => d.slug)).size).toBe(DEVICES.length)
    for (const d of DEVICES) { expect(d.aspect).toBeGreaterThan(0.3); expect(d.aspect).toBeLessThan(4); expect(d.bezel).toBeGreaterThanOrEqual(0); expect(d.bezel).toBeLessThan(0.15) }
    expect(getDevice('nope').slug).toBe(DEVICES[0].slug)
  })
})
