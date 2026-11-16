'use client'
import { useEffect, useId, useMemo, useRef, useState, type RefObject } from 'react'
import { Maximize2, Search, X } from 'lucide-react'
import { CHANGELOG } from '@/lib/changelog'
import type { ThemeChoice } from '@/lib/useTheme'
import { Modal, Popover, Segmented, Switch, cx } from './ui'

export interface Command { id: string; label: string; group: string; hint?: string; run: () => void }

export function CommandPalette({ open, onClose, commands }: { open: boolean; onClose: () => void; commands: Command[] }) {
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const listId = useId()
  const listRef = useRef<HTMLUListElement>(null)
  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean)
    return commands.filter((c) => words.every((w) => `${c.label} ${c.group} ${c.hint ?? ''}`.toLowerCase().includes(w)))
  }, [q, commands])
  useEffect(() => { if (open) { setQ(''); setActive(0) } }, [open])
  useEffect(() => { setActive(0) }, [q])
  useEffect(() => { listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }) }, [active])
  const run = (c?: Command) => { if (!c) return; onClose(); setTimeout(c.run, 0) }
  return (
    <Modal open={open} onClose={onClose} label="Commands" width={560}>
      <div className="flex items-center gap-2 rounded-md bg-surface-sunken px-3">
        <Search size={16} aria-hidden className="text-muted" />
        <input data-autofocus role="combobox" aria-expanded="true" aria-controls={listId} aria-activedescendant={shown[active] ? `${listId}-${shown[active].id}` : undefined} aria-label="Type a command" autoComplete="off" placeholder="Type a command, for example export"
          value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(shown.length - 1, i + 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)) }
            else if (e.key === 'Enter') { e.preventDefault(); run(shown[active]) }
          }}
          className="h-11 min-w-0 flex-1 bg-transparent text-base text-text placeholder:text-muted focus:outline-none" />
        <button type="button" aria-label="Close commands" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-pill text-muted hover:text-text"><X size={16} aria-hidden /></button>
      </div>
      <ul ref={listRef} id={listId} role="listbox" aria-label="Commands" className="scroll-thin mt-2 max-h-80 overflow-y-auto">
        {shown.length === 0 && <li role="presentation" className="p-4 text-center text-sm text-muted">Nothing matches. Try a shorter word.</li>}
        {shown.map((c, i) => (
          <li key={c.id} id={`${listId}-${c.id}`} role="option" aria-selected={i === active} onMouseMove={() => setActive(i)} onClick={() => run(c)}
            className={cx('flex cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2', i === active ? 'bg-surface-sunken' : '')}>
            <span><span className="block text-base font-semibold">{c.label}</span>{c.hint && <span className="block text-xs text-muted">{c.hint}</span>}</span>
            <span className="shrink-0 text-xs text-muted">{c.group}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">Up and down to move, Enter to run, Esc to close.</p>
    </Modal>
  )
}

export function WhatsNew({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} label="What is new" width={520}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">What is new</h2>
        <button type="button" data-autofocus aria-label="Close what is new" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-pill hover:bg-surface-sunken"><X size={16} aria-hidden /></button>
      </div>
      <div className="scroll-thin mt-3 max-h-96 space-y-4 overflow-y-auto pr-1">
        {CHANGELOG.map((e) => (
          <section key={e.title} aria-label={e.title}>
            <h3 className="text-base font-semibold">{e.title} <span className="text-sm font-normal text-muted">{e.date}</span></h3>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{e.items.map((i) => <li key={i}>{i}</li>)}</ul>
          </section>
        ))}
      </div>
    </Modal>
  )
}

export function MainMenu({ open, onClose, anchor, theme, setTheme, perf, setPerf, onFullscreen, onWhatsNew, onCommands }: {
  open: boolean; onClose: () => void; anchor: RefObject<HTMLElement | null>; theme: ThemeChoice; setTheme: (t: ThemeChoice) => void
  perf: boolean; setPerf: (v: boolean) => void; onFullscreen: () => void; onWhatsNew: () => void; onCommands: () => void
}) {
  return (
    <Popover open={open} onClose={onClose} anchor={anchor} label="Menu" width={280}>
      <div className="space-y-3">
        <button type="button" onClick={() => { onClose(); onWhatsNew() }} className="h-10 w-full rounded-md bg-surface-sunken text-left text-sm font-semibold px-3">What is new</button>
        <button type="button" onClick={() => { onClose(); onCommands() }} className="flex h-10 w-full items-center justify-between rounded-md bg-surface-sunken px-3 text-sm font-semibold">Commands <kbd className="text-xs text-muted">Ctrl K</kbd></button>
        <div>
          <p className="mb-1 text-xs font-semibold text-muted">Appearance</p>
          <Segmented<ThemeChoice> value={theme} onChange={setTheme} role="radiogroup" label="Appearance" options={[{ id: 'system', label: <span className="text-sm">System</span> }, { id: 'light', label: <span className="text-sm">Light</span> }, { id: 'dark', label: <span className="text-sm">Dark</span> }]} />
        </div>
        <Switch label="Performance mode" hint="Lighter preview while you work. Exports stay full quality." checked={perf} onChange={setPerf} />
        <button type="button" onClick={() => { onClose(); onFullscreen() }} className="flex h-10 w-full items-center gap-2 rounded-md bg-surface-sunken px-3 text-sm font-semibold"><Maximize2 size={16} aria-hidden />Full-screen preview</button>
      </div>
    </Popover>
  )
}
