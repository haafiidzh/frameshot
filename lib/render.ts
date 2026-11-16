import { LAYOUT_PRESETS, arrangementBoxes, arrangementOf, getBentoPreset, slotCount, slotMediaIds, slotOffset, type LayoutPreset, type Scene, type StyleId } from './scene'
import { getDevice, type Device } from './devices'
import { getMedia } from './media'

// One renderer for preview, thumbnails and export, so what you see is what you download.
// Frame art colours are art assets, not UI colours.
const ART = { bezelDark: '#16181c', bezelLight: '#e8e9ec', barLight: '#f1f2f4', barDark: '#1f2126', placeholder: '#d9dbe0' }

type Ctx = CanvasRenderingContext2D
const rr = (c: Ctx, x: number, y: number, w: number, h: number, r: number) => {
  c.beginPath()
  c.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2)))
}

function drawBackground(c: Ctx, scene: Scene, W: number, H: number) {
  const bg = scene.background
  if (bg.type === 'transparent') return
  if (bg.type === 'color') { c.fillStyle = bg.color; c.fillRect(0, 0, W, H); return }
  if (bg.type === 'image') {
    const img = getMedia(bg.imageId)
    if (img) { cover(c, img, 0, 0, W, H); return }
    c.fillStyle = bg.color; c.fillRect(0, 0, W, H); return
  }
  const a = ((bg.gradient.angle - 90) * Math.PI) / 180
  const dx = Math.cos(a), dy = Math.sin(a)
  const L = (Math.abs(W * dx) + Math.abs(H * dy)) / 2
  const g = c.createLinearGradient(W / 2 - dx * L, H / 2 - dy * L, W / 2 + dx * L, H / 2 + dy * L)
  g.addColorStop(0, bg.gradient.from); g.addColorStop(1, bg.gradient.to)
  c.fillStyle = g; c.fillRect(0, 0, W, H)
}

// Big images are shrunk in halving steps (one big jump with canvas smoothing turns small text to mush),
// and recent results per image are cached so dragging a slider does not redo the work.
const regionCache = new WeakMap<HTMLImageElement, Map<string, HTMLCanvasElement>>()

function scaledRegion(img: HTMLImageElement, sx: number, sy: number, sw: number, sh: number, w: number, h: number): HTMLCanvasElement {
  const dw = Math.max(1, Math.round(w)), dh = Math.max(1, Math.round(h))
  const key = [sx, sy, sw, sh].map((n) => Math.round(n * 10) / 10).join('/') + `>${dw}x${dh}`
  let m = regionCache.get(img)
  if (!m) { m = new Map(); regionCache.set(img, m) }
  const hit = m.get(key)
  if (hit) return hit
  let src: CanvasImageSource = img
  let ox = sx, oy = sy, cw = sw, ch = sh
  while (cw / 2 >= dw && ch / 2 >= dh) {
    const tw = Math.ceil(cw / 2), th = Math.ceil(ch / 2)
    const t = document.createElement('canvas'); t.width = tw; t.height = th
    const tc = t.getContext('2d')!
    tc.imageSmoothingEnabled = true; tc.imageSmoothingQuality = 'high'
    tc.drawImage(src, ox, oy, cw, ch, 0, 0, tw, th)
    src = t; ox = 0; oy = 0; cw = tw; ch = th
  }
  const out = document.createElement('canvas'); out.width = dw; out.height = dh
  const oc = out.getContext('2d')!
  oc.imageSmoothingEnabled = true; oc.imageSmoothingQuality = 'high'
  oc.drawImage(src, ox, oy, cw, ch, 0, 0, dw, dh)
  if (m.size >= 8) m.delete(m.keys().next().value as string)
  m.set(key, out)
  return out
}

