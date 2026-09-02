const KEY = 'swifty:autolockSecs'

export const DEFAULT_AUTOLOCK_SECS = 60

export const getSecs = (): number => {
  const stored = localStorage.getItem(KEY)
  const value = stored ? Number(stored) : NaN
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_AUTOLOCK_SECS
}

export const setSecs = (secs: number) => localStorage.setItem(KEY, String(secs))
