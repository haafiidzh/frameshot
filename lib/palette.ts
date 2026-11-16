// Magic background: two colours picked from the user's own image. Deterministic, so exports repeat.
const hex = (n: number) => n.toString(16).padStart(2, '0')
const toHex = (r: number, g: number, b: number) => `#${hex(r)}${hex(g)}${hex(b)}`
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

/** Shift a colour toward black (amount < 0) or white (amount > 0). */
const shade = (c: number[], amount: number) => c.map((v) => Math.round(amount < 0 ? v * (1 + amount) : v + (255 - v) * amount))

export function paletteFromPixels(data: Uint8ClampedArray | number[]): { from: string; to: string } {
  const buckets = new Map<number, { w: number; r: number; g: number; b: number }>()
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 200) continue
    const r = data[i], g = data[i + 1], b = data[i + 2]
    const sat = (Math.max(r, g, b) - Math.min(r, g, b)) / 255
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
    // Colourful, mid-tone pixels make better backdrops than flat white or black.
    const weight = 1 + sat * 3 - Math.abs(lum - 0.5) * 0.8
    const key = (r >> 4) * 256 + (g >> 4) * 16 + (b >> 4)
    const e = buckets.get(key) ?? { w: 0, r: 0, g: 0, b: 0 }
    e.w += Math.max(0.05, weight); e.r += r * weight; e.g += g * weight; e.b += b * weight
    buckets.set(key, e)
  }
  const ranked = [...buckets.values()].map((e) => ({ w: e.w, c: [Math.round(e.r / e.w), Math.round(e.g / e.w), Math.round(e.b / e.w)] })).sort((a, b) => b.w - a.w || a.c[0] - b.c[0])
  if (ranked.length === 0) return { from: '#64748b', to: '#0f172a' }
  const first = ranked[0].c
  const second = ranked.find((e) => dist(e.c, first) > 90)?.c ?? shade(first, -0.5)
  return { from: toHex(first[0], first[1], first[2]), to: toHex(second[0], second[1], second[2]) }
}

export function paletteFromImage(img: HTMLImageElement): { from: string; to: string } {
  const c = document.createElement('canvas'); c.width = 32; c.height = 32
  const x = c.getContext('2d', { willReadFrequently: true })!
  x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, 32, 32)
  return paletteFromPixels(x.getImageData(0, 0, 32, 32).data)
}

export interface ImageStats { from: string; to: string; luminance: number; aspect: number }

export function statsFromPixels(data: Uint8ClampedArray | number[], aspect: number): ImageStats {
  const { from, to } = paletteFromPixels(data)
  let sum = 0, n = 0
  for (let i = 0; i < data.length; i += 4) { if (data[i + 3] < 200) continue; sum += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255; n++ }
  return { from, to, luminance: n ? sum / n : 0.5, aspect }
}

export interface MagicPreset { gradient: { from: string; to: string; angle: number }; style: 'glass-light' | 'liquid' | 'plain'; shadow: { mode: 'spread' | 'hug'; opacity: number }; layoutPreset: 'flat' | 'tilt-right' }

/** One-click look chosen from the image: the backdrop from its colours, the frame and layout from its brightness and shape. */
export function magicPresetFromStats(st: ImageStats): MagicPreset {
  const style = st.luminance < 0.38 ? 'glass-light' : st.luminance > 0.7 ? 'plain' : 'liquid'
  return {
    gradient: { from: st.from, to: st.to, angle: 135 },
    style,
    shadow: { mode: 'spread', opacity: st.luminance < 0.38 ? 55 : 40 },
    layoutPreset: st.aspect >= 1.25 ? 'tilt-right' : 'flat',
  }
}

export function magicPresetFromImage(img: HTMLImageElement): MagicPreset {
  const c = document.createElement('canvas'); c.width = 32; c.height = 32
  const x = c.getContext('2d', { willReadFrequently: true })!
  x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, 32, 32)
  return magicPresetFromStats(statsFromPixels(x.getImageData(0, 0, 32, 32).data, img.naturalWidth / img.naturalHeight))
}