/** Source rectangle that fills w x h (cover), optionally zoomed in and focused on (fx, fy). */
function coverRegion(img: HTMLImageElement, w: number, h: number, zoom = 1, fx = 0.5, fy = 0.5) {
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight) * zoom
  const sw = w / s, sh = h / s
  return { sx: (img.naturalWidth - sw) * fx, sy: (img.naturalHeight - sh) * fy, sw, sh }
}

function cover(c: Ctx, img: HTMLImageElement, x: number, y: number, w: number, h: number, zoom = 1, fx = 0.5, fy = 0.5) {
  const r = coverRegion(img, w, h, zoom, fx, fy)
  c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'
  c.drawImage(scaledRegion(img, r.sx, r.sy, r.sw, r.sh, w, h), x, y, w, h)
}

interface Geo { fw: number; fh: number; extra: number; pad: number; bezel: number; outerR: number; bar: number; light: boolean }

function geometry(scene: Scene, device: Device, mediaAspect: number | undefined, W: number, H: number, fill = 0.74): Geo {
  const style = scene.mockup.style
  const light = style === 'glass-light' || style === 'inset-light' || style === 'border' || style === 'liquid' || style === 'tinted' || style === 'double'
  const bt = scene.mockup.border
  const factor = bt.type === 'sharp' ? 0.15 : bt.type === 'round' ? 1.25 : 0.4 + bt.radius / 33
  const unit = (fw: number) => {
    const screenAspect = device.adapts && mediaAspect ? mediaAspect : device.aspect
    const bar = device.chrome === 'browser' ? fw * 0.05 : 0
    const fh = device.chrome === 'browser' ? fw / screenAspect + bar : fw / device.aspect
    const extra = device.chrome === 'base' ? fh * 0.05 : device.chrome === 'stand' ? fh * 0.16 : 0
    return { fh: device.adapts && device.chrome !== 'browser' && mediaAspect ? fw / mediaAspect : fh, extra, bar }
  }
  const u1 = unit(1)
  const padK = style === 'inset-light' || style === 'inset-dark' || style === 'double' ? 0.03 : style === 'glass-light' || style === 'glass-dark' || style === 'tinted' ? 0.02 : style === 'liquid' ? 0.026 : style === 'border' ? 0.012 : style === 'outline' ? 0.004 : 0
  const fw = Math.min((W * fill) / (1 + 2 * padK), (H * fill) / (u1.fh + u1.extra + 2 * padK))
  const u = unit(fw)
  const short = Math.min(fw, u.fh)
  let outerR = device.bezel > 0 || device.chrome === 'browser' ? device.corner * short * factor : (device.corner * short * factor * (bt.type === 'curved' ? bt.radius / 20 : 1)) || 0
  if (device.adapts && device.chrome !== 'browser') outerR = bt.type === 'sharp' ? 0 : bt.type === 'round' ? short * 0.12 : bt.radius * (W / 1920) * 1.2
  return { fw, fh: u.fh, extra: u.extra, pad: padK * fw, bezel: device.bezel * short, outerR, bar: u.bar, light }
}

