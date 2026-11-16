'use client'
import { useCallback, useEffect, useState } from 'react'

export type ThemeChoice = 'system' | 'light' | 'dark'
export const THEME_KEY = 'franneshot-theme'

const read = (): ThemeChoice => {
  try { const v = window.localStorage.getItem(THEME_KEY); return v === 'light' || v === 'dark' ? v : 'system' } catch { return 'system' }
}

/** Light, dark or follow the system. The choice is remembered on this device (never sent anywhere). */
export function useTheme() {
  const [theme, setThemeState] = useState<ThemeChoice>('system')
  useEffect(() => { setThemeState(read()) }, [])
  const setTheme = useCallback((t: ThemeChoice) => {
    setThemeState(t)
    if (t === 'system') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t)
    try { if (t === 'system') window.localStorage.removeItem(THEME_KEY); else window.localStorage.setItem(THEME_KEY, t) } catch { /* private mode: the choice just lasts for this visit */ }
  }, [])
  return { theme, setTheme }
}
