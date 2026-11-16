import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { CANVAS_PRESETS, CUSTOM_MAX, CUSTOM_MIN, LAYOUT_PRESETS, clampSide, defaultScene, getBentoPreset, maxExportScale, switchFamily } from '@/lib/scene'
import { magicPresetFromStats, paletteFromPixels, statsFromPixels } from '@/lib/palette'
import { TEMPLATES } from '@/lib/templates'
import { DEVICES } from '@/lib/devices'
import { CHANGELOG } from '@/lib/changelog'

const px = (r: number, g: number, b: number, n: number) => Array.from({ length: n }, () => [r, g, b, 255]).flat()

describe('magic palette', () => {
  it('takes the dominant colour first and a clearly different second colour', () => {
    const { from, to } = paletteFromPixels([...px(200, 40, 40, 300), ...px(30, 60, 200, 120), ...px(250, 250, 250, 40)])
    expect(from).toBe('#c82828')
    expect(to).toBe('#1e3cc8')
  })
  it('derives a darker second colour when the image has one colour only', () => {
    const { from, to } = paletteFromPixels(px(60, 160, 90, 400))
    expect(from).not.toBe(to)
    const lum = (h: string) => parseInt(h.slice(1, 3), 16) * 0.3 + parseInt(h.slice(3, 5), 16) * 0.59 + parseInt(h.slice(5, 7), 16) * 0.11
    expect(lum(to)).toBeLessThan(lum(from))
  })
  it('is deterministic and survives empty or see-through images', () => {
    const data = [...px(10, 200, 120, 90), ...px(250, 120, 20, 70)]
    expect(paletteFromPixels(data)).toEqual(paletteFromPixels(data))
    expect(paletteFromPixels([])).toEqual({ from: '#64748b', to: '#0f172a' })
    expect(paletteFromPixels(Array.from({ length: 40 }, () => [0, 0, 0, 0]).flat())).toEqual({ from: '#64748b', to: '#0f172a' })
  })
})

describe('canvas sizes and export scale', () => {
  it('clamps custom sides and rejects junk', () => {
    expect(clampSide(10)).toBe(CUSTOM_MIN)
    expect(clampSide(99999)).toBe(CUSTOM_MAX)
    expect(clampSide(1000.4)).toBe(1000)
    expect(clampSide(Number.NaN)).toBe(CUSTOM_MIN)
  })
  it('allows 3x on normal canvases and steps down on huge ones', () => {
    expect(maxExportScale(1920, 1440)).toBe(3)
    expect(maxExportScale(4096, 4096)).toBe(2)
    expect(maxExportScale(CUSTOM_MAX, CUSTOM_MAX)).toBeLessThanOrEqual(2)
  })
  it('every preset fits the custom range and ids are unique', () => {
    expect(new Set(CANVAS_PRESETS.map((p) => p.id)).size).toBe(CANVAS_PRESETS.length)
    for (const p of CANVAS_PRESETS) { expect(p.w).toBeGreaterThanOrEqual(CUSTOM_MIN); expect(p.w).toBeLessThanOrEqual(CUSTOM_MAX); expect(p.h).toBeLessThanOrEqual(CUSTOM_MAX) }
    expect(CANVAS_PRESETS.filter((p) => p.group === 'Social').length).toBeGreaterThanOrEqual(5)
    expect(CANVAS_PRESETS.filter((p) => p.group === 'Stores').length).toBeGreaterThanOrEqual(3)
  })
})

describe('catalog sizes', () => {
  it('has a real catalog of frames and layouts', () => {
    expect(DEVICES.length).toBeGreaterThanOrEqual(15)
    expect(LAYOUT_PRESETS.filter((p) => p.family === 'zoom').length).toBeGreaterThanOrEqual(6)
    expect(LAYOUT_PRESETS.filter((p) => p.family === 'tilt').length).toBeGreaterThanOrEqual(6)
  })
})