function drawLayer(scene: Scene, device: Device, g: Geo, W: number): HTMLCanvasElement {
  const img = getMedia(scene.mockup.mediaId)
  const style: StyleId = scene.mockup.style
  const lw = Math.ceil(g.fw + 2 * g.pad), lh = Math.ceil(g.fh + g.extra + 2 * g.pad)
  const layer = document.createElement('canvas')
  layer.width = lw; layer.height = lh
  const c = layer.getContext('2d')!
  const p = g.pad
  // ring / plate
  if (p > 0 && style !== 'outline') {
    rr(c, 0, 0, lw, g.fh + 2 * p, g.outerR + p)
    if (style === 'liquid') {
      // Frosted plate with a diagonal sheen, brighter at the top left like light across glass.
      const sheen = c.createLinearGradient(0, 0, lw, lh)
      sheen.addColorStop(0, 'rgba(255,255,255,0.7)'); sheen.addColorStop(0.45, 'rgba(255,255,255,0.28)'); sheen.addColorStop(1, 'rgba(255,255,255,0.46)')
      c.fillStyle = sheen
    } else c.fillStyle = style === 'glass-light' ? 'rgba(255,255,255,0.42)' : style === 'glass-dark' ? 'rgba(12,14,18,0.5)' : style === 'tinted' ? 'rgba(255,196,120,0.5)' : style === 'inset-light' ? '#f3f4f6' : style === 'inset-dark' ? '#101216' : '#ffffff'
    c.fill()
    if (style.startsWith('glass') || style === 'liquid' || style === 'tinted') { c.lineWidth = Math.max(1, W / 1920 * 2); c.strokeStyle = style === 'glass-dark' ? 'rgba(255,255,255,0.2)' : style === 'tinted' ? 'rgba(255,232,190,0.9)' : 'rgba(255,255,255,0.85)'; c.stroke() }
    if (style === 'double') { c.lineWidth = Math.max(1, W / 1920 * 2); c.strokeStyle = 'rgba(120,124,134,0.55)'; rr(c, p * 0.45, p * 0.45, lw - p * 0.9, g.fh + 2 * p - p * 0.9, g.outerR + p * 0.55); c.stroke() }
  }
  // base / stand under the frame
  if (device.chrome === 'base') {
    c.fillStyle = g.light ? '#cfd2d8' : '#2a2d33'
    c.beginPath(); c.roundRect(p - g.fw * 0.04, p + g.fh, g.fw * 1.08, g.extra, [0, 0, g.extra, g.extra]); c.fill()
  }
  if (device.chrome === 'stand') {
    c.fillStyle = g.light ? '#cfd2d8' : '#2a2d33'
    c.fillRect(p + g.fw * 0.44, p + g.fh, g.fw * 0.12, g.extra * 0.75)
    c.beginPath(); c.roundRect(p + g.fw * 0.32, p + g.fh + g.extra * 0.75, g.fw * 0.36, g.extra * 0.25, 4); c.fill()
  }
  if (device.chrome === 'crown') {
    c.fillStyle = g.light ? '#cfd2d8' : '#2a2d33'
    c.beginPath(); c.roundRect(p + g.fw - 2, p + g.fh * 0.3, g.fw * 0.035, g.fh * 0.16, 6); c.fill()
  }
  // body
  const hardware = device.bezel > 0
  if (hardware) { rr(c, p, p, g.fw, g.fh, g.outerR); c.fillStyle = g.light ? ART.bezelLight : ART.bezelDark; c.fill() }
  const sx = p + g.bezel, sy = p + g.bezel + g.bar
  const sw = g.fw - 2 * g.bezel, sh = g.fh - 2 * g.bezel - g.bar
  const screenR = hardware ? Math.max(2, g.outerR - g.bezel) : g.outerR
  c.save()
  if (device.chrome === 'browser') { rr(c, p, p, g.fw, g.fh, g.outerR); c.clip() } else { rr(c, sx, sy, sw, sh, screenR); c.clip() }
  if (device.chrome === 'browser') {
    c.fillStyle = g.light ? ART.barLight : ART.barDark; c.fillRect(p, p, g.fw, g.bar)
    const dot = g.bar * 0.14
    ;['#ef6a5e', '#f5bf4f', '#61c554'].forEach((col, i) => { c.fillStyle = col; c.beginPath(); c.arc(p + g.bar * 0.55 + i * dot * 2.6, p + g.bar / 2, dot, 0, 7); c.fill() })
    c.fillStyle = g.light ? '#ffffff' : '#2d3036'; rr(c, p + g.fw * 0.28, p + g.bar * 0.22, g.fw * 0.44, g.bar * 0.56, g.bar * 0.28); c.fill()
  }
  if (img) cover(c, img, sx, sy, sw, sh)
  else {
    c.fillStyle = ART.placeholder; c.fillRect(sx, sy, sw, sh)
  }
  const glare = scene.mockup.light ?? 0
  if (glare > 0) {
    // Soft diagonal light across the screen, like a window reflected in glass.
    const gl = c.createLinearGradient(sx, sy, sx + sw, sy + sh)
    gl.addColorStop(0, `rgba(255,255,255,${(glare / 100) * 0.55})`); gl.addColorStop(0.55, 'rgba(255,255,255,0)')
    c.fillStyle = gl; c.fillRect(sx, sy, sw, sh)
  }
  c.restore()
  // camera cut-outs
  c.fillStyle = ART.bezelDark
  if (device.chrome === 'island') { rr(c, p + g.fw / 2 - g.fw * 0.14, sy + sh * 0.012, g.fw * 0.28, g.fw * 0.075, g.fw * 0.04); c.fill() }
  if (device.chrome === 'notch') { c.beginPath(); c.roundRect(p + g.fw / 2 - g.fw * 0.2, sy - 1, g.fw * 0.4, g.fw * 0.07, [0, 0, g.fw * 0.04, g.fw * 0.04]); c.fill() }
  if (device.chrome === 'punch') { c.beginPath(); c.arc(p + g.fw / 2, sy + g.fw * 0.045, g.fw * 0.022, 0, 7); c.fill() }
  if (style === 'outline') {
    rr(c, p, p, g.fw, g.fh, g.outerR); c.lineWidth = Math.max(2, W / 1920 * 3); c.strokeStyle = 'rgba(255,255,255,0.95)'; c.stroke()
  }
  return layer
}

