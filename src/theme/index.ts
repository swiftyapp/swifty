// Theme preference (light default, dark opt-in, or follow the OS). Persisted to
// localStorage and mirrored onto <html data-theme>, which drives the token swap
// in theme.css. Mirrors the module-level pattern used by i18n for `locale`.

export type Theme = 'light' | 'dark'
export type ThemePreference = Theme | 'system'

const STORAGE_KEY = 'theme'
const DEFAULT_PREFERENCE: ThemePreference = 'light'

const isPreference = (value: string | null): value is ThemePreference =>
  value === 'light' || value === 'dark' || value === 'system'

const readInitial = (): ThemePreference => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return isPreference(saved) ? saved : DEFAULT_PREFERENCE
  } catch {
    return DEFAULT_PREFERENCE
  }
}

let preference: ThemePreference = readInitial()

// jsdom ships no matchMedia, and a locked-down webview can throw; either way
// "system" degrades to light rather than crashing the render.
export const prefersDark = (): boolean => {
  try {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
  } catch {
    return false
  }
}

export const resolveTheme = (next: ThemePreference): Theme =>
  next === 'system' ? (prefersDark() ? 'dark' : 'light') : next

export const getTheme = (): ThemePreference => preference

// Reflect the theme onto the document root so the CSS token overrides apply.
export const applyTheme = (next: ThemePreference): void => {
  document.documentElement.setAttribute('data-theme', resolveTheme(next))
}

export const setTheme = (next: ThemePreference): void => {
  preference = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // Storage can be unavailable (private mode / disabled); theme still applies
    // for this session, it just won't persist.
  }
  applyTheme(next)
}
