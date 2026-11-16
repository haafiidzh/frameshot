// Serialisable scene model (architecture.md section 2). Media bytes live in lib/media.ts, scenes only hold ids.
export type BackgroundType = 'transparent' | 'color' | 'gradient' | 'image'
export type StyleId = 'plain' | 'glass-light' | 'glass-dark' | 'inset-light' | 'inset-dark' | 'outline' | 'border' | 'liquid' | 'tinted' | 'double'
export type CornerType = 'sharp' | 'curved' | 'round'
export type ShadowMode = 'none' | 'spread' | 'hug' | 'adaptive'

export interface Scene {
  schemaVersion: 1
  canvas: { w: number; h: number; preset: string }
  background: {
    type: BackgroundType
    color: string
    gradient: { from: string; to: string; angle: number }
    imageId?: string
  }
  mockup: {
    deviceSlug: string
    style: StyleId
    border: { type: CornerType; radius: number }
    shadow: { mode: ShadowMode; opacity: number }
    mediaId?: string
    layout: { family: LayoutFamily; preset: string; zoom: number }
    /** screen glare 0..100 (0 = none) */
    light?: number
    /** draw the image alone, without a device frame */
    hideFrame?: boolean
    /** Zoom and Tilt: how many images share the picture (1 to 4). Missing means 1. */
    count?: 1 | 2 | 3 | 4
    /** Images for slots 2 to 4. Slot 1 is `mediaId`. Hidden slots keep their image when the count goes down. */
    extraMediaIds?: (string | undefined)[]
    /** Per-slot nudge from the arrangement position: x and y as fractions of the canvas, s a size multiplier. */
    offsets?: SlotOffset[]
    arrangement?: Arrangement
  }
  effects?: { grain: number; vignette: number }
  shapes?: ShapeStyle
  watermark?: Watermark
  /** Present once the user has opened Bento mode; cells are kept when they switch back. */
  bento?: Bento
}

export type ShapeStyle = 'none' | 'orbs' | 'rings'
export type WatermarkPos = 'left' | 'center' | 'right'
export interface Watermark { text: string; position: WatermarkPos; opacity: number }
export const WATERMARK_MAX = 40
export type LayoutFamily = 'zoom' | 'tilt' | 'bento'
export type CellFit = 'fill' | 'fit'
export interface BentoCell {
  mediaId?: string
  /** true: draw the chosen device frame around the image; false: plain rounded image */
  framed: boolean
  fit: CellFit
  /** 100..300, plain cells only */
  zoom: number
  /** crop focus 0..1, plain cells only */
  fx: number
  fy: number
}
export interface Bento { presetId: string; gap: number; radius: number; cells: BentoCell[] }
/** A cell is [column, row, columns, rows] on a 12 x 12 grid. */
export type CellRect = [number, number, number, number]
export interface BentoPreset { id: string; label: string; rects: CellRect[] }
export const BENTO_PRESETS: BentoPreset[] = [
  { id: 'duo', label: 'Side by side', rects: [[0, 0, 6, 12], [6, 0, 6, 12]] },
  { id: 'duo-stack', label: 'Stacked', rects: [[0, 0, 12, 6], [0, 6, 12, 6]] },
  { id: 'trio-hero', label: 'Hero left', rects: [[0, 0, 7, 12], [7, 0, 5, 6], [7, 6, 5, 6]] },
  { id: 'trio-top', label: 'Hero top', rects: [[0, 0, 12, 7], [0, 7, 6, 5], [6, 7, 6, 5]] },
  { id: 'quad', label: 'Four equal', rects: [[0, 0, 6, 6], [6, 0, 6, 6], [0, 6, 6, 6], [6, 6, 6, 6]] },
  { id: 'quad-bento', label: 'Four mixed', rects: [[0, 0, 8, 7], [8, 0, 4, 7], [0, 7, 4, 5], [4, 7, 8, 5]] },
  { id: 'five', label: 'Five', rects: [[0, 0, 5, 12], [5, 0, 7, 6], [5, 6, 4, 6], [9, 6, 3, 3], [9, 9, 3, 3]] },
  { id: 'six-bento', label: 'Six', rects: [[0, 0, 6, 8], [6, 0, 6, 4], [6, 4, 3, 4], [9, 4, 3, 4], [0, 8, 4, 4], [4, 8, 8, 4]] },
]
export const getBentoPreset = (id: string) => BENTO_PRESETS.find((p) => p.id === id) ?? BENTO_PRESETS[0]
export const newCell = (): BentoCell => ({ framed: false, fit: 'fill', zoom: 100, fx: 0.5, fy: 0.5 })
/** Resize the cell list to the preset, keeping the cells (and their images) that still fit. */
export const fitCells = (cells: BentoCell[], presetId: string): BentoCell[] =>
  getBentoPreset(presetId).rects.map((_, i) => cells[i] ?? newCell())
