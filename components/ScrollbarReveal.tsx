'use client'
import { useEffect } from 'react'

const HIDE_AFTER_MS = 900
const FADE = '--sb-alpha 0.3s ease'

/** While an element scrolls, adds `is-scrolling` to that element only (the scrollbar fades in); removes it shortly after it stops (fades out). */
export function ScrollbarReveal() {
  useEffect(() => {
    const timers = new Map<HTMLElement, ReturnType<typeof setTimeout>>()
    const onScroll = (e: Event) => {
      const t = e.target
      const el = t instanceof HTMLElement ? t : t === document ? document.documentElement : null
      if (!el) return
      if (el.style.transition !== FADE) el.style.transition = FADE
      el.classList.add('is-scrolling')
      clearTimeout(timers.get(el))
      timers.set(el, setTimeout(() => { el.classList.remove('is-scrolling'); timers.delete(el) }, HIDE_AFTER_MS))
    }
    document.addEventListener('scroll', onScroll, { capture: true, passive: true })
    return () => {
      document.removeEventListener('scroll', onScroll, { capture: true })
      timers.forEach((id, el) => { clearTimeout(id); el.classList.remove('is-scrolling') })
    }
  }, [])
  return null
}