export interface RenderOpts {
  /** draw hints for empty bento cells (preview only; exports leave them out) */
  placeholders?: boolean
  /** bento cell to outline in the preview */
  selectedCell?: number
  /** Zoom/Tilt slot to outline in the preview (never drawn in exports) */
  selectedSlot?: number
}

/** With the frame hidden the image is drawn alone: the plain screenshot device and no plate. */
const frameScene = (scene: Scene): Scene => (scene.mockup.hideFrame ? { ...scene, mockup: { ...scene.mockup, deviceSlug: 'screenshot', style: 'plain' } } : scene)

function drawShapes(c: Ctx, scene: Scene, W: number, H: number) {
  const kind = scene.shapes ?? 'none'
  if (kind === 'none') return
  const m = Math.min(W, H), k = W / 1920
  c.save()
  if (kind === 'orbs') {
    const orb = (x: number, y: number, r: number, color: string) => { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, color); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill() }
    orb(W * 0.16, H * 0.2, m * 0.42, 'rgba(255,255,255,0.34)')
    orb(W * 0.86, H * 0.82, m * 0.5, 'rgba(0,0,0,0.26)')
    orb(W * 0.78, H * 0.14, m * 0.26, 'rgba(255,255,255,0.22)')
  } else {
    c.lineWidth = Math.max(1.5, 2.5 * k)
    for (let i = 1; i <= 6; i++) { c.strokeStyle = `rgba(255,255,255,${0.42 - i * 0.055})`; c.beginPath(); c.arc(W * 0.84, H * 0.2, m * 0.1 * i, 0, 7); c.stroke() }
    for (let i = 1; i <= 4; i++) { c.strokeStyle = `rgba(255,255,255,${0.3 - i * 0.05})`; c.beginPath(); c.arc(W * 0.1, H * 0.86, m * 0.09 * i, 0, 7); c.stroke() }
  }
  c.restore()
}

// A fixed noise tile (seeded) so the grain in the preview and in the export is the same.
let noiseTile: HTMLCanvasElement | null = null
function grainTile(): HTMLCanvasElement {
  if (noiseTile) return noiseTile
  const t = document.createElement('canvas'); t.width = 256; t.height = 256
  const x = t.getContext('2d')!; const img = x.createImageData(256, 256)
  let seed = 1234567
  // White and black specks of random strength, so the grain only ever lightens or darkens what is already painted.
  for (let i = 0; i < img.data.length; i += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0
    const v = seed >>> 24
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v >= 128 ? 255 : 0
    img.data[i + 3] = Math.round((Math.abs(v - 128) / 128) * 255 * 0.55)
  }
  x.putImageData(img, 0, 0); noiseTile = t; return t
}