export const defaultBento = (presetId = 'quad-bento'): Bento => ({ presetId, gap: 16, radius: 28, cells: fitCells([], presetId) })

export type CanvasGroup = 'Basic' | 'Social' | 'Stores'
export interface CanvasPreset { id: string; label: string; w: number; h: number; group: CanvasGroup }
export const CANVAS_PRESETS: CanvasPreset[] = [
  { id: 'classic', label: 'Classic 4:3', w: 1920, h: 1440, group: 'Basic' },
  { id: 'wide', label: 'Wide 16:9', w: 1920, h: 1080, group: 'Basic' },
  { id: 'square', label: 'Square 1:1', w: 1600, h: 1600, group: 'Basic' },
  { id: 'portrait', label: 'Portrait 4:5', w: 1440, h: 1800, group: 'Basic' },
  { id: 'story', label: 'Tall 9:16', w: 1080, h: 1920, group: 'Basic' },
  { id: 'banner', label: 'Banner 3:1', w: 2400, h: 800, group: 'Basic' },
  { id: 'feed-portrait', label: 'Feed post 4:5', w: 1080, h: 1350, group: 'Social' },
  { id: 'feed-square', label: 'Feed post 1:1', w: 1080, h: 1080, group: 'Social' },
  { id: 'wide-post', label: 'Wide post', w: 1600, h: 900, group: 'Social' },
  { id: 'link-card', label: 'Link card', w: 1200, h: 627, group: 'Social' },
  { id: 'video-cover', label: 'Video cover', w: 1280, h: 720, group: 'Social' },
  { id: 'og-image', label: 'Share preview', w: 1200, h: 630, group: 'Social' },
  { id: 'phone-store', label: 'Phone store shot', w: 1290, h: 2796, group: 'Stores' },
  { id: 'tablet-store', label: 'Tablet store shot', w: 2048, h: 2732, group: 'Stores' },
  { id: 'play-feature', label: 'Play feature banner', w: 1024, h: 500, group: 'Stores' },
]
/** Custom sizes are limited so a 3x export stays inside what browsers can draw. */
export const CUSTOM_MIN = 64
export const CUSTOM_MAX = 4096
export const clampSide = (n: number) => Math.min(CUSTOM_MAX, Math.max(CUSTOM_MIN, Math.round(Number.isFinite(n) ? n : CUSTOM_MIN)))
/** Highest export scale (1 to 3) that keeps the PNG under ~100 megapixels. */
export const maxExportScale = (w: number, h: number): 1 | 2 | 3 => ((w * h * 9 <= 100e6 ? 3 : w * h * 4 <= 100e6 ? 2 : 1))

