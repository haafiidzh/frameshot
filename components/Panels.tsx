'use client'
import { useRef, useState } from 'react'
import { ChevronDown, ImagePlus, Square, SquareRoundCorner, Circle, X } from 'lucide-react'
import { MAX_LIBRARY, type LibraryItem } from '@/lib/media'
import { DEVICES, DEVICE_FILTERS, getDevice, type DeviceType } from '@/lib/devices'
import { ARRANGEMENTS, BENTO_PRESETS, CANVAS_PRESETS, MAX_SLOTS, arrangementBoxes, arrangementOf, isDefaultOffset, setCount, setSlotMedia, setSlotOffset, slotCount, slotMediaIds, slotOffset, CUSTOM_MAX, CUSTOM_MIN, GRADIENTS, clampSide, LAYOUT_PRESETS, SOLID_COLORS, fitCells, switchFamily, WATERMARK_MAX, type BackgroundType, type BentoCell, type CornerType, type LayoutFamily, type Scene, type ShadowMode, type ShapeStyle, type StyleId, type WatermarkPos } from '@/lib/scene'
import { getMedia } from '@/lib/media'
import { magicPresetFromImage, paletteFromImage } from '@/lib/palette'
import { Popover, SectionLabel, Segmented, Slider, Switch, TileGrid, cx } from './ui'
import ThumbCanvas from './ThumbCanvas'

type Update = (fn: (s: Scene) => Scene, key?: string) => void

const STYLES: { id: StyleId; label: string }[] = [
  { id: 'plain', label: 'Plain' }, { id: 'glass-light', label: 'Frost light' }, { id: 'glass-dark', label: 'Frost dark' },
  { id: 'inset-light', label: 'Matte light' }, { id: 'inset-dark', label: 'Matte dark' }, { id: 'outline', label: 'Outline' }, { id: 'border', label: 'Frame' },
  { id: 'liquid', label: 'Liquid' }, { id: 'tinted', label: 'Warm' }, { id: 'double', label: 'Double' },
]
const STYLES_SHOWN = 6
const SHADOWS: { id: ShadowMode; label: string; hint: string }[] = [
  { id: 'none', label: 'Off', hint: 'No shadow' }, { id: 'spread', label: 'Wide', hint: 'Soft and wide' },
  { id: 'hug', label: 'Tight', hint: 'Close to the edge' }, { id: 'adaptive', label: 'Follow', hint: 'Follows the tilt' },
]

const thumbScene = (s: Scene, patch: Partial<Scene['mockup']>, transparent = true): Scene => ({
  ...s, canvas: { w: 400, h: 300, preset: 'thumb' },
  background: transparent ? { ...s.background, type: 'transparent' } : s.background,
  mockup: { ...s.mockup, count: 1, offsets: undefined, shadow: { mode: 'hug', opacity: 30 }, layout: { family: 'zoom', preset: 'flat', zoom: 100 }, ...patch },
})

export function DevicePicker({ scene, update }: { scene: Scene; update: Update }) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState<'all' | DeviceType>('all')
  const btn = useRef<HTMLButtonElement>(null)
  const cur = getDevice(scene.mockup.deviceSlug)
  const list = DEVICES.filter((d) => filter === 'all' || d.type === filter || (filter === 'laptop' && d.type === 'laptop'))
  const sections = Array.from(new Set(list.map((d) => d.section)))
  return (
    <div className="relative">
      <button ref={btn} type="button" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 rounded-md bg-surface-raised p-2 text-left shadow-card">
        <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-surface-sunken"><ThumbCanvas scene={thumbScene(scene, { deviceSlug: cur.slug })} width={28} /></span>
        <span className="min-w-0 flex-1"><span className="block truncate text-base font-semibold">{cur.name}</span><span className="block truncate text-sm text-muted">{cur.adapts ? 'Fits your image' : 'Fixed shape'}</span></span>
        <ChevronDown aria-hidden size={16} className={cx('text-muted transition-transform duration-fast', open && 'rotate-180')} />
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchor={btn} label="Choose a device" width={420}>
        <div role="group" aria-label="Device type" className="mb-3 flex flex-wrap gap-2">
          {DEVICE_FILTERS.map((f) => (
            <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)} className={cx('h-8 rounded-pill px-3 text-sm font-semibold', filter === f.id ? 'bg-accent text-on-accent' : 'bg-surface-sunken text-text')}>{f.label}</button>
          ))}
        </div>
        {list.length === 0 && <p className="py-6 text-center text-sm text-muted">Nothing in this group yet.</p>}
        {sections.map((sec) => (
          <section key={sec} aria-label={sec} className="mb-3">
            <h4 className="mb-2 text-sm font-semibold text-muted">{sec}</h4>
            <div className="grid grid-cols-3 gap-2">
              {list.filter((d) => d.section === sec).map((d) => (
                <button key={d.slug} type="button" aria-pressed={scene.mockup.deviceSlug === d.slug} onClick={() => { update((s) => ({ ...s, mockup: { ...s.mockup, deviceSlug: d.slug } })); setOpen(false); btn.current?.focus() }}
                  className={cx('relative flex flex-col items-center gap-1 rounded-md bg-surface p-2', scene.mockup.deviceSlug === d.slug && 'is-selected')}>
                  <span className="flex h-20 w-full items-center justify-center"><ThumbCanvas scene={thumbScene(scene, { deviceSlug: d.slug, mediaId: undefined })} width={96} /></span>
                  <span className="text-sm font-semibold">{d.name}</span>
                  {d.isNew && <span className="absolute right-1 top-1 rounded-pill bg-accent px-2 text-xs font-semibold text-on-accent">New</span>}
                </button>
              ))}
            </div>
          </section>
        ))}
      </Popover>
    </div>
  )
}

