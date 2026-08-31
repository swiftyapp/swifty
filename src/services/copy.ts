import { copyToClipboard } from '@/lib/commands'
import { getTimeout } from '@/defaults/clipboard'

const NOTIFICATION_TIMEOUT = 2000

// Copies a value and flashes the "Copied to Clipboard" notification.
export const copy = (value: string) => {
  copyToClipboard(value, getTimeout())
  const notification = document.getElementsByClassName('copied-notification')[0]
  if (!notification) return
  notification.classList.remove('hidden')
  setTimeout(() => notification.classList.add('hidden'), NOTIFICATION_TIMEOUT)
}
