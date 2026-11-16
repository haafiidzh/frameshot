import { describe, expect, it } from 'vitest'
import { ARRANGEMENTS, MAX_SLOTS, OFFSET_LIMIT, SIZE_MAX, SIZE_MIN, arrangementBoxes, arrangementOf, assignSlots, clampOffset, defaultScene, isDefaultOffset, panFocus, setCount, setSlotMedia, setSlotOffset, slotCount, slotMediaIds, slotOffset, storedMediaIds, switchFamily, type Scene } from '@/lib/scene'
import { slotRects } from '@/lib/render'

const W = 1920, H = 1440
const withImages = (n: number, count: 1 | 2 | 3 | 4 = n as 1 | 2 | 3 | 4): Scene => {
  let s: Scene = { ...defaultScene(), mockup: { ...defaultScene().mockup, layout: { family: 'zoom', preset: 'flat', zoom: 100 } } }
  s = setCount(s, count)
  for (let i = 0; i < n; i++) s = setSlotMedia(s, i, `img-${i + 1}`)
  return s
}

describe('arrangements', () => {
  it('give one box per image, inside the canvas, with no NaN', () => {
    for (const n of [1, 2, 3, 4] as const) {
      const ids = n === 1 ? [undefined] : ARRANGEMENTS[n].map((a) => a.id)
      for (const id of ids) {
        const boxes = arrangementBoxes(n, id)
        expect(boxes, `${n}/${id}`).toHaveLength(n)
        for (const b of boxes) {
          for (const v of [b.cx, b.cy, b.w, b.h]) expect(Number.isFinite(v)).toBe(true)
          expect(b.cx - b.w / 2).toBeGreaterThanOrEqual(-1e-9); expect(b.cx + b.w / 2).toBeLessThanOrEqual(1 + 1e-9)
          expect(b.cy - b.h / 2).toBeGreaterThanOrEqual(-1e-9); expect(b.cy + b.h / 2).toBeLessThanOrEqual(1 + 1e-9)
        }
      }
    }
  })
  it('offer two arrangements for 2, 3 and 4 images, and fall back to the first for a wrong id', () => {
    for (const n of [2, 3, 4] as const) expect(ARRANGEMENTS[n]).toHaveLength(2)
    expect(arrangementBoxes(3, 'grid')).toEqual(arrangementBoxes(3, ARRANGEMENTS[3][0].id))
    expect(arrangementBoxes(MAX_SLOTS + 5, 'grid')).toHaveLength(MAX_SLOTS)
  })
  it('one image fills the canvas, exactly like before', () => expect(arrangementBoxes(1)).toEqual([{ cx: 0.5, cy: 0.5, w: 1, h: 1 }]))
  it('resolves the saved arrangement only when it fits the count', () => {
    let s = setCount(withImages(0, 1), 2); expect(arrangementOf(s)).toBe('side')
    s = { ...s, mockup: { ...s.mockup, arrangement: 'cascade' } }; expect(arrangementOf(s)).toBe('cascade')
    s = setCount(s, 4); expect(arrangementOf(s)).toBe('cascade')               // valid for 4 too
    s = setCount({ ...s, mockup: { ...s.mockup, arrangement: 'row' } }, 4); expect(arrangementOf(s)).toBe('grid')   // 'row' is not a 4-image arrangement
    expect(arrangementOf(setCount(s, 1))).toBeUndefined()
  })
})

