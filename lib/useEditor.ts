'use client'
import { useCallback, useRef, useState } from 'react'
import { defaultScene, type Scene } from './scene'

type Updater = (s: Scene) => Scene
// Undo/redo over whole-scene snapshots. Calls sharing a coalesce key within 600 ms become one history step.
export function useEditor() {
  const [state, setState] = useState(() => ({ scene: defaultScene(), past: [] as Scene[], future: [] as Scene[] }))
  const last = useRef<{ key: string; at: number } | null>(null)

  const update = useCallback((fn: Updater, key?: string) => {
    setState((s) => {
      const next = fn(s.scene)
      if (next === s.scene) return s
      const now = Date.now()
      const merge = key && last.current?.key === key && now - last.current.at < 600
      last.current = key ? { key, at: now } : null
      return { scene: next, past: merge ? s.past : [...s.past.slice(-49), s.scene], future: [] }
    })
  }, [])
  const undo = useCallback(() => setState((s) => (s.past.length ? { scene: s.past[s.past.length - 1], past: s.past.slice(0, -1), future: [s.scene, ...s.future] } : s)), [])
  const redo = useCallback(() => setState((s) => (s.future.length ? { scene: s.future[0], past: [...s.past, s.scene], future: s.future.slice(1) } : s)), [])
  const reset = useCallback(() => update(() => defaultScene()), [update])
  return { scene: state.scene, update, undo, redo, reset, canUndo: state.past.length > 0, canRedo: state.future.length > 0 }
}
