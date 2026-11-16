'use client'
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export const cx = (...a: (string | false | undefined | null)[]) => a.filter(Boolean).join(' ')

export function SectionLabel({ children }: { children: ReactNode }) {
  return <h3 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-[0.06em] text-muted first:mt-0">{children}</h3>
}

export function Segmented<T extends string>({ value, onChange, options, label, role = 'tablist' }: { value: T; onChange: (v: T) => void; options: { id: T; label: ReactNode; aria?: string }[]; label: string; role?: 'tablist' | 'radiogroup' }) {
  const ref = useRef<HTMLDivElement>(null)
  const onKey = (e: React.KeyboardEvent) => {
    const i = options.findIndex((o) => o.id === value)
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { onChange(options[(i + 1) % options.length].id); e.preventDefault() }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { onChange(options[(i - 1 + options.length) % options.length].id); e.preventDefault() }
  }
  return (
    <div ref={ref} role={role} aria-label={label} onKeyDown={onKey} className="flex gap-seg rounded-pill bg-surface-sunken p-seg">
      {options.map((o) => (
        <button key={o.id} type="button" role={role === 'tablist' ? 'tab' : 'radio'} aria-selected={role === 'tablist' ? value === o.id : undefined} aria-checked={role === 'radiogroup' ? value === o.id : undefined} aria-label={o.aria} tabIndex={value === o.id ? 0 : -1}
          onClick={() => onChange(o.id)}
          className={cx('flex h-8 flex-1 items-center justify-center rounded-pill text-base font-semibold transition-colors duration-fast', value === o.id ? 'bg-surface-raised text-text shadow-card' : 'text-muted hover:text-text')}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Slider({ label, value, min, max, step = 1, suffix = '', onChange }: { label: string; value: number; min: number; max: number; step?: number; suffix?: string; onChange: (v: number) => void }) {
  const id = useId()
  return (
    <div className="rounded-md bg-surface-sunken px-3 py-2">
      <div className="flex justify-between text-sm text-muted"><label htmlFor={id}>{label}</label><output htmlFor={id}>{value}{suffix}</output></div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full" style={{ accentColor: 'var(--color-accent)' }} />
    </div>
  )
}

export function TileGrid<T extends string>({ value, onChange, items, label, cols = 3 }: { value: T; onChange: (v: T) => void; items: { id: T; label: string; preview: ReactNode }[]; label: string; cols?: number }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-tile" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {items.map((it) => (
        <button key={it.id} type="button" role="radio" aria-checked={value === it.id} onClick={() => onChange(it.id)} className="group text-center">
          <span className={cx('flex h-16 items-center justify-center overflow-hidden rounded-md bg-surface-sunken transition-shadow duration-fast', value === it.id ? 'is-selected' : 'group-hover:shadow-card')}>{it.preview}</span>
          <span className={cx('mt-1 block truncate text-xs', value === it.id ? 'font-semibold text-text' : 'text-muted')}>{it.label}</span>
        </button>
      ))}
    </div>
  )
}

export function Tooltip({ text, children }: { text: string; children: ReactNode }) {
  const id = useId()
  const [open, setOpen] = useState(false)
  useEffect(() => { if (!open) return; const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [open])
  return (
    <span className="relative inline-flex" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} aria-describedby={open ? id : undefined}>
      {children}
      {open && <span id={id} role="tooltip" className="pointer-events-none absolute -top-9 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-md bg-surface-raised px-2 py-1 text-xs text-text shadow-card">{text}</span>}
    </span>
  )
}

export function Toast({ message, kind, onClose, action }: { message: string; kind: 'info' | 'error' | 'success'; onClose: () => void; action?: { label: string; run: () => void } }) {
  const paused = useRef(false)
  useEffect(() => { const t = setTimeout(() => { if (!paused.current) onClose() }, 5000); return () => clearTimeout(t) }, [message, onClose])
  return (
    <div role={kind === 'error' ? 'alert' : 'status'} onMouseEnter={() => (paused.current = true)} onMouseLeave={() => (paused.current = false)}
      className={cx('fixed bottom-20 left-1/2 z-[60] flex max-w-toast -translate-x-1/2 items-center gap-3 rounded-md bg-surface-raised px-4 py-3 text-base shadow-pop md:bottom-16', kind === 'error' && 'text-danger', kind === 'success' && 'text-success')}>
      <span>{message}</span>
      {action && <button type="button" onClick={action.run} className="rounded-sm font-semibold underline">{action.label}</button>}
      <button type="button" aria-label="Dismiss message" onClick={onClose} className="rounded-sm px-1 text-muted hover:text-text">×</button>
    </div>
  )
}

export function Popover({ open, onClose, anchor, children, label, width = 320 }: { open: boolean; onClose: () => void; anchor: React.RefObject<HTMLElement | null>; children: ReactNode; label: string; width?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number; maxH: number } | null>(null)
  // Rendered in a portal with fixed coordinates so scrolling or clipped panels never cut it off.
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const r = anchor.current?.getBoundingClientRect()
      if (!r) return
      const w = Math.min(width, window.innerWidth - 16)
      const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8))
      const top = r.bottom + 8
      setPos({ left, top, maxH: Math.max(160, window.innerHeight - top - 8) })
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [open, anchor, width])
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { onClose(); anchor.current?.focus() } }
    const d = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node) && !anchor.current?.contains(e.target as Node)) onClose() }
    window.addEventListener('keydown', k); window.addEventListener('mousedown', d)
    ref.current?.querySelector<HTMLElement>('button')?.focus()
    return () => { window.removeEventListener('keydown', k); window.removeEventListener('mousedown', d) }
  }, [open, onClose, anchor, pos])
  if (!open || !pos) return null
  return createPortal(
    <div ref={ref} role="dialog" aria-label={label} style={{ position: 'fixed', left: pos.left, top: pos.top, width: Math.min(width, window.innerWidth - 16), maxHeight: pos.maxH }} className="z-50 overflow-y-auto rounded-lg bg-surface-raised p-3 shadow-pop scroll-thin">{children}</div>,
    document.body,
  )
}

