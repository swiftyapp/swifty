import { copyToClipboard } from '@/lib/commands'
import { getTimeout } from '@/defaults/clipboard'

const NOTIFICATION_TIMEOUT = 2000

// Copies a value and flashes the "Copied to Clipboard" notification.
export const copy = (value: string) => {
  // The backend clears after whatever it is handed, so 0 ("Never") has to reach
  // it as "no timeout at all" rather than "clear immediately".
  copyToClipboard(value, getTimeout() || undefined)
  const notification = document.getElementsByClassName('copied-notification')[0]
  if (!notification) return
  notification.classList.remove('hidden')
  setTimeout(() => notification.classList.add('hidden'), NOTIFICATION_TIMEOUT)
}