describe('templates', () => {
  it('apply cleanly, keep the user image and point at real presets', () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(8)
    for (const t of TEMPLATES) {
      const base = { ...defaultScene(), mockup: { ...defaultScene().mockup, mediaId: 'img-1' } }
      const out = t.apply(base)
      expect(out.mockup.mediaId, t.id).toBe('img-1')
      if (out.mockup.layout.family === 'bento') {
        expect(out.bento, t.id).toBeTruthy()
        expect(getBentoPreset(out.bento!.presetId).id).toBe(out.bento!.presetId)
        expect(out.bento!.cells[0].mediaId, `${t.id} carries the image into cell 1`).toBe('img-1')
        expect(out.bento!.cells).toHaveLength(getBentoPreset(out.bento!.presetId).rects.length)
      } else {
        expect(LAYOUT_PRESETS.some((p) => p.id === out.mockup.layout.preset && p.family === out.mockup.layout.family), t.id).toBe(true)
      }
    }
  })
  it('does not mutate the scene it is given', () => {
    const base = defaultScene(); const before = JSON.stringify(base)
    for (const t of TEMPLATES) t.apply(base)
    expect(JSON.stringify(base)).toBe(before)
  })
})

describe('magic preset', () => {
  it('picks a frosted frame and stronger shadow for dark images, a plain frame for light ones', () => {
    expect(magicPresetFromStats({ from: '#112233', to: '#000000', luminance: 0.2, aspect: 1 })).toMatchObject({ style: 'glass-light', shadow: { opacity: 55 } })
    expect(magicPresetFromStats({ from: '#eeeeee', to: '#aaaaaa', luminance: 0.85, aspect: 1 }).style).toBe('plain')
    expect(magicPresetFromStats({ from: '#336699', to: '#99ccff', luminance: 0.5, aspect: 1 }).style).toBe('liquid')
  })
  it('tilts wide images and keeps tall ones flat; backdrop comes from the image colours', () => {
    expect(magicPresetFromStats({ from: '#336699', to: '#99ccff', luminance: 0.5, aspect: 1.8 }).layoutPreset).toBe('tilt-right')
    const tall = magicPresetFromStats({ from: '#336699', to: '#99ccff', luminance: 0.5, aspect: 0.5 })
    expect(tall.layoutPreset).toBe('flat')
    expect(tall.gradient).toEqual({ from: '#336699', to: '#99ccff', angle: 135 })
  })
  it('measures average brightness from pixels', () => {
    expect(statsFromPixels(Array.from({ length: 16 }, () => [255, 255, 255, 255]).flat(), 1).luminance).toBeCloseTo(1, 1)
    expect(statsFromPixels(Array.from({ length: 16 }, () => [0, 0, 0, 255]).flat(), 1).luminance).toBeCloseTo(0, 1)
  })
})

describe('switchFamily', () => {
  it('brings the single image into bento cell 1 the first time only', () => {
    const base = { ...defaultScene(), mockup: { ...defaultScene().mockup, mediaId: 'm1' } }
    const bento = switchFamily(base, 'bento')
    expect(bento.bento!.cells[0].mediaId).toBe('m1')
    const back = switchFamily(bento, 'tilt')
    expect(back.mockup.layout.family).toBe('tilt')
    expect(back.bento).toBe(bento.bento)                       // cells kept for later
    expect(switchFamily(back, 'tilt')).toBe(back)              // no-op returns the same scene
  })
})

describe('changelog and themes', () => {
  it('has entries with items', () => { expect(CHANGELOG.length).toBeGreaterThan(0); for (const e of CHANGELOG) expect(e.items.length).toBeGreaterThan(0) })
  it('tokens.css defines light, explicit dark and system dark', () => {
    const css = readFileSync(path.resolve(__dirname, '../../app/tokens.css'), 'utf8')
    expect(css).toContain(":root[data-theme='dark']")
    expect(css).toContain('prefers-color-scheme: dark')
    expect(css).toContain('color-scheme: light')
  })
})
