const KEY = 'swifty:clipboardTimeout'

// How long a copied secret lingers before the clipboard is cleared (ms).
export const DEFAULT_CLIPBOARD_TIMEOUT = 20000

export const getTimeout = (): number => {
  const stored = localStorage.getItem(KEY)
  const value = stored ? Number(stored) : NaN
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_CLIPBOARD_TIMEOUT
}

export const setTimeout = (ms: number) => localStorage.setItem(KEY, String(ms))
