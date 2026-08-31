import { openUrl } from '@tauri-apps/plugin-opener'
import { t } from '@/i18n'

// Only http/https are handed to the OS opener; anything else (file:, custom
// schemes, javascript:) is refused. Defense in depth with the scoped
// `opener:allow-open-url` capability.
export const openLink = (raw: string) => {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    window.alert(t('Invalid link'))
    return
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    window.alert(t('Only http and https links can be opened'))
    return
  }
  openUrl(url.href)
}
