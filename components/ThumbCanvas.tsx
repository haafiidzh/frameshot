'use client'
import { useEffect, useRef } from 'react'
import { renderScene } from '@/lib/render'
import type { Scene } from '@/lib/scene'

// Small live preview rendered by the same renderer as the main canvas.
export default function ThumbCanvas({ scene, width, label }: { scene: Scene; width: number; label?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const key = JSON.stringify(scene)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const id = requestAnimationFrame(() => renderScene(el, scene, (width * 2) / scene.canvas.w))
    return () => cancelAnimationFrame(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, width])
  const aspect = scene.canvas.w / scene.canvas.h
  return <canvas ref={ref} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} style={{ width, height: width / aspect, maxWidth: '100%', maxHeight: '100%' }} />
}
