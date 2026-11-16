import { GRADIENTS, LAYOUT_PRESETS, defaultBento, fitCells, slotMediaIds, type Scene, type StyleId } from './scene'

// Our own starting looks. A template changes the look and the layout, never the user's images.
export interface Template { id: string; label: string; apply: (s: Scene) => Scene }

const grad = (id: string, angle?: number) => { const g = GRADIENTS.find((x) => x.id === id) ?? GRADIENTS[0]; return { from: g.from, to: g.to, angle: angle ?? g.angle } }

function single(s: Scene, o: { preset: string; style: StyleId; bg: Scene['background']; shadow: Scene['mockup']['shadow']; corner?: number; canvas?: Scene['canvas'] }): Scene {
  const lp = LAYOUT_PRESETS.find((p) => p.id === o.preset)!
  return {
    ...s,
    canvas: o.canvas ?? s.canvas,
    background: o.bg,
    mockup: { ...s.mockup, style: o.style, shadow: o.shadow, border: { type: 'curved', radius: o.corner ?? 20 }, layout: { family: lp.family, preset: lp.id, zoom: 100 } },
  }
}

function bentoOf(s: Scene, presetId: string, bg: Scene['background'], gap: number, radius: number, canvas?: Scene['canvas']): Scene {
  const had = s.bento
  const base = had ?? defaultBento(presetId)
  const cells = fitCells(had ? base.cells : base.cells.map((c, i) => (slotMediaIds(s)[i] ? { ...c, mediaId: slotMediaIds(s)[i] } : c)), presetId)
  return { ...s, canvas: canvas ?? s.canvas, background: bg, bento: { presetId, gap, radius, cells }, mockup: { ...s.mockup, shadow: { mode: 'spread', opacity: 35 }, layout: { ...s.mockup.layout, family: 'bento' } } }
}

const solid = (color: string): Scene['background'] => ({ type: 'color', color, gradient: grad('slate') })
const blend = (id: string, angle?: number): Scene['background'] => ({ type: 'gradient', color: '#e5e7eb', gradient: grad(id, angle) })
const size = (w: number, h: number, preset: string) => ({ w, h, preset })

export const TEMPLATES: Template[] = [
  { id: 'dusk-tilt', label: 'Dusk tilt', apply: (s) => single(s, { preset: 'tilt-right', style: 'plain', bg: blend('dusk'), shadow: { mode: 'spread', opacity: 45 }, corner: 24, canvas: size(1920, 1080, 'wide') }) },
  { id: 'studio-light', label: 'Studio light', apply: (s) => single(s, { preset: 'flat', style: 'inset-light', bg: solid('#e5e7eb'), shadow: { mode: 'hug', opacity: 30 }, canvas: size(1920, 1440, 'classic') }) },
  { id: 'night-frost', label: 'Night frost', apply: (s) => single(s, { preset: 'lean', style: 'glass-dark', bg: blend('slate'), shadow: { mode: 'spread', opacity: 55 }, corner: 26 }) },
  { id: 'mint-liquid', label: 'Mint liquid', apply: (s) => single(s, { preset: 'close', style: 'liquid', bg: blend('mint'), shadow: { mode: 'spread', opacity: 35 }, corner: 28 }) },
  { id: 'warm-card', label: 'Warm card', apply: (s) => single(s, { preset: 'tilt-left', style: 'tinted', bg: blend('ember'), shadow: { mode: 'adaptive', opacity: 45 }, canvas: size(1600, 1600, 'square') }) },
  { id: 'clean-poster', label: 'Clean poster', apply: (s) => single(s, { preset: 'flat', style: 'border', bg: solid('#ffffff'), shadow: { mode: 'spread', opacity: 25 }, corner: 16, canvas: size(1440, 1800, 'portrait') }) },
  { id: 'bento-board', label: 'Bento board', apply: (s) => bentoOf(s, 'quad-bento', blend('blush'), 18, 30, size(1920, 1440, 'classic')) },
  { id: 'bento-hero', label: 'Bento hero', apply: (s) => bentoOf(s, 'trio-hero', blend('ocean'), 20, 34, size(1920, 1080, 'wide')) },
]
