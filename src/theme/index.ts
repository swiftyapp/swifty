// Resolving a theme preference onto <html data-theme>, which drives the token
// swap in theme.css. The preference itself lives in the prefs store
// (`store/prefs`), which applies it here whenever it changes.

export type Theme = 'light' | 'dark'
export type ThemePreference = Theme | 'system'

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

// Reflect the theme onto the document root so the CSS token overrides apply.
export const applyTheme = (next: ThemePreference): void => {
  document.documentElement.setAttribute('data-theme', resolveTheme(next))
}
