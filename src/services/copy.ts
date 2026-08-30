import { copyToClipboard } from '@/lib/commands'

const CLIPBOARD_TIMEOUT = 60000
const NOTIFICATION_TIMEOUT = 2000

// Copies a value and flashes the "Copied to Clipboard" notification.
export const copy = (value: string) => {
  copyToClipboard(value, CLIPBOARD_TIMEOUT)
  const notification = document.getElementsByClassName('copied-notification')[0]
  if (!notification) return
  notification.classList.remove('hidden')
  setTimeout(() => notification.classList.add('hidden'), NOTIFICATION_TIMEOUT)
}