export function Switch({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-3 rounded-md bg-surface-sunken px-3 py-2 text-left">
      <span><span className="block text-sm font-semibold">{label}</span>{hint && <span className="block text-xs text-muted">{hint}</span>}</span>
      <span aria-hidden className={cx('relative h-6 w-10 shrink-0 rounded-pill transition-colors duration-fast', checked ? 'bg-accent' : 'bg-border-input')}>
        <span className={cx('absolute top-1 h-4 w-4 rounded-pill bg-surface-raised transition-all duration-fast', checked ? 'left-5' : 'left-1')} />
      </span>
    </button>
  )
}

/** Centered dialog: focus moves in, Tab stays inside, Esc or a click outside closes, focus goes back to where it was. */
export function Modal({ open, onClose, label, children, width = 520 }: { open: boolean; onClose: () => void; label: string; children: ReactNode; width?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const before = document.activeElement as HTMLElement | null
    const focusables = () => Array.from(ref.current?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? []).filter((e) => !e.hasAttribute('disabled'))
    ;(ref.current?.querySelector<HTMLElement>('[data-autofocus]') ?? focusables()[0])?.focus()
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return }
      if (e.key !== 'Tab') return
      const f = focusables(); if (!f.length) return
      const first = f[0], last = f[f.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', k, true)
    return () => { window.removeEventListener('keydown', k, true); before?.focus?.() }
  }, [open, onClose])
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-overlay p-4 pt-modal-top" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={label} style={{ width: Math.min(width, 9999), maxWidth: '100%' }} className="rounded-lg bg-surface-raised p-4 text-text shadow-pop">{children}</div>
    </div>,
    document.body,
  )
}