export interface LayoutPreset { id: string; label: string; family: 'zoom' | 'tilt'; rotY: number; rotZ: number; zoom: number; shiftX: number; shiftY: number }
export const LAYOUT_PRESETS: LayoutPreset[] = [
  { id: 'flat', label: 'Flat', family: 'zoom', rotY: 0, rotZ: 0, zoom: 100, shiftX: 0, shiftY: 0 },
  { id: 'close', label: 'Close-up', family: 'zoom', rotY: 0, rotZ: 0, zoom: 140, shiftX: 0, shiftY: 0 },
  { id: 'corner', label: 'Corner crop', family: 'zoom', rotY: 0, rotZ: 0, zoom: 190, shiftX: -0.28, shiftY: -0.2 },
  { id: 'far', label: 'Far away', family: 'zoom', rotY: 0, rotZ: 0, zoom: 70, shiftX: 0, shiftY: 0 },
  { id: 'left-peek', label: 'Left peek', family: 'zoom', rotY: 0, rotZ: 0, zoom: 165, shiftX: 0.3, shiftY: 0 },
  { id: 'top-peek', label: 'Top peek', family: 'zoom', rotY: 0, rotZ: 0, zoom: 165, shiftX: 0, shiftY: 0.24 },
  { id: 'tilt-right', label: 'Tilt right', family: 'tilt', rotY: -24, rotZ: 0, zoom: 100, shiftX: 0, shiftY: 0 },
  { id: 'tilt-left', label: 'Tilt left', family: 'tilt', rotY: 24, rotZ: 0, zoom: 100, shiftX: 0, shiftY: 0 },
  { id: 'lean', label: 'Lean', family: 'tilt', rotY: -18, rotZ: -8, zoom: 100, shiftX: 0, shiftY: 0 },
  { id: 'lean-left', label: 'Lean left', family: 'tilt', rotY: 18, rotZ: 8, zoom: 100, shiftX: 0, shiftY: 0 },
  { id: 'tilt-deep-right', label: 'Deep right', family: 'tilt', rotY: -40, rotZ: 0, zoom: 100, shiftX: 0, shiftY: 0 },
  { id: 'tilt-deep-left', label: 'Deep left', family: 'tilt', rotY: 40, rotZ: 0, zoom: 100, shiftX: 0, shiftY: 0 },
  { id: 'tilt-corner', label: 'Corner tilt', family: 'tilt', rotY: -30, rotZ: -12, zoom: 125, shiftX: 0.1, shiftY: 0.04 },
]

export const SOLID_COLORS = ['#ffffff', '#e5e7eb', '#9ca3af', '#1f2937', '#fde68a', '#bfdbfe', '#bbf7d0', '#fecdd3']
export const GRADIENTS: { id: string; from: string; to: string; angle: number }[] = [
  { id: 'sunset', from: '#ff7a3d', to: '#7c3aed', angle: 135 },
  { id: 'ocean', from: '#0ea5e9', to: '#1e1b4b', angle: 160 },
  { id: 'mint', from: '#6ee7b7', to: '#2563eb', angle: 120 },
  { id: 'blush', from: '#fbcfe8', to: '#a5b4fc', angle: 135 },
  { id: 'ember', from: '#facc15', to: '#dc2626', angle: 150 },
  { id: 'slate', from: '#64748b', to: '#0f172a', angle: 145 },
  { id: 'forest', from: '#a3e635', to: '#065f46', angle: 130 },
  { id: 'dusk', from: '#f0abfc', to: '#1d4ed8', angle: 125 },
]

export const defaultScene = (): Scene => ({
  schemaVersion: 1,
  canvas: { w: 1920, h: 1440, preset: 'classic' },
  background: { type: 'gradient', color: '#e5e7eb', gradient: { from: '#ff7a3d', to: '#7c3aed', angle: 135 } },
  mockup: {
    deviceSlug: 'screenshot',
    style: 'plain',
    border: { type: 'curved', radius: 20 },
    shadow: { mode: 'spread', opacity: 40 },
    layout: { family: 'zoom', preset: 'flat', zoom: 100 },
  },
})

/** Switch between Zoom, Tilt and Bento. First time in Bento, the single image comes along as cell 1. */
export function switchFamily(s: Scene, v: LayoutFamily): Scene {
  if (s.mockup.layout.family === v) return s
  if (v === 'bento') {
    const fresh = !s.bento
    const b = s.bento ?? defaultBento()
    // First time in Bento, the images already on screen come along, in slot order.
    const carried = slotMediaIds(s)
    const cells = fresh ? b.cells.map((c, i) => (carried[i] ? { ...c, mediaId: carried[i] } : c)) : b.cells
    return { ...s, bento: { ...b, cells }, mockup: { ...s.mockup, layout: { ...s.mockup.layout, family: 'bento' } } }
  }
  return { ...s, mockup: { ...s.mockup, layout: { ...s.mockup.layout, family: v, preset: LAYOUT_PRESETS.find((p) => p.family === v)!.id } } }
}