describe('slots and images', () => {
  it('a scene without the new fields still works (one image, no offsets)', () => {
    const old = { ...defaultScene(), mockup: { ...defaultScene().mockup, mediaId: 'm1' } }
    expect(slotCount(old)).toBe(1)
    expect(slotMediaIds(old)).toEqual(['m1'])
    expect(storedMediaIds(old)).toEqual(['m1'])
    expect(slotOffset(old, 0)).toEqual({ x: 0, y: 0, s: 1 })
    expect(isDefaultOffset(old, 0)).toBe(true)
    expect(slotRects(old, W, H)).toHaveLength(1)
    expect(setSlotOffset(old, 0, { x: 0, y: 0, s: 1 })).toBe(old)               // nothing changed, same object
  })
  it('lowering the count hides images but keeps them, and raising it brings them back', () => {
    const four = withImages(4)
    const two = setCount(four, 2)
    expect(slotMediaIds(two)).toEqual(['img-1', 'img-2'])
    expect(storedMediaIds(two)).toEqual(['img-1', 'img-2', 'img-3', 'img-4'])
    expect(slotMediaIds(setCount(two, 4))).toEqual(['img-1', 'img-2', 'img-3', 'img-4'])
    expect(setCount(four, 4)).toBe(four)
    expect(slotCount(setCount(four, 99))).toBe(4)
    expect(slotCount(setCount(four, -3))).toBe(1)
  })
  it('setSlotMedia only touches its own slot and ignores slots that do not exist', () => {
    const s = withImages(3)
    const t = setSlotMedia(s, 1, undefined)
    expect(slotMediaIds(t)).toEqual(['img-1', undefined, 'img-3'])
    expect(setSlotMedia(s, 7, 'x')).toBe(s)
    expect(setSlotMedia(s, -1, 'x')).toBe(s)
  })
  it('assignSlots puts the first image at the chosen slot and the rest into the next empty ones', () => {
    const s = setSlotMedia(withImages(0, 4), 2, 'keep')
    const r = assignSlots(s, ['a', 'b', 'c'], 1)
    expect(slotMediaIds(r.scene)).toEqual(['b', 'a', 'keep', 'c'])
    expect(r.placed).toBe(3)
  })
  it('assignSlots reports images that did not fit and never writes outside the visible slots', () => {
    const s = withImages(0, 2)
    const r = assignSlots(s, ['a', 'b', 'c', 'd'], 0)
    expect(r.placed).toBe(2)
    expect(slotMediaIds(r.scene)).toEqual(['a', 'b'])
    expect(storedMediaIds(r.scene)).toEqual(['a', 'b'])
  })
  it('switching to bento brings every visible image along', () => {
    const b = switchFamily(withImages(3), 'bento')
    expect(b.bento!.cells.slice(0, 3).map((c) => c.mediaId)).toEqual(['img-1', 'img-2', 'img-3'])
  })
})

describe('offsets', () => {
  it('are clamped to the allowed range and never NaN', () => {
    expect(clampOffset({ x: 9, y: -9, s: 99 })).toEqual({ x: OFFSET_LIMIT, y: -OFFSET_LIMIT, s: SIZE_MAX })
    expect(clampOffset({ s: 0.01 }).s).toBe(SIZE_MIN)
    expect(clampOffset({ x: Number.NaN, y: Infinity, s: Number.NaN })).toEqual({ x: 0, y: 0, s: 1 })   // junk falls back to the default position
    expect(clampOffset({})).toEqual({ x: 0, y: 0, s: 1 })
  })
  it('change one slot and leave the others at their default', () => {
    const s = setSlotOffset(withImages(3), 1, { x: 0.1, y: -0.05, s: 1.4 })
    expect(slotOffset(s, 1)).toEqual({ x: 0.1, y: -0.05, s: 1.4 })
    expect(isDefaultOffset(s, 0)).toBe(true)
    expect(isDefaultOffset(s, 2)).toBe(true)
    expect(isDefaultOffset(s, 1)).toBe(false)
    expect(setSlotOffset(s, 1, { x: 0, y: 0, s: 1 }).mockup.offsets?.[1]).toEqual({ x: 0, y: 0, s: 1 })
    expect(setSlotOffset(s, 9, { x: 0.2 })).toBe(s)
  })
  it('survive a change of count', () => {
    const s = setSlotOffset(withImages(4), 3, { x: 0.2 })
    expect(slotOffset(setCount(setCount(s, 2), 4), 3).x).toBe(0.2)
  })
})

