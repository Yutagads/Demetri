import { useEffect, useState } from 'react'

export const KIOSK_MODE_KEY = 'smartclass-kiosk-mode'
const KIOSK_MODE_EVENT = 'smartclass:kiosk-mode-change'

export function getKioskMode(): boolean {
  try {
    return window.localStorage.getItem(KIOSK_MODE_KEY) === 'true'
  } catch {
    return false
  }
}

export function setKioskMode(enabled: boolean) {
  try {
    if (enabled) window.localStorage.setItem(KIOSK_MODE_KEY, 'true')
    else window.localStorage.removeItem(KIOSK_MODE_KEY)
  } catch {
    // Kiosk mode still works for the current view if storage is unavailable.
  }

  window.dispatchEvent(new CustomEvent(KIOSK_MODE_EVENT, { detail: enabled }))
}

export function useKioskMode() {
  const [enabled, setEnabled] = useState(getKioskMode)

  useEffect(() => {
    const sync = () => setEnabled(getKioskMode())
    window.addEventListener(KIOSK_MODE_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(KIOSK_MODE_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  return enabled
}