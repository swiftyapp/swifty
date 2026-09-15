// The theme preference mirrored onto <html data-theme>, which drives the token
// swap in theme.css. The preference itself is a setting like any other and
// lives in the store (`settingsSlice`); this is only the part that touches the
// document and the OS.

import type { Theme, ThemePreference } from '@/api/app'

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

export const applyTheme = (next: ThemePreference): void => {
  document.documentElement.setAttribute('data-theme', resolveTheme(next))
}

// "System" has to keep following the OS, not just read it once at startup. Same
// guard as `prefersDark`: no matchMedia (jsdom) or a locked-down webview simply
// means the preference stops tracking, which is what it did before anyway.
export const watchSystemTheme = (onChange: () => void): void => {
  try {
    window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', onChange)
  } catch {
    // No subscription; "system" stays on whatever it resolved to at load.
  }
}
