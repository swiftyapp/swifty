import { openUrl } from '@tauri-apps/plugin-opener'

// Only http/https are handed to the OS opener; anything else (file:, custom
// schemes, javascript:) is refused. Defense in depth with the scoped
// `opener:allow-open-url` capability.
export const isOpenableUrl = (raw: string): boolean => {
  try {
    const { protocol } = new URL(raw)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

// Call sites hide the affordance for a link that fails the check, so an
// unopenable URL getting this far is a bug, not something to tell the user
// about: it stays a no-op.
export const openLink = (raw: string) => {
  if (isOpenableUrl(raw)) openUrl(new URL(raw).href)
}