// ---- Several images in Zoom and Tilt (slots) ----
export type Arrangement = 'side' | 'cascade' | 'row' | 'grid'
export interface SlotOffset { x: number; y: number; s: number }
/** Slot box as fractions of the canvas, by centre and size. */
export interface SlotBox { cx: number; cy: number; w: number; h: number }
export const MAX_SLOTS = 4
export const OFFSET_LIMIT = 0.6
export const SIZE_MIN = 0.4
export const SIZE_MAX = 1.8
export const DEFAULT_OFFSET: SlotOffset = { x: 0, y: 0, s: 1 }

export const ARRANGEMENTS: Record<2 | 3 | 4, { id: Arrangement; label: string }[]> = {
  2: [{ id: 'side', label: 'Side by side' }, { id: 'cascade', label: 'Cascade' }],
  3: [{ id: 'cascade', label: 'Cascade' }, { id: 'row', label: 'In a row' }],
  4: [{ id: 'grid', label: 'Grid' }, { id: 'cascade', label: 'Cascade' }],
}

const BOXES: Record<string, SlotBox[]> = {
  '2/side': [{ cx: 0.3, cy: 0.5, w: 0.5, h: 0.8 }, { cx: 0.7, cy: 0.5, w: 0.5, h: 0.8 }],
  '2/cascade': [{ cx: 0.38, cy: 0.4, w: 0.62, h: 0.66 }, { cx: 0.62, cy: 0.6, w: 0.62, h: 0.66 }],
  '3/cascade': [{ cx: 0.3, cy: 0.34, w: 0.5, h: 0.56 }, { cx: 0.5, cy: 0.5, w: 0.5, h: 0.56 }, { cx: 0.7, cy: 0.66, w: 0.5, h: 0.56 }],
  '3/row': [{ cx: 0.2, cy: 0.5, w: 0.4, h: 0.78 }, { cx: 0.5, cy: 0.5, w: 0.4, h: 0.78 }, { cx: 0.8, cy: 0.5, w: 0.4, h: 0.78 }],
  '4/grid': [{ cx: 0.3, cy: 0.3, w: 0.46, h: 0.46 }, { cx: 0.7, cy: 0.3, w: 0.46, h: 0.46 }, { cx: 0.3, cy: 0.7, w: 0.46, h: 0.46 }, { cx: 0.7, cy: 0.7, w: 0.46, h: 0.46 }],
  '4/cascade': [{ cx: 0.24, cy: 0.28, w: 0.42, h: 0.5 }, { cx: 0.42, cy: 0.45, w: 0.42, h: 0.5 }, { cx: 0.6, cy: 0.55, w: 0.42, h: 0.5 }, { cx: 0.78, cy: 0.72, w: 0.42, h: 0.5 }],
}

export const slotCount = (s: Scene): 1 | 2 | 3 | 4 => {
  const n = Math.round(s.mockup.count ?? 1)
  return (n >= 4 ? 4 : n <= 1 ? 1 : n) as 1 | 2 | 3 | 4
}
/** The saved arrangement if it fits the current count, else the first one for that count. */
export const arrangementOf = (s: Scene): Arrangement | undefined => {
  const n = slotCount(s)
  if (n === 1) return undefined
  const list = ARRANGEMENTS[n]
  return list.find((a) => a.id === s.mockup.arrangement)?.id ?? list[0].id
}
/** Where each slot sits, as canvas fractions. One image fills the canvas (the original single layout). */
export function arrangementBoxes(n: number, arrangement?: Arrangement): SlotBox[] {
  if (n <= 1) return [{ cx: 0.5, cy: 0.5, w: 1, h: 1 }]
  const count = Math.min(MAX_SLOTS, Math.round(n)) as 2 | 3 | 4
  const id = ARRANGEMENTS[count].find((a) => a.id === arrangement)?.id ?? ARRANGEMENTS[count][0].id
  return BOXES[`${count}/${id}`]
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : 0))
export const clampOffset = (o: Partial<SlotOffset>): SlotOffset => ({
  x: clamp(o.x ?? 0, -OFFSET_LIMIT, OFFSET_LIMIT),
  y: clamp(o.y ?? 0, -OFFSET_LIMIT, OFFSET_LIMIT),
  s: Number.isFinite(o.s) ? clamp(o.s as number, SIZE_MIN, SIZE_MAX) : 1,
})
export const slotOffset = (s: Scene, i: number): SlotOffset => clampOffset(s.mockup.offsets?.[i] ?? DEFAULT_OFFSET)
export const isDefaultOffset = (s: Scene, i: number) => { const o = slotOffset(s, i); return o.x === 0 && o.y === 0 && o.s === 1 }