function drawEffects(c: Ctx, scene: Scene, W: number, H: number) {
  const fx = scene.effects
  if (fx && fx.vignette > 0) {
    const g = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) * 0.55)
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${(fx.vignette / 100) * 0.6})`)
    c.save(); c.globalCompositeOperation = 'source-atop'; c.fillStyle = g; c.fillRect(0, 0, W, H); c.restore()
  }
  if (fx && fx.grain > 0) {
    const pat = c.createPattern(grainTile(), 'repeat')
    if (pat) {
      pat.setTransform(new DOMMatrix().scale(Math.max(0.5, W / 1920)))
      c.save(); c.globalCompositeOperation = 'source-atop'; c.globalAlpha = Math.min(1, fx.grain / 100); c.fillStyle = pat; c.fillRect(0, 0, W, H); c.restore()
    }
  }
}

function drawWatermark(c: Ctx, scene: Scene, W: number, H: number) {
  const wm = scene.watermark
  const text = wm?.text.trim().slice(0, 40)
  if (!wm || !text) return
  const k = W / 1920, size = Math.max(12, 30 * k), margin = Math.max(10, 0.03 * W)
  c.save()
  c.font = `600 ${size}px Inter, system-ui, sans-serif`; c.textBaseline = 'bottom'
  c.textAlign = wm.position === 'left' ? 'left' : wm.position === 'right' ? 'right' : 'center'
  const x = wm.position === 'left' ? margin : wm.position === 'right' ? W - margin : W / 2
  c.globalAlpha = Math.max(0.05, Math.min(1, wm.opacity / 100))
  c.shadowColor = 'rgba(0,0,0,0.45)'; c.shadowBlur = size * 0.35
  c.fillStyle = '#ffffff'; c.fillText(text, x, H - margin * 0.8)
  c.restore()
}

export function renderScene(canvas: HTMLCanvasElement, scene: Scene, scale = 1, opts: RenderOpts = {}) {
  const W = Math.max(1, Math.round(scene.canvas.w * scale)), H = Math.max(1, Math.round(scene.canvas.h * scale))
  canvas.width = W; canvas.height = H
  const c = canvas.getContext('2d')!
  c.clearRect(0, 0, W, H)
  drawBackground(c, scene, W, H)
  drawShapes(c, scene, W, H)
  const fs = frameScene(scene)
  const device = getDevice(fs.mockup.deviceSlug)
  const finish = () => { drawEffects(c, scene, W, H); drawWatermark(c, scene, W, H) }
  if (scene.mockup.layout.family === 'bento' && scene.bento) { composite(c, drawBento(fs, W, H, opts), scene, 0, W, H); finish(); return }
  const preset = LAYOUT_PRESETS.find((p) => p.id === scene.mockup.layout.preset) ?? LAYOUT_PRESETS[0]
  const plan = slotPlan(fs, W, H)
  const tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H
  const t = tmp.getContext('2d')!
  t.imageSmoothingEnabled = true; t.imageSmoothingQuality = 'high'
  for (const sp of plan) {
    // One image keeps the original behaviour (an empty frame is drawn). With several, empty slots are preview hints only.
    if (plan.length > 1 && !sp.mediaId && opts.placeholders === false) continue
    drawSlot(t, fs, device, sp, preset, W, plan.length > 1 && !sp.mediaId)
  }
  composite(c, tmp, scene, preset.rotY, W, H)
  finish()
  if (opts.selectedSlot !== undefined) {
    const r = slotRects(fs, W, H)[opts.selectedSlot]
    if (r) drawRing(c, r.x, r.y, r.w, r.h, 14 * (W / 1920), W / 1920)
  }
}

/** Preview-only selection marker: a white ring with a soft glow, never a black line. */
function drawRing(c: Ctx, x: number, y: number, w: number, h: number, radius: number, k: number) {
  c.save()
  c.shadowColor = 'rgba(0,0,0,0.35)'; c.shadowBlur = 10 * k
  c.lineWidth = Math.max(3, 4 * k); c.strokeStyle = '#ffffff'
  rr(c, x, y, w, h, radius); c.stroke()
  c.restore()
}

// ---- Several images in Zoom and Tilt: one plan shared by drawing and by click hit-testing ----
interface SlotPlan { i: number; mediaId?: string; ax: number; ay: number; bw: number; bh: number; fill: number; zi: number }

function slotPlan(scene: Scene, W: number, H: number): SlotPlan[] {
  const n = slotCount(scene)
  const preset = LAYOUT_PRESETS.find((p) => p.id === scene.mockup.layout.preset) ?? LAYOUT_PRESETS[0]
  const z = (scene.mockup.layout.zoom / 100) * (preset.zoom / 100)
  const ids = slotMediaIds(scene)
  return arrangementBoxes(n, arrangementOf(scene)).map((b, i) => {
    const o = slotOffset(scene, i)
    return { i, mediaId: ids[i], ax: b.cx * W + o.x * W + preset.shiftX * W * z, ay: b.cy * H + o.y * H + preset.shiftY * H * z, bw: b.w * W, bh: b.h * H, fill: n === 1 ? 0.74 : 0.94, zi: z * o.s }
  })
}

/** Axis-aligned extents of a layer of lw x lh after the preset's perspective and rotation, relative to its anchor. */
function projectedExtents(lw: number, lh: number, preset: LayoutPreset) {
  const pts: [number, number][] = []
  if (preset.rotY === 0) pts.push([-lw / 2, -lh / 2], [lw / 2, -lh / 2], [lw / 2, lh / 2], [-lw / 2, lh / 2])
  else {
    const a = (preset.rotY * Math.PI) / 180, d = lw * 2.6, ca = Math.cos(a), sa = Math.sin(a)
    for (const u of [-lw / 2, lw / 2]) { const s = d / (d - u * sa); pts.push([u * ca * s, (-lh * s) / 2], [u * ca * s, (lh * s) / 2]) }
  }
  const r = (preset.rotZ * Math.PI) / 180, cz = Math.cos(r), sz = Math.sin(r)
  const xs = pts.map(([x, y]) => x * cz - y * sz), ys = pts.map(([x, y]) => x * sz + y * cz)
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }
}

function drawSlot(t: Ctx, fs: Scene, device: Device, sp: SlotPlan, preset: LayoutPreset, W: number, ghost: boolean) {
  const media = getMedia(sp.mediaId)
  const aspect = media ? media.naturalWidth / media.naturalHeight : undefined
  const cellScene: Scene = { ...fs, mockup: { ...fs.mockup, mediaId: sp.mediaId } }
  // Supersample the device layer by the zoom so zooming in shows real pixels, not an enlarged bitmap.
  // Capped so the layer stays under 8192px on its longest side and at 4x.
  const probe = geometry(cellScene, device, aspect, sp.bw, sp.bh, sp.fill)
  const base = Math.max(probe.fw + 2 * probe.pad, probe.fh + probe.extra + 2 * probe.pad, 1)
  const ss = Math.max(1, Math.min(sp.zi, 4, 8192 / base))
  const geo = geometry(cellScene, device, aspect, sp.bw * ss, sp.bh * ss, sp.fill)
  const layer = drawLayer(cellScene, device, geo, W * ss)
  t.save()
  if (ghost) t.globalAlpha = 0.5
  t.translate(sp.ax, sp.ay)
  t.rotate((preset.rotZ * Math.PI) / 180)
  const k = sp.zi / ss // layer pixels -> canvas pixels
  t.scale(k, k)
  const lw = layer.width, lh = layer.height
  if (preset.rotY === 0) t.drawImage(layer, -lw / 2, -lh / 2)
  else {
    // Perspective by vertical slices. One slice per destination pixel (not per source pixel) keeps it fast and sharp.
    const a = (preset.rotY * Math.PI) / 180, d = lw * 2.6, ca = Math.cos(a), sa = Math.sin(a)
    const step = Math.max(1, Math.round(1 / k))
    const overlap = 0.75 / k
    for (let i = 0; i < lw; i += step) {
      const sw = Math.min(step, lw - i)
      const u = i + sw / 2 - lw / 2
      const s = d / (d - u * sa)
      t.drawImage(layer, i, 0, sw, lh, (u - sw / 2) * ca * s, (-lh * s) / 2, sw * ca * s + overlap, lh * s)
    }
  }
  t.restore()
  if (ghost) {
    const r = Math.min(sp.bw, sp.bh) * 0.06 * sp.zi
    t.save(); t.strokeStyle = 'rgba(17,17,17,0.6)'; t.lineWidth = Math.max(2, 3 * (W / 1920)); t.lineCap = 'round'
    t.beginPath(); t.moveTo(sp.ax - r, sp.ay); t.lineTo(sp.ax + r, sp.ay); t.moveTo(sp.ax, sp.ay - r); t.lineTo(sp.ax, sp.ay + r); t.stroke(); t.restore()
  }
}

/** On-canvas rectangles of the images (their projected outline), in the same order as the slots. Used to click and drag them. */
export function slotRects(scene: Scene, W: number, H: number): Rect[] {
  const fs = frameScene(scene)
  const device = getDevice(fs.mockup.deviceSlug)
  const preset = LAYOUT_PRESETS.find((p) => p.id === fs.mockup.layout.preset) ?? LAYOUT_PRESETS[0]
  return slotPlan(fs, W, H).map((sp) => {
    const media = getMedia(sp.mediaId)
    const cellScene: Scene = { ...fs, mockup: { ...fs.mockup, mediaId: sp.mediaId } }
    const g = geometry(cellScene, device, media ? media.naturalWidth / media.naturalHeight : undefined, sp.bw, sp.bh, sp.fill)
    const e = projectedExtents(Math.ceil(g.fw + 2 * g.pad), Math.ceil(g.fh + g.extra + 2 * g.pad), preset)
    return { x: sp.ax + e.x0 * sp.zi, y: sp.ay + e.y0 * sp.zi, w: (e.x1 - e.x0) * sp.zi, h: (e.y1 - e.y0) * sp.zi }
  })
}

// Shadow is applied once to the whole arrangement (a single mockup or the full bento grid).
function composite(c: Ctx, tmp: HTMLCanvasElement, scene: Scene, rotY: number, W: number, H: number) {
  const op = scene.mockup.shadow.opacity / 100
  const mode = scene.mockup.shadow.mode
  if (mode === 'none' || op <= 0) { c.drawImage(tmp, 0, 0); return }
  c.save()
  c.shadowColor = `rgba(0,0,0,${Math.min(1, op * 0.9)})`
  if (mode === 'spread') { c.shadowBlur = Math.min(W, H) * 0.07; c.shadowOffsetY = H * 0.03 }
  else if (mode === 'hug') { c.shadowBlur = Math.min(W, H) * 0.014; c.shadowOffsetY = H * 0.007 }
  else { c.shadowBlur = Math.min(W, H) * 0.05; c.shadowOffsetX = -Math.sin((rotY * Math.PI) / 180) * H * 0.05; c.shadowOffsetY = H * 0.028 }
  c.drawImage(tmp, 0, 0)
  c.restore()
}

export interface Rect { x: number; y: number; w: number; h: number }

/** Pixel rectangles of the bento cells for a canvas of W x H. Shared by drawing and by click hit-testing. */
export function bentoRects(scene: Scene, W: number, H: number): Rect[] {
  if (!scene.bento) return []
  const k = W / 1920
  const margin = Math.min(W, H) * 0.05
  const gap = scene.bento.gap * k
  const ux = (W - 2 * margin) / 12, uy = (H - 2 * margin) / 12
  return getBentoPreset(scene.bento.presetId).rects.map(([col, row, cw, rh]) => ({
    x: margin + col * ux + gap / 2, y: margin + row * uy + gap / 2, w: Math.max(2, cw * ux - gap), h: Math.max(2, rh * uy - gap),
  }))
}

function drawBento(scene: Scene, W: number, H: number, opts: RenderOpts): HTMLCanvasElement {
  const tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H
  const t = tmp.getContext('2d')!
  t.imageSmoothingEnabled = true; t.imageSmoothingQuality = 'high'
  const b = scene.bento!
  const k = W / 1920
  const radius = b.radius * k
  const device = getDevice(scene.mockup.deviceSlug)
  const rects = bentoRects(scene, W, H)
  rects.forEach((r, i) => {
    const cell = b.cells[i]
    const img = getMedia(cell?.mediaId)
    if (!cell || !img) {
      if (opts.placeholders !== false) {
        rr(t, r.x, r.y, r.w, r.h, radius); t.fillStyle = 'rgba(255,255,255,0.35)'; t.fill()
        const s = Math.min(r.w, r.h) * 0.12
        t.strokeStyle = 'rgba(17,17,17,0.55)'; t.lineWidth = Math.max(2, 3 * k); t.lineCap = 'round'
        t.beginPath(); t.moveTo(r.x + r.w / 2 - s, r.y + r.h / 2); t.lineTo(r.x + r.w / 2 + s, r.y + r.h / 2); t.moveTo(r.x + r.w / 2, r.y + r.h / 2 - s); t.lineTo(r.x + r.w / 2, r.y + r.h / 2 + s); t.stroke()
      }
      return
    }
    if (cell.framed) {
      // Same frame drawing as a single mockup, fitted inside the cell.
      const cw = Math.max(2, Math.round(r.w)), ch = Math.max(2, Math.round(r.h))
      const cellScene: Scene = { ...scene, canvas: { w: cw, h: ch, preset: 'cell' }, mockup: { ...scene.mockup, mediaId: cell.mediaId } }
      const geo = geometry(cellScene, device, img.naturalWidth / img.naturalHeight, cw, ch, 0.92)
      const layer = drawLayer(cellScene, device, geo, cw)
      t.drawImage(layer, r.x + r.w / 2 - layer.width / 2, r.y + r.h / 2 - layer.height / 2)
    } else {
      t.save()
      rr(t, r.x, r.y, r.w, r.h, radius); t.clip()
      if (cell.fit === 'fit') {
        const s = Math.min(r.w / img.naturalWidth, r.h / img.naturalHeight)
        const dw = img.naturalWidth * s, dh = img.naturalHeight * s
        const reg = scaledRegion(img, 0, 0, img.naturalWidth, img.naturalHeight, dw, dh)
        t.drawImage(reg, r.x + (r.w - dw) / 2, r.y + (r.h - dh) / 2, dw, dh)
      } else cover(t, img, r.x, r.y, r.w, r.h, Math.max(1, cell.zoom / 100), cell.fx, cell.fy)
      t.restore()
    }
  })
  if (opts.selectedCell !== undefined && rects[opts.selectedCell]) {
    // Preview-only marker: a white ring with a soft glow, never a black line.
    const r = rects[opts.selectedCell]
    t.save()
    t.shadowColor = 'rgba(0,0,0,0.35)'; t.shadowBlur = 10 * k
    t.lineWidth = Math.max(3, 4 * k); t.strokeStyle = '#ffffff'
    rr(t, r.x, r.y, r.w, r.h, radius); t.stroke()
    t.restore()
  }
  return tmp
}