type LibraryProps = { library: LibraryItem[]; usedIds: Set<string>; onUseMedia: (id: string) => void; onUseBackground: (id: string) => void; onRemoveMedia: (id: string) => void }

/** The session library: images already added, reusable in any layout without uploading again. */
function LibraryGrid({ library, usedIds, onUse, onRemove, actionLabel }: { library: LibraryItem[]; usedIds: Set<string>; onUse: (id: string) => void; onRemove: (id: string) => void; actionLabel: string }) {
  return (
    <>
      <SectionLabel>{`Library (${library.length} of ${MAX_LIBRARY})`}</SectionLabel>
      {library.length === 0 ? (
        <p className="rounded-md bg-surface-sunken p-3 text-xs text-muted">Images you add stay here for this visit, so you can reuse them in any layout without uploading again. They are cleared when you refresh the page.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-tile" aria-label="Your images">
          {library.map((it) => {
            const used = usedIds.has(it.id)
            return (
              <li key={it.id} className="group relative">
                <button type="button" draggable onDragStart={(e) => { e.dataTransfer.setData('application/x-library-id', it.id); e.dataTransfer.effectAllowed = 'copy' }} onClick={() => onUse(it.id)} title={`${it.name} (${it.w} × ${it.h})`} aria-label={`${actionLabel}: ${it.name}${used ? ', in use' : ''}`}
                  className={cx('flex h-16 w-full items-center justify-center overflow-hidden rounded-md bg-surface-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring', used && 'is-selected')}>
                  <span aria-hidden className="block h-full w-full bg-contain bg-center bg-no-repeat" style={{ backgroundImage: `url(${it.thumb})` }} />
                </button>
                {used
                  ? <span aria-hidden className="pointer-events-none absolute bottom-1 left-1 rounded-pill bg-accent px-1.5 text-micro font-semibold text-on-accent">In use</span>
                  : <button type="button" onClick={() => onRemove(it.id)} aria-label={`Remove ${it.name} from the library`} className="absolute right-1 top-1 hidden h-6 w-6 items-center justify-center rounded-pill bg-surface-raised shadow-card focus-visible:flex group-hover:flex group-focus-within:flex"><X size={12} aria-hidden /></button>}
              </li>
            )
          })}
        </ul>
      )}
      <p className="mt-2 text-xs text-muted">Click an image to use it, or drag it onto the preview.</p>
    </>
  )
}