/** Change one slot's position or size. Values are clamped; the same scene comes back when nothing changes. */
export function setSlotOffset(s: Scene, i: number, patch: Partial<SlotOffset>): Scene {
  if (i < 0 || i >= MAX_SLOTS) return s
  const next = clampOffset({ ...slotOffset(s, i), ...patch })
  const cur = slotOffset(s, i)
  if (next.x === cur.x && next.y === cur.y && next.s === cur.s) return s
  const offsets = Array.from({ length: MAX_SLOTS }, (_, j) => (j === i ? next : slotOffset(s, j)))
  return { ...s, mockup: { ...s.mockup, offsets } }
}

/** Images of the slots that are on screen (slot 1 first). */
export const slotMediaIds = (s: Scene): (string | undefined)[] => {
  const n = slotCount(s)
  return Array.from({ length: n }, (_, i) => (i === 0 ? s.mockup.mediaId : s.mockup.extraMediaIds?.[i - 1]))
}
/** Every image a slot holds, including slots hidden by a lower count (they come back when the count goes up). */
export const storedMediaIds = (s: Scene): string[] =>
  [s.mockup.mediaId, ...(s.mockup.extraMediaIds ?? [])].filter((x): x is string => Boolean(x))

export function setSlotMedia(s: Scene, i: number, id: string | undefined): Scene {
  if (i < 0 || i >= MAX_SLOTS) return s
  if (i === 0) return { ...s, mockup: { ...s.mockup, mediaId: id } }
  const extra = Array.from({ length: MAX_SLOTS - 1 }, (_, j) => (j === i - 1 ? id : s.mockup.extraMediaIds?.[j]))
  return { ...s, mockup: { ...s.mockup, extraMediaIds: extra } }
}

export function setCount(s: Scene, n: number): Scene {
  const count = (Math.min(MAX_SLOTS, Math.max(1, Math.round(n))) as 1 | 2 | 3 | 4)
  if (count === slotCount(s)) return s
  return { ...s, mockup: { ...s.mockup, count, arrangement: count === 1 ? undefined : ARRANGEMENTS[count as 2 | 3 | 4].find((a) => a.id === s.mockup.arrangement)?.id ?? ARRANGEMENTS[count as 2 | 3 | 4][0].id } }
}

/** Put images into slots: the first goes into `at`, the rest into the next empty visible slots, in order. */
export function assignSlots(s: Scene, ids: string[], at: number): { scene: Scene; placed: number } {
  const n = slotCount(s)
  let out = s, placed = 0
  const first = Math.min(n - 1, Math.max(0, at))
  const order = [first, ...Array.from({ length: n }, (_, j) => j).filter((j) => j !== first && !slotMediaIds(s)[j])]
  ids.forEach((id, k) => { const slot = order[k]; if (slot === undefined) return; out = setSlotMedia(out, slot, id); placed++ })
  return { scene: out, placed }
}

/** Pan a plain bento cell's crop by dragging: moving the pointer by (dx, dy) canvas pixels moves the picture the same way. */
export function panFocus(iw: number, ih: number, cellW: number, cellH: number, zoom: number, fx: number, fy: number, dx: number, dy: number): { fx: number; fy: number } {
  const scale = Math.max(cellW / iw, cellH / ih) * Math.max(1, zoom / 100)
  const sw = cellW / scale, sh = cellH / scale
  const rx = iw - sw, ry = ih - sh
  const sx = rx * fx - dx / scale, sy = ry * fy - dy / scale
  return { fx: rx > 0.5 ? clamp(sx / rx, 0, 1) : fx, fy: ry > 0.5 ? clamp(sy / ry, 0, 1) : fy }
}
