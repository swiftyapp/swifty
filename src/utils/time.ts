import { getLocale } from '@/i18n'

// Compact timestamps for list rows, in the prototype's shape: "3m", "1h", "2d",
// then a short localized date ("Mar 4") once something is more than a week old.

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

// An ISO timestamp -> epoch ms, or null when it is missing or unparseable.
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
  return shortDate(at, now)
}

// "Mar 4" within the current year, "Mar 4, 2023" before it.
const shortDate = (at: number, now: number): string => {
  const date = new Date(at)
  const sameYear = date.getFullYear() === new Date(now).getFullYear()
  return date.toLocaleDateString(getLocale(), {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' })
  })
}

export type Recency = 'Today' | 'Yesterday' | 'This week' | 'Earlier'

export const RECENCY: Recency[] = ['Today', 'Yesterday', 'This week', 'Earlier']

// Calendar-day buckets (not rolling 24h windows), so "Yesterday" means the
// previous day on the clock. Anything undated falls to the bottom bucket.
export const recencyBucket = (iso?: string, now: number = Date.now()): Recency => {
  const at = toTime(iso)
  if (at === null) return 'Earlier'

  const days = Math.round((startOfDay(now) - startOfDay(at)) / DAY)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return 'This week'
  return 'Earlier'
}

const startOfDay = (ms: number): number => {
  const date = new Date(ms)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}
