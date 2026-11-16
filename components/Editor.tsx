'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUp, Clipboard, Command as CommandIcon, LayoutTemplate, Loader2, Redo2, RotateCcw, SlidersHorizontal, Sparkles, Undo2, UploadCloud, Layers } from 'lucide-react'
import { useEditor } from '@/lib/useEditor'
import { bentoRects, renderScene, slotRects } from '@/lib/render'
import { assignSlots, defaultBento, maxExportScale, panFocus, setCount, setSlotMedia, setSlotOffset, slotCount, slotMediaIds, slotOffset, storedMediaIds, switchFamily } from '@/lib/scene'
import { useTheme } from '@/lib/useTheme'
import { TEMPLATES } from '@/lib/templates'
import ThumbCanvas from './ThumbCanvas'
import { CommandPalette, MainMenu, WhatsNew, type Command } from './Overlays'
import { getMedia, loadImageFile, MediaError, removeFromLibrary } from '@/lib/media'
import { useLibrary } from '@/lib/useLibrary'
import { LeftPanel, RightPanel } from './Panels'
import { Popover, Toast, Tooltip, cx } from './ui'

type ToastState = { message: string; kind: 'info' | 'error' | 'success'; action?: { label: string; run: () => void } } | null

export default function Editor() {
  const { scene, update, undo, redo, reset, canUndo, canRedo } = useEditor()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mediaInput = useRef<HTMLInputElement>(null)
  const bgInput = useRef<HTMLInputElement>(null)
  const exportMenuBtn = useRef<HTMLButtonElement>(null)
  const [tab, setTab] = useState<'mockup' | 'frame'>('mockup')
  const [loading, setLoading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [toast, setToast] = useState<ToastState>(null)
  const [exportScale, setExportScale] = useState<1 | 2 | 3>(1)
  const [tplOpen, setTplOpen] = useState(false)
  const { theme, setTheme } = useTheme()
  const [perf, setPerf] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [menuOpen2, setMenuOpen2] = useState(false)
  const [newsOpen, setNewsOpen] = useState(false)
  const brandBtn = useRef<HTMLButtonElement>(null)
  const stageBox = useRef<HTMLElement>(null)
  const tplBtn = useRef<HTMLButtonElement>(null)
  const maxScale = maxExportScale(scene.canvas.w, scene.canvas.h)
  useEffect(() => { if (exportScale > maxScale) setExportScale(maxScale) }, [exportScale, maxScale])
  const [menuOpen, setMenuOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const isBento = scene.mockup.layout.family === 'bento'
  const [selectedCell, setSelectedCell] = useState(0)
  const [selectedSlot, setSelectedSlot] = useState(0)
  const [selectionActive, setSelectionActive] = useState(false)
  const [grabbing, setGrabbing] = useState(false)
  const count = slotCount(scene)
  const library = useLibrary()
  const usedIds = useMemo(() => {
    const ids = new Set<string>()
    storedMediaIds(scene).forEach((id) => ids.add(id))
    scene.bento?.cells.forEach((c) => c.mediaId && ids.add(c.mediaId))
    if (scene.background.type === 'image' && scene.background.imageId) ids.add(scene.background.imageId)
    return ids
  }, [scene])
  const pendingCell = useRef(0)
  const sceneRef = useRef(scene)
  sceneRef.current = scene
  const selectedCellRef = useRef(0)
  selectedCellRef.current = selectedCell
  const selectedSlotRef = useRef(0)
  selectedSlotRef.current = selectedSlot
  const selectionActiveRef = useRef(false)
  selectionActiveRef.current = selectionActive
  const hasMedia = isBento ? Boolean(scene.bento?.cells.some((c) => getMedia(c.mediaId))) : slotMediaIds(scene).some((id) => Boolean(getMedia(id)))
  // the selected slot can never point past the visible ones
  useEffect(() => { if (selectedSlot > count - 1) setSelectedSlot(count - 1) }, [selectedSlot, count])

  const say = useCallback((message: string, kind: 'info' | 'error' | 'success' = 'info', action?: { label: string; run: () => void }) => setToast({ message, kind, action }), [])
  const closeToast = useCallback(() => setToast(null), [])

  // main preview
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const id = requestAnimationFrame(() => renderScene(el, scene, Math.min(1, (perf ? 640 : 1400) / scene.canvas.w), { placeholders: true, selectedCell: scene.mockup.layout.family === 'bento' ? selectedCell : undefined, selectedSlot: scene.mockup.layout.family !== 'bento' && (selectionActive || slotCount(scene) > 1) ? Math.min(selectedSlot, slotCount(scene) - 1) : undefined }))
    return () => cancelAnimationFrame(id)
  }, [scene, selectedCell, selectedSlot, selectionActive, perf])

  const openPicker = useCallback(() => { pendingCell.current = sceneRef.current.mockup.layout.family === 'bento' ? pendingCell.current : Math.min(selectedSlotRef.current, slotCount(sceneRef.current) - 1); mediaInput.current?.click() }, [])

  const takeFile = useCallback(async (file: File | undefined, target: 'mockup' | 'background') => {
    if (!file) return
    setLoading(true)
    try {
      const { id } = await loadImageFile(file)
      update((s) => (target === 'mockup' ? { ...s, mockup: { ...s.mockup, mediaId: id } } : { ...s, background: { ...s.background, type: 'image', imageId: id } }))
    } catch (e) {
      say(e instanceof MediaError ? e.message : 'Something went wrong while opening that file.', 'error', { label: 'Pick another', run: openPicker })
    } finally { setLoading(false) }
  }, [update, say, openPicker])

  // Bento: the first file goes into cell `at`, the others into the next empty cells.
  const takeBento = useCallback(async (files: File[], at: number) => {
    if (!files.length) return
    setLoading(true)
    const ids: string[] = []
    let firstError: string | null = null
    for (const f of files.slice(0, 12)) {
      try { ids.push((await loadImageFile(f)).id) } catch (e) { firstError ??= e instanceof MediaError ? e.message : 'Something went wrong while opening that file.' }
    }
    setLoading(false)
    if (firstError && ids.length === 0) return say(firstError, 'error')
    // Count from the current scene: a React updater runs later, so counting inside it would always read 0.
    const cur = sceneRef.current.bento ?? defaultBento()
    const placed = Math.min(ids.length, 1 + cur.cells.filter((c, j) => !c.mediaId && j !== at).length)
    update((s) => {
      const bento = s.bento ?? defaultBento()
      const cells = bento.cells.map((c) => ({ ...c }))
      const empty = cells.map((c, j) => (!c.mediaId && j !== at ? j : -1)).filter((j) => j >= 0)
      ids.forEach((id, n) => {
        const idx = n === 0 ? at : empty.shift()
        if (idx === undefined || !cells[idx]) return
        cells[idx] = { ...cells[idx], mediaId: id, fx: 0.5, fy: 0.5, zoom: 100 }
      })
      return { ...s, bento: { ...bento, cells } }
    })
    if (firstError) say(`${firstError} The other images were added.`, 'info')
    else if (ids.length > 1 && ids.length > placed) say('Some images did not fit in the free cells. Pick a layout with more cells.', 'info')
  }, [update, say])
  const pickForCell = useCallback((i: number) => { pendingCell.current = i; setSelectedCell(i); mediaInput.current?.click() }, [])
  const pickForSlot = useCallback((i: number) => { pendingCell.current = i; setSelectedSlot(i); setSelectionActive(true); mediaInput.current?.click() }, [])
  // Zoom and Tilt with several images: the first file goes into slot `at`, the rest into the next empty slots.
  // Dropping several files on a one-image picture shows that many images (up to four).
  const takeSlots = useCallback(async (files: File[], at: number) => {
    if (!files.length) return
    setLoading(true)
    const ids: string[] = []
    let firstError: string | null = null
    for (const f of files.slice(0, 4)) {
      try { ids.push((await loadImageFile(f)).id) } catch (e) { firstError ??= e instanceof MediaError ? e.message : 'Something went wrong while opening that file.' }
    }
    setLoading(false)
    if (firstError && ids.length === 0) return say(firstError, 'error')
    const grow = (sc: typeof scene) => (slotCount(sc) === 1 && ids.length > 1 ? setCount(sc, Math.min(4, ids.length)) : sc)
    const { placed } = assignSlots(grow(sceneRef.current), ids, at)   // counted here: a React updater runs later
    update((s) => assignSlots(grow(s), ids, at).scene)
    if (firstError) say(`${firstError} The other images were added.`, 'info')
    else if (placed < ids.length) say('Some images did not fit in the free slots. Show more images on screen to use them all.', 'info')
  }, [update, say])
  const cellAt = useCallback((clientX: number, clientY: number): number => {
    const el = canvasRef.current; const sc = sceneRef.current
    if (!el || !sc.bento) return -1
    const r = el.getBoundingClientRect()
    if (clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom) return -1
    const x = ((clientX - r.left) / r.width) * sc.canvas.w, y = ((clientY - r.top) / r.height) * sc.canvas.h
    return bentoRects(sc, sc.canvas.w, sc.canvas.h).findIndex((c) => x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h)
  }, [])
  /** Topmost image under the pointer in Zoom and Tilt (later slots are drawn in front), or -1. */
  const slotAt = useCallback((clientX: number, clientY: number): number => {
    const el = canvasRef.current; const sc = sceneRef.current
    if (!el || sc.mockup.layout.family === 'bento') return -1
    const r = el.getBoundingClientRect()
    if (clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom) return -1
    const x = ((clientX - r.left) / r.width) * sc.canvas.w, y = ((clientY - r.top) / r.height) * sc.canvas.h
    const rects = slotRects(sc, sc.canvas.w, sc.canvas.h)
    for (let i = rects.length - 1; i >= 0; i--) { const q = rects[i]; if (x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h) return i }
    return -1
  }, [])
  const targetAt = useCallback((x: number, y: number) => (sceneRef.current.mockup.layout.family === 'bento' ? cellAt(x, y) : slotAt(x, y)), [cellAt, slotAt])
  const route = useCallback((files: File[], at?: number) => {
    const sc = sceneRef.current
    if (sc.mockup.layout.family === 'bento') {
      const first = at !== undefined && at >= 0 ? at : (sc.bento?.cells.findIndex((c) => !c.mediaId) ?? 0)
      const cell = first >= 0 ? first : pendingCell.current
      setSelectedCell(cell); void takeBento(files, cell)
    } else if (slotCount(sc) > 1 || files.length > 1) {
      const empty = slotMediaIds(sc).findIndex((id) => !id)
      const slot = at !== undefined && at >= 0 ? at : empty >= 0 ? empty : selectedSlotRef.current
      setSelectedSlot(slot); void takeSlots(files, slot)
    } else void takeFile(files[0], 'mockup')
  }, [takeBento, takeSlots, takeFile])

  // Reuse an image already in the library (no upload). Bento: into `at` (default: the selected cell).
  const applyLibraryImage = useCallback((id: string, at?: number) => {
    const sc = sceneRef.current
    if (sc.mockup.layout.family === 'bento') {
      const cell = at !== undefined && at >= 0 ? at : selectedCellRef.current
      update((s) => {
        const bento = s.bento ?? defaultBento()
        if (!bento.cells[cell]) return s
        return { ...s, bento: { ...bento, cells: bento.cells.map((c, i) => (i === cell ? { ...c, mediaId: id, fx: 0.5, fy: 0.5, zoom: 100 } : c)) } }
      })
      // move on to the next empty cell so a row of clicks fills the grid
      const cells = sc.bento?.cells ?? []
      const next = cells.findIndex((c, j) => j !== cell && !c.mediaId)
      setSelectedCell(next >= 0 ? next : cell)
    } else {
      const slot = Math.min(slotCount(sc) - 1, at !== undefined && at >= 0 ? at : selectedSlotRef.current)
      update((s) => setSlotMedia(s, slot, id))
      // move on to the next empty slot so a row of clicks fills the picture
      const next = slotMediaIds(sc).findIndex((m, j) => j !== slot && !m)
      setSelectedSlot(next >= 0 ? next : slot)
    }
  }, [update])
  const applyAsBackground = useCallback((id: string) => update((s) => ({ ...s, background: { ...s.background, type: 'image', imageId: id } })), [update])
  const removeFromLib = useCallback((id: string) => { removeFromLibrary(id); say('Removed from the library.', 'info') }, [say])

  // paste + drop anywhere
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const f = Array.from(e.clipboardData?.files ?? [])[0]
      if (f) { e.preventDefault(); route(Array.from(e.clipboardData?.files ?? [])) }
    }
    const over = (e: DragEvent) => { if (e.dataTransfer?.types.includes('Files')) { e.preventDefault(); setDragging(true) } else if (e.dataTransfer?.types.includes('application/x-library-id')) e.preventDefault() }
    const leave = (e: DragEvent) => { if (!e.relatedTarget) setDragging(false) }
    const drop = (e: DragEvent) => { e.preventDefault(); setDragging(false); const lid = e.dataTransfer?.getData('application/x-library-id'); if (lid) { applyLibraryImage(lid, targetAt(e.clientX, e.clientY)); return } const fl = Array.from(e.dataTransfer?.files ?? []); if (fl.length) route(fl, targetAt(e.clientX, e.clientY)) }
    window.addEventListener('paste', onPaste); window.addEventListener('dragover', over); window.addEventListener('dragleave', leave); window.addEventListener('drop', drop)
    return () => { window.removeEventListener('paste', onPaste); window.removeEventListener('dragover', over); window.removeEventListener('dragleave', leave); window.removeEventListener('drop', drop) }
  }, [route, targetAt, applyLibraryImage])

  // Moving things on the canvas: drag an image (Zoom/Tilt) or drag inside a bento cell to pan its crop.
  type Drag = { kind: 'slot' | 'pan' | 'empty-slot' | 'empty-cell'; index: number; x: number; y: number; orig: { x: number; y: number }; moved: boolean; key: string }
  const drag = useRef<Drag | null>(null)
  const dragId = useRef(0)
  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const sc = sceneRef.current
    const i = targetAt(e.clientX, e.clientY)
    const key = `drag${++dragId.current}`
    if (sc.mockup.layout.family === 'bento') {
      if (i < 0) return
      setSelectedCell(i)
      const cell = sc.bento?.cells[i]
      if (!cell || !getMedia(cell.mediaId)) drag.current = { kind: 'empty-cell', index: i, x: e.clientX, y: e.clientY, orig: { x: 0, y: 0 }, moved: false, key }
      else if (!cell.framed && cell.fit === 'fill') drag.current = { kind: 'pan', index: i, x: e.clientX, y: e.clientY, orig: { x: cell.fx, y: cell.fy }, moved: false, key }
      else return
    } else {
      if (i < 0) { setSelectionActive(false); return }
      setSelectedSlot(i); setSelectionActive(true)
      if (!slotMediaIds(sc)[i]) drag.current = { kind: 'empty-slot', index: i, x: e.clientX, y: e.clientY, orig: { x: 0, y: 0 }, moved: false, key }
      else { const o = slotOffset(sc, i); drag.current = { kind: 'slot', index: i, x: e.clientX, y: e.clientY, orig: { x: o.x, y: o.y }, moved: false, key } }
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current; const el = canvasRef.current
    if (!d || !el) return
    const dx = e.clientX - d.x, dy = e.clientY - d.y
    if (!d.moved && Math.hypot(dx, dy) < 4) return
    d.moved = true
    if (d.kind === 'empty-slot' || d.kind === 'empty-cell') return
    setGrabbing(true)
    const r = el.getBoundingClientRect()
    if (d.kind === 'slot') update((s) => setSlotOffset(s, d.index, { x: d.orig.x + dx / r.width, y: d.orig.y + dy / r.height }), d.key)
    else {
      const sc = sceneRef.current; const cell = sc.bento?.cells[d.index]; const img = getMedia(cell?.mediaId); const rect = bentoRects(sc, sc.canvas.w, sc.canvas.h)[d.index]
      if (!cell || !img || !rect) return
      const f = panFocus(img.naturalWidth, img.naturalHeight, rect.w, rect.h, cell.zoom, d.orig.x, d.orig.y, dx * (sc.canvas.w / r.width), dy * (sc.canvas.h / r.height))
      update((s) => (s.bento ? { ...s, bento: { ...s.bento, cells: s.bento.cells.map((c, j) => (j === d.index ? { ...c, fx: f.fx, fy: f.fy } : c)) } } : s), d.key)
    }
  }
  const endDrag = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current; drag.current = null; setGrabbing(false)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    if (d && !d.moved && e.type === 'pointerup') { if (d.kind === 'empty-slot') pickForSlot(d.index); else if (d.kind === 'empty-cell') pickForCell(d.index) }
  }
  const onCanvasKey = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    const sc = sceneRef.current
    const arrows: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
    const dir = arrows[e.key]
    if (sc.mockup.layout.family === 'bento') {
      const cell = sc.bento?.cells[selectedCellRef.current]; const img = getMedia(cell?.mediaId)
      if (!dir || !cell || !img || cell.framed || cell.fit !== 'fill') return
      e.preventDefault()
      const step = e.shiftKey ? 0.1 : 0.02, i = selectedCellRef.current
      update((s) => (s.bento ? { ...s, bento: { ...s.bento, cells: s.bento.cells.map((c, j) => (j === i ? { ...c, fx: Math.min(1, Math.max(0, c.fx + dir[0] * step)), fy: Math.min(1, Math.max(0, c.fy + dir[1] * step)) } : c)) } } : s), `bnudge${i}`)
      return
    }
    if (e.key === 'Escape') { setSelectionActive(false); return }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectionActive(true); return }
    // With one image, arrows act only while it is selected (Escape clears that). With several, the ringed image is always the target.
    if (!dir || !(selectionActiveRef.current || slotCount(sc) > 1)) return
    e.preventDefault(); setSelectionActive(true)
    const slot = Math.min(selectedSlotRef.current, slotCount(sc) - 1), step = e.shiftKey ? 0.05 : 0.01
    update((s) => { const o = slotOffset(s, slot); return setSlotOffset(s, slot, { x: o.x + dir[0] * step, y: o.y + dir[1] * step }) }, `nudge${slot}`)
  }

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) { void document.exitFullscreen(); return }
    const el = stageBox.current
    if (!el?.requestFullscreen) return say('Full screen is not available in this browser.', 'info')
    el.requestFullscreen().catch(() => say('The browser did not allow full screen.', 'info'))
  }, [say])

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen((o) => !o); return }
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' && (t as HTMLInputElement).type !== 'range') return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo() }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo() }
    }
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k)
  }, [undo, redo])

  const makeBlob = useCallback(async (): Promise<Blob> => {
    const c = document.createElement('canvas')
    renderScene(c, scene, exportScale, { placeholders: false })
    return await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('The browser could not create the PNG.'))), 'image/png'))
  }, [scene, exportScale])

  const download = async () => {
    if (!hasMedia) return say('Add an image first, then export.', 'info', { label: 'Add image', run: openPicker })
    setBusy(true)
    try {
      const blob = await makeBlob()
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `frameshot-${exportScale}x.png`; a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 2000)
      say(`Saved a ${scene.canvas.w * exportScale} × ${scene.canvas.h * exportScale} PNG.`, 'success')
    } catch (e) { say(e instanceof Error ? e.message : 'Export failed.', 'error', { label: 'Try again', run: download }) } finally { setBusy(false) }
  }
  const copy = async () => {
    if (!hasMedia) return say('Add an image first, then copy.', 'info')
    try {
      if (!navigator.clipboard || typeof ClipboardItem === 'undefined') throw new Error('This browser cannot copy images. Use Export instead.')
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': makeBlob() })])
      say('Copied to your clipboard.', 'success')
    } catch (e) { say(e instanceof Error ? e.message : 'Copy failed.', 'error') }
  }
  const startOver = () => { reset();  // decoded images stay in memory so Undo can bring them back
    say('Started over.', 'info', { label: 'Undo', run: undo }) }

  const commands: Command[] = [
    { id: 'add', label: isBento ? `Add image to cell ${selectedCell + 1}` : count > 1 ? `Add image to slot ${Math.min(selectedSlot, count - 1) + 1}` : 'Add an image', group: 'Image', run: () => (isBento ? pickForCell(selectedCell) : count > 1 ? pickForSlot(Math.min(selectedSlot, count - 1)) : openPicker()) },
    ...[1, 2, 3, 4].map((n) => ({ id: `images-${n}`, label: `Images on screen: ${n}`, hint: n === 1 ? 'One image' : `${n} images in Zoom or Tilt`, group: 'Layout', run: () => update((s) => setCount(switchFamily(s, s.mockup.layout.family === 'bento' ? 'zoom' : s.mockup.layout.family), n)) })),
    { id: 'export', label: 'Export PNG', hint: `${exportScale}x`, group: 'Export', run: () => void download() },
    { id: 'copy', label: 'Copy image to clipboard', group: 'Export', run: () => void copy() },
    { id: 'undo', label: 'Undo', group: 'Edit', run: undo },
    { id: 'redo', label: 'Redo', group: 'Edit', run: redo },
    { id: 'startover', label: 'Start over', group: 'Edit', run: startOver },
    { id: 'templates', label: 'Choose a template', group: 'Look', run: () => setTplOpen(true) },
    { id: 'zoom', label: 'Layout: Zoom', group: 'Layout', run: () => update((s) => switchFamily(s, 'zoom')) },
    { id: 'tilt', label: 'Layout: Tilt', group: 'Layout', run: () => update((s) => switchFamily(s, 'tilt')) },
    { id: 'bento', label: 'Layout: Bento', hint: 'Several images in one picture', group: 'Layout', run: () => update((s) => switchFamily(s, 'bento')) },
    { id: 'device-tab', label: 'Show device settings', group: 'View', run: () => setTab('mockup') },
    { id: 'canvas-tab', label: 'Show canvas settings', hint: 'Size, backdrop, effects, watermark', group: 'View', run: () => setTab('frame') },
    { id: 'perf', label: perf ? 'Turn performance mode off' : 'Turn performance mode on', group: 'View', run: () => setPerf((v) => !v) },
    { id: 'fullscreen', label: 'Full-screen preview', group: 'View', run: toggleFullscreen },
    { id: 'theme-system', label: 'Appearance: follow system', group: 'Appearance', run: () => setTheme('system') },
    { id: 'theme-light', label: 'Appearance: light', group: 'Appearance', run: () => setTheme('light') },
    { id: 'theme-dark', label: 'Appearance: dark', group: 'Appearance', run: () => setTheme('dark') },
    { id: 'news', label: 'What is new', group: 'Help', run: () => setNewsOpen(true) },
  ]
  const chip = 'flex h-header items-center rounded-lg bg-surface shadow-card'
  const iconBtn = 'flex h-8 w-8 shrink-0 items-center justify-center rounded-pill text-text transition-colors duration-fast hover:bg-surface-sunken disabled:cursor-not-allowed disabled:text-muted'
  const mediaThumb = hasMedia ? 'yes' : undefined
  const transparent = scene.background.type === 'transparent'

  return (
    <div className="fixed inset-0 flex flex-col gap-[var(--layout-panel-gap)] p-[var(--layout-app-margin)] md:grid md:grid-cols-[var(--layout-panel-width)_minmax(0,1fr)_var(--layout-panel-width)] md:grid-rows-[var(--layout-header-height)_minmax(0,1fr)]">
      <input ref={mediaInput} type="file" accept="image/*,video/*" tabIndex={-1} className="sr-only" aria-label="Choose an image file" data-testid="media-input" multiple={isBento || count > 1} onChange={(e) => { const fl = Array.from(e.target.files ?? []); if (isBento) { setSelectedCell(pendingCell.current); void takeBento(fl, pendingCell.current) } else if (count > 1) { setSelectedSlot(pendingCell.current); void takeSlots(fl, pendingCell.current) } else void takeFile(fl[0], 'mockup'); e.target.value = '' }} />
      <input ref={bgInput} type="file" accept="image/*" tabIndex={-1} className="sr-only" aria-label="Choose a backdrop photo" data-testid="bg-input" onChange={(e) => { void takeFile(e.target.files?.[0], 'background'); e.target.value = '' }} />

      <div className={cx(chip, 'hidden md:flex')}><button ref={brandBtn} type="button" aria-haspopup="dialog" aria-expanded={menuOpen2} onClick={() => setMenuOpen2((o) => !o)} className="flex h-full w-full items-center gap-2 rounded-lg px-3 hover:bg-surface-sunken"><Layers aria-hidden size={18} /><span className="text-base font-semibold">Frameshot</span></button></div>

      <div className="order-1 flex h-header shrink-0 items-center justify-start gap-2 md:order-none md:justify-center">
        <div className={cx(chip, 'gap-1 px-2')} role="toolbar" aria-label="Editor actions">
          <button type="button" className={iconBtn} onClick={undo} disabled={!canUndo} aria-label="Undo"><Undo2 size={18} aria-hidden /></button>
          <button type="button" className={iconBtn} onClick={redo} disabled={!canRedo} aria-label="Redo"><Redo2 size={18} aria-hidden /></button>
          <button type="button" className={iconBtn} onClick={() => setPaletteOpen(true)} aria-label="Commands (Ctrl K)" aria-haspopup="dialog"><CommandIcon size={18} aria-hidden /></button>
          <button ref={tplBtn} type="button" aria-haspopup="dialog" aria-expanded={tplOpen} onClick={() => setTplOpen((o) => !o)} className="flex h-9 items-center gap-2 rounded-pill px-3 text-base font-semibold hover:bg-surface-sunken"><LayoutTemplate size={16} aria-hidden /><span className="hidden sm:inline">Templates</span><span className="sr-only sm:hidden">Templates</span></button>
          <button type="button" className="flex h-9 items-center gap-2 rounded-pill px-3 text-base font-semibold hover:bg-surface-sunken" onClick={startOver}><RotateCcw size={16} aria-hidden /><span className="hidden sm:inline">Start over</span><span className="sr-only sm:hidden">Start over</span></button>
        </div>
      </div>

      <div className="absolute right-[var(--layout-app-margin)] top-[var(--layout-app-margin)] z-30 md:static md:z-auto">{ExportChip()}</div>

      <aside aria-label="Device and canvas settings" className="order-4 h-sheet shrink-0 overflow-hidden rounded-lg bg-surface p-3 shadow-card md:order-none md:h-auto md:min-h-0">
        <LeftPanel scene={scene} update={update} tab={tab} setTab={setTab} onPickMedia={openPicker} selectedCell={selectedCell} setSelectedCell={setSelectedCell} onPickCell={pickForCell} selectedSlot={selectedSlot} setSelectedSlot={(i) => { setSelectedSlot(i); setSelectionActive(true) }} onPickSlot={pickForSlot} library={library} usedIds={usedIds} onUseMedia={applyLibraryImage} onUseBackground={applyAsBackground} onRemoveMedia={removeFromLib} onPickBackground={() => bgInput.current?.click()} mediaThumb={mediaThumb} />
      </aside>

      <main ref={stageBox} className="relative order-2 flex min-h-0 flex-1 items-center justify-center bg-bg md:order-none" aria-label="Preview">
        <div className="relative flex max-h-full max-w-full items-center justify-center" style={{ aspectRatio: `${scene.canvas.w} / ${scene.canvas.h}`, height: '100%', maxWidth: '100%' }}>
          <div className="relative h-full w-full overflow-hidden rounded-lg shadow-card" style={transparent ? { background: 'repeating-conic-gradient(var(--color-surface-sunken) 0 25%, var(--color-surface) 0 50%) 0 0 / 16px 16px' } : undefined}>
            <canvas ref={canvasRef} data-testid="stage" tabIndex={0} role="application"
              aria-label={isBento ? 'Bento preview. Click a cell to select it or add an image. Drag inside a selected cell to move its crop, or use the arrow keys.' : 'Mockup preview. Click an image to select it, drag to move it, or use the arrow keys. Escape clears the selection.'}
              className={cx('stage-focus block h-full w-full', isBento ? 'cursor-pointer' : hasMedia && (grabbing ? 'cursor-grabbing' : 'cursor-grab'))}
              style={{ touchAction: isBento || selectionActive ? 'none' : 'auto' }}
              onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag} onKeyDown={onCanvasKey} />
          </div>
          {!hasMedia && !loading && !isBento && (
            <button type="button" onClick={openPicker} data-testid="drop-zone" className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 rounded-lg bg-surface-raised px-6 py-4 text-center shadow-pop">
              <UploadCloud size={28} aria-hidden /><span className="text-lg font-semibold">Drop, paste or browse</span><span className="text-sm text-muted">PNG, JPG, WebP or GIF up to 25 MB</span>
            </button>
          )}
          {loading && <div role="status" className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-pill bg-surface-raised px-4 py-2 shadow-pop"><Loader2 size={18} aria-hidden className="spin" />Opening image…</div>}
          {dragging && <div className="absolute inset-0 flex items-center justify-center rounded-lg border-2 border-dashed border-ring bg-surface/80 text-lg font-semibold">Release to use this image</div>}
        </div>
        <div className="absolute bottom-2 left-1/2 hidden -translate-x-1/2 md:block">
          <Tooltip text="Animation is coming in a later version"><button type="button" aria-disabled="true" aria-describedby={undefined} onClick={(e) => e.preventDefault()} className="flex h-10 cursor-not-allowed items-center gap-2 rounded-pill bg-surface-raised px-4 text-base font-semibold text-muted shadow-card"><Sparkles size={16} aria-hidden />Animate</button></Tooltip>
        </div>
      </main>

      <aside aria-label="Layout" className="order-3 shrink-0 rounded-lg bg-surface p-3 shadow-card md:order-none md:min-h-0">
        <RightPanel scene={scene} update={update} />
      </aside>

      <MainMenu open={menuOpen2} onClose={() => setMenuOpen2(false)} anchor={brandBtn} theme={theme} setTheme={setTheme} perf={perf} setPerf={setPerf} onFullscreen={toggleFullscreen} onWhatsNew={() => setNewsOpen(true)} onCommands={() => setPaletteOpen(true)} />
      <WhatsNew open={newsOpen} onClose={() => setNewsOpen(false)} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} commands={commands} />
      <Popover open={tplOpen} onClose={() => setTplOpen(false)} anchor={tplBtn} label="Choose a starting look" width={380}>
        <p className="mb-2 text-sm text-muted">A template changes the look and layout. Your images stay.</p>
        <div className="grid grid-cols-2 gap-tile">
          {TEMPLATES.map((t) => (
            <button key={t.id} type="button" onClick={() => { update((s) => t.apply(s)); setTplOpen(false); say(`Applied the ${t.label} look.`, 'info', { label: 'Undo', run: undo }) }} className="rounded-md bg-surface-sunken p-2 text-left">
              <span className="flex justify-center"><ThumbCanvas scene={{ ...t.apply(scene), canvas: { w: 400, h: 300, preset: 'thumb' } }} width={160} /></span>
              <span className="mt-1 block text-sm font-semibold">{t.label}</span>
            </button>
          ))}
        </div>
      </Popover>
      {toast && <Toast message={toast.message} kind={toast.kind} action={toast.action} onClose={closeToast} />}
    </div>
  )

  function ExportChip() {
    return (
      <div className={cx(chip, 'relative w-full min-w-0 gap-0.5 px-1')}>
        <button type="button" onClick={download} disabled={busy} aria-busy={busy} data-testid="export" className="flex h-9 shrink-0 items-center gap-1 rounded-pill bg-accent px-3 text-base font-semibold text-on-accent disabled:opacity-70">
          {busy ? <Loader2 size={16} aria-hidden className="spin" /> : <ArrowUp size={16} aria-hidden />}Export
        </button>
        <span className="hidden min-w-0 flex-1 truncate text-center text-sm text-muted sm:inline" data-testid="export-label">{exportScale}x · PNG</span>
        <button type="button" className={iconBtn} onClick={copy} aria-label="Copy image to clipboard"><Clipboard size={16} aria-hidden /></button>
        <button ref={exportMenuBtn} type="button" className={iconBtn} aria-haspopup="dialog" aria-expanded={menuOpen} aria-label="Export size" onClick={() => setMenuOpen((o) => !o)}><SlidersHorizontal size={16} aria-hidden /></button>
        <Popover open={menuOpen} onClose={() => setMenuOpen(false)} anchor={exportMenuBtn} label="Export size" width={200}>
          <p className="mb-2 text-sm font-semibold text-muted">Size</p>
          <div role="radiogroup" aria-label="Export scale" className="flex gap-2">
            {([1, 2, 3] as const).map((s) => (
              <button key={s} type="button" role="radio" aria-checked={exportScale === s} disabled={s > maxScale} title={s > maxScale ? 'Too large for this canvas size' : undefined} onClick={() => { setExportScale(s); setMenuOpen(false) }} className={cx('h-10 flex-1 rounded-md text-base font-semibold disabled:text-muted disabled:opacity-60', exportScale === s ? 'bg-accent text-on-accent' : 'bg-surface-sunken')}>{s}x</button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">{scene.canvas.w * exportScale} × {scene.canvas.h * exportScale} px</p>
        </Popover>
      </div>
    )
  }
}