function CustomSize({ scene, update }: { scene: Scene; update: Update }) {
  const [w, setW] = useState(String(scene.canvas.w)), [h, setH] = useState(String(scene.canvas.h))
  const [seen, setSeen] = useState(`${scene.canvas.w}x${scene.canvas.h}`)
  const now = `${scene.canvas.w}x${scene.canvas.h}`
  if (seen !== now) { setSeen(now); setW(String(scene.canvas.w)); setH(String(scene.canvas.h)) } // follow presets and undo
  const commit = () => { const nw = clampSide(Number(w)), nh = clampSide(Number(h)); setW(String(nw)); setH(String(nh)); if (nw !== scene.canvas.w || nh !== scene.canvas.h) update((s) => ({ ...s, canvas: { w: nw, h: nh, preset: 'custom' } })) }
  const field = (label: string, v: string, set: (x: string) => void) => (
    <label className="block flex-1 text-xs text-muted">{label}
      <input type="number" inputMode="numeric" min={CUSTOM_MIN} max={CUSTOM_MAX} value={v} onChange={(e) => set(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && commit()} className="mt-1 h-10 w-full rounded-md bg-surface-raised px-2 text-base text-text shadow-card" />
    </label>
  )
  return (
    <div className="mb-3" role="group" aria-label="Custom canvas size">
      <h4 className="mb-1 text-xs font-semibold text-muted">Custom size{scene.canvas.preset === 'custom' ? ' (in use)' : ''}</h4>
      <div className="flex items-end gap-2">{field('Width', w, setW)}<span aria-hidden className="pb-3 text-muted">×</span>{field('Height', h, setH)}</div>
      <p className="mt-1 text-xs text-muted">{CUSTOM_MIN} to {CUSTOM_MAX} px per side. Press Enter or leave the field to apply.</p>
    </div>
  )
}

/** Slots for Zoom and Tilt with several images: pick a slot, add or remove its image. */
function SlotControls({ scene, update, selected, setSelected, onPick }: { scene: Scene; update: Update; selected: number; setSelected: (i: number) => void; onPick: (i: number) => void }) {
  const ids = slotMediaIds(scene)
  const sel = Math.min(selected, ids.length - 1)
  return (
    <>
      <SectionLabel>Images</SectionLabel>
      <div role="radiogroup" aria-label="Images on the screen" className="grid grid-cols-4 gap-tile">
        {ids.map((id, i) => (
          <button key={i} type="button" role="radio" aria-checked={sel === i} aria-label={`Image ${i + 1}${id ? '' : ', empty'}`} onClick={() => setSelected(i)}
            className={cx('flex h-10 items-center justify-center rounded-md text-sm font-semibold', id ? 'bg-surface-sunken font-bold text-text' : 'bg-surface-sunken text-muted', sel === i && 'is-selected')}>{i + 1}</button>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">Click an image in the preview to select it, or drop several files at once to fill the free slots.</p>
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={() => onPick(sel)} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-md bg-surface-sunken text-sm font-semibold"><ImagePlus size={16} aria-hidden />{ids[sel] ? `Replace image in slot ${sel + 1}` : `Add image to slot ${sel + 1}`}</button>
        {ids[sel] && <button type="button" aria-label={`Remove image from slot ${sel + 1}`} onClick={() => update((s) => setSlotMedia(s, sel, undefined))} className="flex h-10 w-10 items-center justify-center rounded-md bg-surface-sunken"><X size={16} aria-hidden /></button>}
      </div>
    </>
  )
}

/** Move and resize one image in Zoom and Tilt. Dragging in the preview changes the same values. */
function PositionControls({ scene, update, slot, many }: { scene: Scene; update: Update; slot: number; many: boolean }) {
  const o = slotOffset(scene, slot)
  const set = (patch: Partial<typeof o>, key: string) => update((s) => setSlotOffset(s, slot, patch), `${key}${slot}`)
  return (
    <>
      <SectionLabel>{many ? `Position of image ${slot + 1}` : 'Position'}</SectionLabel>
      <p className="mb-2 text-xs text-muted">Drag the image in the preview, or use the sliders. With the preview focused, arrow keys nudge it.</p>
      <div className="space-y-2">
        <Slider label="Horizontal" value={Math.round(o.x * 100)} min={-60} max={60} onChange={(v) => set({ x: v / 100 }, 'px')} />
        <Slider label="Vertical" value={Math.round(o.y * 100)} min={-60} max={60} onChange={(v) => set({ y: v / 100 }, 'py')} />
        <Slider label="Size" value={Math.round(o.s * 100)} min={40} max={180} suffix="%" onChange={(v) => set({ s: v / 100 }, 'ps')} />
      </div>
      <button type="button" disabled={isDefaultOffset(scene, slot)} onClick={() => update((s) => setSlotOffset(s, slot, { x: 0, y: 0, s: 1 }))} className="mt-2 h-10 w-full rounded-md bg-surface-sunken text-sm font-semibold disabled:text-muted disabled:opacity-70">Reset position</button>
    </>
  )
}

function CellControls({ scene, update, selected, setSelected, onPick }: { scene: Scene; update: Update; selected: number; setSelected: (i: number) => void; onPick: (i: number) => void }) {
  const cells = scene.bento?.cells ?? []
  const sel = Math.min(selected, Math.max(0, cells.length - 1))
  const cell = cells[sel]
  const setCell = (p: Partial<BentoCell>, key?: string) => update((s) => (s.bento ? { ...s, bento: { ...s.bento, cells: s.bento.cells.map((c, i) => (i === sel ? { ...c, ...p } : c)) } } : s), key)
  if (!cell) return null
  return (
    <>
      <SectionLabel>Cells</SectionLabel>
      <div role="radiogroup" aria-label="Bento cells" className="grid grid-cols-4 gap-tile">
        {cells.map((c, i) => (
          <button key={i} type="button" role="radio" aria-checked={sel === i} aria-label={`Cell ${i + 1}${c.mediaId ? '' : ', empty'}`} onClick={() => setSelected(i)}
            className={cx('flex h-10 items-center justify-center rounded-md text-sm font-semibold', c.mediaId ? 'bg-surface-sunken font-bold text-text' : 'bg-surface-sunken text-muted', sel === i && 'is-selected')}>{i + 1}</button>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">Click a cell in the preview, or drop several images at once to fill the free cells.</p>
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={() => onPick(sel)} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-md bg-surface-sunken text-sm font-semibold"><ImagePlus size={16} aria-hidden />{cell.mediaId ? `Replace image in cell ${sel + 1}` : `Add image to cell ${sel + 1}`}</button>
        {cell.mediaId && <button type="button" aria-label={`Remove image from cell ${sel + 1}`} onClick={() => setCell({ mediaId: undefined })} className="flex h-10 w-10 items-center justify-center rounded-md bg-surface-sunken"><X size={16} aria-hidden /></button>}
      </div>
      <div className="mt-2"><Segmented value={cell.framed ? 'framed' : 'plain'} onChange={(v) => setCell({ framed: v === 'framed' })} role="radiogroup" label="Cell style" options={[{ id: 'plain', label: <span className="text-sm">Plain</span> }, { id: 'framed', label: <span className="text-sm">In device</span> }]} /></div>
      {cell.framed ? <p className="mt-2 text-xs text-muted">Uses the device and look chosen above.</p> : (
        <div className="mt-2 space-y-2">
          <Segmented value={cell.fit} onChange={(v) => setCell({ fit: v })} role="radiogroup" label="Image fit" options={[{ id: 'fill', label: <span className="text-sm">Fill</span> }, { id: 'fit', label: <span className="text-sm">Fit</span> }]} />
          {cell.fit === 'fill' && (
            <>
              <Slider label="Zoom" value={cell.zoom} min={100} max={300} suffix="%" onChange={(v) => setCell({ zoom: v }, `cz${sel}`)} />
              <Slider label="Left to right" value={Math.round(cell.fx * 100)} min={0} max={100} onChange={(v) => setCell({ fx: v / 100 }, `cx${sel}`)} />
              <Slider label="Top to bottom" value={Math.round(cell.fy * 100)} min={0} max={100} onChange={(v) => setCell({ fy: v / 100 }, `cy${sel}`)} />
            </>
          )}
        </div>
      )}
    </>
  )
}

export function LeftPanel({ scene, update, onPickMedia, onPickBackground, tab, setTab, mediaThumb, selectedCell, setSelectedCell, onPickCell, selectedSlot, setSelectedSlot, onPickSlot, library, usedIds, onUseMedia, onUseBackground, onRemoveMedia }: LibraryProps & { scene: Scene; update: Update; onPickMedia: () => void; onPickBackground: () => void; tab: 'mockup' | 'frame'; setTab: (t: 'mockup' | 'frame') => void; mediaThumb?: string; selectedCell: number; setSelectedCell: (i: number) => void; onPickCell: (i: number) => void; selectedSlot: number; setSelectedSlot: (i: number) => void; onPickSlot: (i: number) => void }) {
  const m = scene.mockup
  const isBento = m.layout.family === 'bento'
  const count = slotCount(scene)
  const slot = Math.min(selectedSlot, count - 1)
  const [moreLooks, setMoreLooks] = useState(false)
  const magicSource = slotMediaIds(scene).map((id) => getMedia(id)).find(Boolean) ?? scene.bento?.cells.map((c) => getMedia(c.mediaId)).find(Boolean)
  const setM = (p: Partial<Scene['mockup']>, key?: string) => update((s) => ({ ...s, mockup: { ...s.mockup, ...p } }), key)
  const corner: { id: CornerType; label: string; icon: React.ReactNode }[] = [
    { id: 'sharp', label: 'Square', icon: <Square size={18} aria-hidden /> }, { id: 'curved', label: 'Soft', icon: <SquareRoundCorner size={18} aria-hidden /> }, { id: 'round', label: 'Pill', icon: <Circle size={18} aria-hidden /> },
  ]
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <Segmented value={tab} onChange={setTab} label="Editor sections" options={[{ id: 'mockup', label: 'Device' }, { id: 'frame', label: 'Canvas' }]} />
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto pr-1" role="tabpanel" aria-label={tab === 'mockup' ? 'Device settings' : 'Canvas settings'}>
        {tab === 'mockup' ? (
          <>
            <button type="button" disabled={!magicSource} onClick={() => { if (!magicSource) return; const mp = magicPresetFromImage(magicSource); update((s) => ({ ...s, background: { ...s.background, type: 'gradient', gradient: mp.gradient }, mockup: s.mockup.layout.family === 'bento' ? { ...s.mockup, style: mp.style, shadow: mp.shadow } : { ...s.mockup, style: mp.style, shadow: mp.shadow, layout: { family: mp.layoutPreset === 'tilt-right' ? 'tilt' : 'zoom', preset: mp.layoutPreset, zoom: 100 } } })) }} className="mb-3 flex h-10 w-full items-center justify-center gap-2 rounded-md bg-surface-raised text-sm font-semibold shadow-card disabled:text-muted disabled:opacity-70">{magicSource ? 'Magic look from my image' : 'Add an image for a magic look'}</button>
            {isBento && <CellControls scene={scene} update={update} selected={selectedCell} setSelected={setSelectedCell} onPick={onPickCell} />}
            {!isBento && count > 1 && <SlotControls scene={scene} update={update} selected={slot} setSelected={setSelectedSlot} onPick={onPickSlot} />}
            {(isBento || count > 1) && <SectionLabel>{isBento ? 'Device for framed cells' : 'Device for all images'}</SectionLabel>}
            <DevicePicker scene={scene} update={update} />
            {!isBento && count === 1 && <><SectionLabel>Image</SectionLabel>
            <button type="button" onClick={onPickMedia} className="flex h-20 w-full items-center justify-center rounded-md bg-surface-sunken text-sm text-muted" aria-label={mediaThumb ? 'Replace image' : 'Add an image'}>
              {mediaThumb ? <span className="flex items-center gap-2"><ThumbCanvas scene={{ ...thumbScene(scene, {}), mockup: { ...thumbScene(scene, {}).mockup, deviceSlug: 'screenshot', style: 'plain' } }} width={72} /> Replace</span> : <span className="flex items-center gap-2"><ImagePlus size={18} aria-hidden /> Add an image</span>}
            </button></>}
            {!isBento && <PositionControls scene={scene} update={update} slot={slot} many={count > 1} />}
            <LibraryGrid library={library} usedIds={usedIds} onUse={onUseMedia} onRemove={onRemoveMedia} actionLabel={isBento ? `Put in cell ${selectedCell + 1}` : count > 1 ? `Put in image ${slot + 1}` : 'Use this image'} />
            <SectionLabel>Look</SectionLabel>
            <TileGrid value={m.style} onChange={(v) => setM({ style: v })} label="Frame look" items={(moreLooks || STYLES.findIndex((x) => x.id === m.style) >= STYLES_SHOWN ? STYLES : STYLES.slice(0, STYLES_SHOWN)).map((s) => ({ id: s.id, label: s.label, preview: <ThumbCanvas scene={{ ...thumbScene(scene, { style: s.id, deviceSlug: m.deviceSlug }), background: { ...scene.background, type: 'gradient' } }} width={64} /> }))} />
            {STYLES.findIndex((x) => x.id === m.style) < STYLES_SHOWN && <button type="button" aria-expanded={moreLooks} onClick={() => setMoreLooks((v) => !v)} className="mt-2 h-8 w-full rounded-md bg-surface-sunken text-sm font-semibold">{moreLooks ? 'Fewer looks' : `More looks (${STYLES.length - STYLES_SHOWN})`}</button>}
            <SectionLabel>Glass and frame</SectionLabel>
            <Slider label="Screen glare" value={m.light ?? 0} min={0} max={100} suffix="%" onChange={(v) => setM({ light: v }, 'light')} />
            <div className="mt-2"><Switch label="Hide the frame" hint="Show the image alone" checked={Boolean(m.hideFrame)} onChange={(v) => setM({ hideFrame: v })} /></div>
            <SectionLabel>Corners</SectionLabel>
            <Segmented value={m.border.type} onChange={(v) => setM({ border: { ...m.border, type: v } })} role="radiogroup" label="Corner style" options={corner.map((c) => ({ id: c.id, aria: c.label, label: <span className="flex items-center gap-1">{c.icon}<span className="text-sm">{c.label}</span></span> }))} />
            <div className="mt-2"><Slider label="Corner size" value={m.border.radius} min={0} max={60} onChange={(v) => setM({ border: { ...m.border, radius: v } }, 'radius')} /></div>
            <SectionLabel>Shadow</SectionLabel>
            <div role="radiogroup" aria-label="Shadow style" className="grid grid-cols-4 gap-tile">
              {SHADOWS.map((s) => (
                <button key={s.id} type="button" role="radio" aria-checked={m.shadow.mode === s.id} title={s.hint} onClick={() => setM({ shadow: { ...m.shadow, mode: s.id } })} className={cx('h-10 rounded-md text-sm font-semibold', m.shadow.mode === s.id ? 'bg-surface-raised shadow-card is-selected' : 'bg-surface-sunken text-muted')}>{s.label}</button>
              ))}
            </div>
            <div className="mt-2"><Slider label="Shadow strength" value={m.shadow.opacity} min={0} max={100} onChange={(v) => setM({ shadow: { ...m.shadow, opacity: v } }, 'shadow')} suffix="%" /></div>
          </>
        ) : (
          <>
            <SectionLabel>Size</SectionLabel>
            {(['Basic', 'Social', 'Stores'] as const).map((grp) => (
              <div key={grp} className="mb-3">
                <h4 className="mb-1 text-xs font-semibold text-muted">{grp === 'Basic' ? 'Everyday' : grp === 'Social' ? 'Social and web' : 'App stores'}</h4>
                <div role="radiogroup" aria-label={`${grp} canvas sizes`} className="grid grid-cols-2 gap-tile">
                  {CANVAS_PRESETS.filter((p) => p.group === grp).map((p) => (
                    <button key={p.id} type="button" role="radio" aria-checked={scene.canvas.preset === p.id} onClick={() => update((s) => ({ ...s, canvas: { w: p.w, h: p.h, preset: p.id } }))} className={cx('rounded-md p-2 text-left', scene.canvas.preset === p.id ? 'is-selected' : 'bg-surface-sunken')}>
                      <span className="block text-sm font-semibold">{p.label}</span><span className="block text-xs text-muted">{p.w} × {p.h}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <CustomSize scene={scene} update={update} />
            <SectionLabel>Backdrop</SectionLabel>
            <Segmented<BackgroundType> value={scene.background.type} onChange={(v) => update((s) => ({ ...s, background: { ...s.background, type: v } }))} role="radiogroup" label="Backdrop type"
              options={[{ id: 'transparent', label: <span className="text-sm">None</span> }, { id: 'color', label: <span className="text-sm">Solid</span> }, { id: 'gradient', label: <span className="text-sm">Blend</span> }, { id: 'image', label: <span className="text-sm">Photo</span> }]} />
            <div className="mt-3">
              {scene.background.type === 'color' && (
                <>
                  <div role="radiogroup" aria-label="Solid colours" className="grid grid-cols-4 gap-tile">
                    {SOLID_COLORS.map((c) => (
                      <button key={c} type="button" role="radio" aria-checked={scene.background.color === c} aria-label={`Colour ${c}`} onClick={() => update((s) => ({ ...s, background: { ...s.background, color: c } }))} className={cx('h-10 rounded-md', scene.background.color === c && 'is-selected')} style={{ background: c }} />
                    ))}
                  </div>
                  <label className="mt-2 flex items-center justify-between rounded-md bg-surface-sunken px-3 py-2 text-sm text-muted">Custom colour
                    <input type="color" aria-label="Custom colour" value={scene.background.color} onChange={(e) => update((s) => ({ ...s, background: { ...s.background, color: e.target.value } }), 'bgcolor')} />
                  </label>
                </>
              )}
              {scene.background.type === 'gradient' && (
                <>
                <button type="button" disabled={!magicSource} onClick={() => magicSource && update((s) => ({ ...s, background: { ...s.background, type: 'gradient', gradient: { ...paletteFromImage(magicSource), angle: 135 } } }))} className="mb-2 flex h-10 w-full items-center justify-center gap-2 rounded-md bg-surface-sunken text-sm font-semibold disabled:text-muted">{magicSource ? 'Magic blend from my image' : 'Add an image for a magic blend'}</button>
                <div role="radiogroup" aria-label="Blends" className="grid grid-cols-4 gap-tile">
                  {GRADIENTS.map((g) => {
                    const on = scene.background.gradient.from === g.from && scene.background.gradient.to === g.to
                    return <button key={g.id} type="button" role="radio" aria-checked={on} aria-label={`Blend ${g.id}`} onClick={() => update((s) => ({ ...s, background: { ...s.background, gradient: { from: g.from, to: g.to, angle: g.angle } } }))} className={cx('h-10 rounded-md', on && 'is-selected')} style={{ background: `linear-gradient(${g.angle}deg, ${g.from}, ${g.to})` }} />
                  })}
                </div>
                </>
              )}
              {scene.background.type === 'image' && (
                <div className="flex gap-2">
                  <button type="button" onClick={onPickBackground} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-md bg-surface-sunken text-sm font-semibold"><ImagePlus size={16} aria-hidden /> {scene.background.imageId ? 'Swap photo' : 'Choose a photo'}</button>
                  {scene.background.imageId && <button type="button" aria-label="Remove photo" onClick={() => update((s) => ({ ...s, background: { ...s.background, type: 'gradient', imageId: undefined } }))} className="flex h-10 w-10 items-center justify-center rounded-md bg-surface-sunken"><X size={16} aria-hidden /></button>}
                </div>
              )}
              {scene.background.type === 'image' && library.length > 0 && <div className="mt-3"><LibraryGrid library={library} usedIds={usedIds} onUse={onUseBackground} onRemove={onRemoveMedia} actionLabel="Use as backdrop" /></div>}
              {scene.background.type === 'transparent' && <p className="text-sm text-muted">The PNG keeps a see-through backdrop.</p>}
            </div>
                      <SectionLabel>Backdrop shapes</SectionLabel>
            <Segmented<ShapeStyle> value={scene.shapes ?? 'none'} onChange={(v) => update((s) => ({ ...s, shapes: v }))} role="radiogroup" label="Backdrop shapes" options={[{ id: 'none', label: <span className="text-sm">None</span> }, { id: 'orbs', label: <span className="text-sm">Glows</span> }, { id: 'rings', label: <span className="text-sm">Rings</span> }]} />
            <SectionLabel>Effects</SectionLabel>
            <div className="space-y-2">
              <Slider label="Grain" value={scene.effects?.grain ?? 0} min={0} max={100} suffix="%" onChange={(v) => update((s) => ({ ...s, effects: { grain: v, vignette: s.effects?.vignette ?? 0 } }), 'grain')} />
              <Slider label="Vignette" value={scene.effects?.vignette ?? 0} min={0} max={100} suffix="%" onChange={(v) => update((s) => ({ ...s, effects: { grain: s.effects?.grain ?? 0, vignette: v } }), 'vignette')} />
            </div>
            <SectionLabel>Watermark</SectionLabel>
            <label className="block text-xs text-muted">Your text
              <input type="text" maxLength={WATERMARK_MAX} value={scene.watermark?.text ?? ''} placeholder="Leave empty for none" onChange={(e) => update((s) => ({ ...s, watermark: { text: e.target.value, position: s.watermark?.position ?? 'right', opacity: s.watermark?.opacity ?? 80 } }), 'wmtext')} className="mt-1 h-10 w-full rounded-md bg-surface-raised px-3 text-base text-text shadow-card" />
            </label>
            {Boolean(scene.watermark?.text.trim()) && (
              <div className="mt-2 space-y-2">
                <Segmented<WatermarkPos> value={scene.watermark!.position} onChange={(v) => update((s) => (s.watermark ? { ...s, watermark: { ...s.watermark, position: v } } : s))} role="radiogroup" label="Watermark position" options={[{ id: 'left', label: <span className="text-sm">Left</span> }, { id: 'center', label: <span className="text-sm">Centre</span> }, { id: 'right', label: <span className="text-sm">Right</span> }]} />
                <Slider label="Strength" value={scene.watermark!.opacity} min={10} max={100} suffix="%" onChange={(v) => update((s) => (s.watermark ? { ...s, watermark: { ...s.watermark, opacity: v } } : s), 'wmop')} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/** Little diagram of an arrangement: one rectangle per image. */
function ArrangementMini({ n, id }: { n: number; id: ReturnType<typeof arrangementOf> }) {
  return (
    <span aria-hidden className="relative block aspect-[4/3] w-full rounded-sm bg-surface">
      {arrangementBoxes(n, id).map((b, i) => (
        <span key={i} className="absolute rounded-xs bg-border-input" style={{ left: `${(b.cx - b.w / 2) * 100}%`, top: `${(b.cy - b.h / 2) * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%`, opacity: 0.55 + i * 0.15 }} />
      ))}
    </span>
  )
}

function BentoMini({ rects }: { rects: [number, number, number, number][] }) {
  return (
    <span aria-hidden className="relative block h-mini-h w-mini-w rounded-sm bg-surface">
      {rects.map(([c, r, w, h], i) => (
        <span key={i} className="absolute rounded-xs bg-border-input" style={{ left: `${(c / 12) * 100 + 1.5}%`, top: `${(r / 12) * 100 + 1.5}%`, width: `${(w / 12) * 100 - 3}%`, height: `${(h / 12) * 100 - 3}%` }} />
      ))}
    </span>
  )
}

export function RightPanel({ scene, update }: { scene: Scene; update: Update }) {
  const fam = scene.mockup.layout.family
  const presets = LAYOUT_PRESETS.filter((p) => p.family === fam)
  const bento = scene.bento
  const setFamily = (v: LayoutFamily) => update((s) => switchFamily(s, v))
  const setBento = (p: Partial<NonNullable<Scene['bento']>>, key?: string) => update((s) => (s.bento ? { ...s, bento: { ...s.bento, ...p } } : s), key)
  const count = slotCount(scene)
  const arr = arrangementOf(scene)
  return (
    <div className="flex min-h-0 flex-col gap-3 md:h-full">
      <div className="flex items-center gap-3 md:block md:space-y-3">
        <div className="w-48 shrink-0 md:w-auto"><Segmented value={fam} onChange={setFamily} label="Layout kind" options={[{ id: 'zoom', label: 'Zoom' }, { id: 'tilt', label: 'Tilt' }, { id: 'bento', label: 'Bento' }]} /></div>
        {fam !== 'bento' && <div className="min-w-0 flex-1"><Slider label="Scale" value={scene.mockup.layout.zoom} min={50} max={200} suffix="%" onChange={(v) => update((s) => ({ ...s, mockup: { ...s.mockup, layout: { ...s.mockup.layout, zoom: v } } }), 'zoom')} /></div>}
        {fam === 'bento' && bento && (
          <div className="min-w-0 flex-1 space-y-2">
            <Slider label="Gap" value={bento.gap} min={0} max={60} onChange={(v) => setBento({ gap: v }, 'bgap')} />
            <Slider label="Cell corners" value={bento.radius} min={0} max={80} onChange={(v) => setBento({ radius: v }, 'brad')} />
          </div>
        )}
      </div>
      {fam !== 'bento' && (
        <div>
          <Segmented<string> value={String(count)} onChange={(v) => update((s) => setCount(s, Number(v)))} role="radiogroup" label="Images on screen" options={Array.from({ length: MAX_SLOTS }, (_, i) => ({ id: String(i + 1), aria: `${i + 1} ${i === 0 ? 'image' : 'images'} on screen`, label: <span className="text-sm">{i + 1}</span> }))} />
          {count > 1 && (
            <div role="radiogroup" aria-label="Arrangement" className="mt-2 grid grid-cols-2 gap-tile">
              {ARRANGEMENTS[count as 2 | 3 | 4].map((a) => (
                <button key={a.id} type="button" role="radio" aria-checked={arr === a.id} aria-label={`Arrangement ${a.label}`} onClick={() => update((s) => ({ ...s, mockup: { ...s.mockup, arrangement: a.id } }))} className={cx('rounded-md p-1 text-left', arr === a.id ? 'is-selected' : 'bg-surface-sunken')}>
                  <ArrangementMini n={count} id={a.id} />
                  <span className="mt-1 block truncate text-xs text-muted">{a.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <SectionLabelHidden />
      {fam === 'bento' && bento ? (
        <div role="radiogroup" aria-label="Bento layouts" className="scroll-thin flex min-h-0 gap-2 overflow-x-auto md:flex-1 md:flex-col md:overflow-y-auto md:overflow-x-hidden">
          {BENTO_PRESETS.map((p) => (
            <button key={p.id} type="button" role="radio" aria-checked={bento.presetId === p.id} onClick={() => setBento({ presetId: p.id, cells: fitCells(bento.cells, p.id) })}
              className={cx('shrink-0 overflow-hidden rounded-md bg-surface-sunken p-1 text-left', bento.presetId === p.id && 'is-selected')}>
              <BentoMini rects={p.rects} />
              <span className="mt-1 block text-xs text-muted">{p.label} ({p.rects.length})</span>
            </button>
          ))}
        </div>
      ) : (
        <div role="radiogroup" aria-label="Layout presets" className="scroll-thin flex min-h-0 gap-2 overflow-x-auto md:flex-1 md:flex-col md:overflow-y-auto md:overflow-x-hidden">
          {presets.map((p) => (
            <button key={p.id} type="button" role="radio" aria-checked={scene.mockup.layout.preset === p.id} onClick={() => update((s) => ({ ...s, mockup: { ...s.mockup, layout: { ...s.mockup.layout, preset: p.id } } }))}
              className={cx('shrink-0 overflow-hidden rounded-md bg-surface-sunken p-1', scene.mockup.layout.preset === p.id && 'is-selected')}>
              <ThumbCanvas scene={{ ...scene, canvas: { w: 400, h: 300, preset: 'thumb' }, mockup: { ...scene.mockup, layout: { ...scene.mockup.layout, preset: p.id, zoom: 100 } } }} width={160} label={`${p.label} layout`} />
              <span className="mt-1 block text-xs text-muted">{p.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
const SectionLabelHidden = () => <h3 className="sr-only">Layout presets</h3>
