import { copyToClipboard } from '@/api/tools'
import { getTimeout } from '@/defaults/clipboard'
import { flashCopied } from '@/store'

// Copies a value and flashes the "Copied to Clipboard" notification.
export const copy = (value: string) => {
  // The backend clears after whatever it is handed, so 0 ("Never") has to reach
  // it as "no timeout at all" rather than "clear immediately".
  copyToClipboard(value, getTimeout() || undefined)
  flashCopied()
}