describe('slotRects (hit-testing)', () => {
  it('returns one finite rectangle per slot, inside the canvas at the defaults', () => {
    for (const n of [1, 2, 3, 4] as const) {
      const rects = slotRects(withImages(n), W, H)
      expect(rects).toHaveLength(n)
      for (const r of rects) {
        for (const v of [r.x, r.y, r.w, r.h]) expect(Number.isFinite(v)).toBe(true)
        expect(r.w).toBeGreaterThan(0); expect(r.h).toBeGreaterThan(0)
        expect(r.x).toBeGreaterThanOrEqual(-W * 0.01); expect(r.x + r.w).toBeLessThanOrEqual(W * 1.01)
        expect(r.y).toBeGreaterThanOrEqual(-H * 0.01); expect(r.y + r.h).toBeLessThanOrEqual(H * 1.01)
      }
    }
  })
  it('contain the middle of their own box so a click lands on the right image', () => {
    const s = withImages(3)
    const boxes = arrangementBoxes(3, arrangementOf(s))
    slotRects(s, W, H).forEach((r, i) => {
      const cx = boxes[i].cx * W, cy = boxes[i].cy * H
      expect(cx).toBeGreaterThanOrEqual(r.x); expect(cx).toBeLessThanOrEqual(r.x + r.w)
      expect(cy).toBeGreaterThanOrEqual(r.y); expect(cy).toBeLessThanOrEqual(r.y + r.h)
    })
  })
  it('move with the offset and grow with the size multiplier', () => {
    const base = slotRects(withImages(2), W, H)[0]
    const moved = slotRects(setSlotOffset(withImages(2), 0, { x: 0.1, y: -0.05 }), W, H)[0]
    expect(moved.x - base.x).toBeCloseTo(0.1 * W, 5)
    expect(moved.y - base.y).toBeCloseTo(-0.05 * H, 5)
    expect(moved.w).toBeCloseTo(base.w, 5)
    const big = slotRects(setSlotOffset(withImages(2), 0, { s: 1.5 }), W, H)[0]
    expect(big.w / base.w).toBeCloseTo(1.5, 5)
  })
  it('cover a tilted image too (perspective makes the outline taller on the near side)', () => {
    const flat = slotRects(withImages(1), W, H)[0]
    const tilt = slotRects({ ...withImages(1), mockup: { ...withImages(1).mockup, layout: { family: 'tilt', preset: 'tilt-right', zoom: 100 } } }, W, H)[0]
    expect(tilt.w).toBeGreaterThan(0)
    expect(tilt.h).toBeGreaterThan(flat.h * 0.95)
    expect(tilt.w).toBeLessThan(flat.w)                                             // narrower when turned away
  })
})

describe('panFocus', () => {
  it('moves the picture with the pointer and clamps at the edges', () => {
    // 2000 x 1000 image in a 500 x 500 cell at 100%: it is cropped sideways, so only x can pan
    const a = panFocus(2000, 1000, 500, 500, 100, 0.5, 0.5, -100, 0)             // drag left: the picture moves left, focus goes right
    expect(a.fx).toBeGreaterThan(0.5); expect(a.fy).toBe(0.5)
    expect(panFocus(2000, 1000, 500, 500, 100, 0.5, 0.5, 100, 0).fx).toBeLessThan(0.5)
    expect(panFocus(2000, 1000, 500, 500, 100, 0.9, 0.5, -99999, 0).fx).toBe(1)
    expect(panFocus(2000, 1000, 500, 500, 100, 0.1, 0.5, 99999, 0).fx).toBe(0)
  })
  it('does nothing on an axis where the whole image already shows', () => {
    expect(panFocus(1000, 1000, 500, 500, 100, 0.5, 0.5, 80, 80)).toEqual({ fx: 0.5, fy: 0.5 })
  })
  it('pans further per pixel when zoomed out and less when zoomed in', () => {
    const slow = panFocus(2000, 1000, 500, 500, 300, 0.5, 0.5, -20, 0).fx - 0.5
    const fast = panFocus(2000, 1000, 500, 500, 100, 0.5, 0.5, -20, 0).fx - 0.5
    expect(slow).toBeGreaterThan(0); expect(fast).toBeGreaterThan(slow * 0.99)
  })
})
