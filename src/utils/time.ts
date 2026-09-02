import { getLocale } from '@/i18n'
import { getFormat } from '@/defaults/dateFormat'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export const toTime = (iso?: string): number | null => {
  if (!iso) return null
  const at = Date.parse(iso)
  return Number.isNaN(at) ? null : at
}

export const relativeTime = (iso?: string, now: number = Date.now()): string => {
  const at = toTime(iso)
  if (at === null) return ''

  const elapsed = now - at
  if (elapsed < MINUTE) return 'now'
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m`
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h`
  if (elapsed < 7 * DAY) return `${Math.floor(elapsed / DAY)}d`
  return shortDate(at)
}

const pad = (value: number) => String(value).padStart(2, '0')

// Anything older than a week — and every explicit timestamp in the UI — is
// rendered in the pattern picked in Settings › Language & region.
export const shortDate = (at: number | Date): string => {
  const date = new Date(at)
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())

  switch (getFormat()) {
    case 'DD.MM.YYYY':
      return `${day}.${month}.${year}`
    case 'YYYY-MM-DD':
      return `${year}-${month}-${day}`
    default:
      return `${month}/${day}/${year}`
  }
}

export const dateTime = (iso?: string): string => {
  const at = toTime(iso)
  if (at === null) return '—'
  const time = new Date(at).toLocaleTimeString(getLocale(), {
    hour: '2-digit',
    minute: '2-digit'
  })
  return `${shortDate(at)} ${time}`
}
