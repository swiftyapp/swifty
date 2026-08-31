// Theme preference (light default, dark opt-in). Persisted to localStorage and
// mirrored onto <html data-theme>, which drives the token swap in theme.css.
// Mirrors the module-level pattern used by i18n for `locale`.

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'theme'
const DEFAULT_THEME: Theme = 'light'

const readInitial = (): Theme => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved === 'dark' || saved === 'light' ? saved : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

let theme: Theme = readInitial()

export const getTheme = (): Theme => theme

// Reflect the theme onto the document root so the CSS token overrides apply.
export const applyTheme = (next: Theme): void => {
  document.documentElement.setAttribute('data-theme', next)
}

export const setTheme = (next: Theme): void => {
  theme = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // Storage can be unavailable (private mode / disabled); theme still applies
    // for this session, it just won't persist.
  }
  applyTheme(next)
}
