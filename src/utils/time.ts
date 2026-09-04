import { getLocale, t } from '@/i18n'
import { getFormat } from '@/defaults/dateFormat'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export const toTime = (iso?: string): number | null => {
  if (!iso) return null
  const at = Date.parse(iso)
  return Number.isNaN(at) ? null : at
}

/**
 * How long ago, as a duration and nothing else — '' past a week, where a
 * duration stops being worth counting. For callers that put the value in a
 * sentence ("changed {t} ago") and need to pick another phrasing instead.
 */
export const relativeDuration = (iso?: string, now: number = Date.now()): string => {
  const at = toTime(iso)
  if (at === null) return ''

  const elapsed = now - at
  if (elapsed < MINUTE) return 'now'
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m`
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h`
  if (elapsed < 7 * DAY) return `${Math.floor(elapsed / DAY)}d`
  return ''
}

export const relativeTime = (iso?: string, now: number = Date.now()): string => {
  const at = toTime(iso)
  if (at === null) return ''
  return relativeDuration(iso, now) || shortDate(at)
}

/**
 * The same ladder spelled out for a sentence rather than a list column: "2 days
 * ago", "9 minutes ago", and the date past a week. `Intl` owns the wording and
 * the plural rules, so no locale has to carry a key per unit.
 */
export const relativeLong = (iso?: string, now: number = Date.now()): string => {
  const at = toTime(iso)
  if (at === null) return ''

  const elapsed = now - at
  if (elapsed < MINUTE) return t('just now')
  const spell = new Intl.RelativeTimeFormat(getLocale(), { numeric: 'always' })
  if (elapsed < HOUR) return spell.format(-Math.floor(elapsed / MINUTE), 'minute')
  if (elapsed < DAY) return spell.format(-Math.floor(elapsed / HOUR), 'hour')
  if (elapsed < 7 * DAY) return spell.format(-Math.floor(elapsed / DAY), 'day')
  return shortDate(at)
}

const pad = (value: string | number) => String(value).padStart(2, '0')

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

// Local midnight of a stored `YYYY-MM-DD`, or null if it is not one. Built from
// the parts rather than parsed: `Date.parse` reads a date-only string as UTC,
// which lands on the day before west of Greenwich.
const isoDay = (iso: string): number | null => {
  const match = ISO_DATE.exec(iso.trim())
  if (!match) return null
  const [, year, month, day] = match
  return new Date(+year, +month - 1, +day).getTime()
}

/**
 * Whole days from today to a stored `YYYY-MM-DD` — negative once it is behind
 * us, null when it is not a date. Both ends are taken at local midnight, so the
 * answer is a count of days rather than of 24-hour blocks.
 */
export const daysUntil = (iso: string, now: number = Date.now()): number | null => {
  const at = isoDay(iso)
  if (at === null) return null
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  return Math.round((at - today.getTime()) / DAY)
}

/**
 * How far ahead a stored date is, as a sentence fragment: "in 2 years", "in 3
 * months", "in 12 days", "tomorrow". '' for a date behind us or no date at all.
 * `Intl` owns the wording and the plural rules, as it does for `relativeLong`.
 */
export const relativeFuture = (iso: string, now: number = Date.now()): string => {
  const days = daysUntil(iso, now)
  if (days === null || days < 0) return ''

  // Today and tomorrow read as words; everything past them counts, so a year
  // out is "in 1 year" and not the calendar's "next year".
  const spell = new Intl.RelativeTimeFormat(getLocale(), {
    numeric: days <= 1 ? 'auto' : 'always'
  })
  if (days >= 365) return spell.format(Math.floor(days / 365), 'year')
  // The average month, so the last days before a year read as 11 months and
  // not as a twelfth one.
  if (days >= 30) return spell.format(Math.floor(days / 30.44), 'month')
  return spell.format(days, 'day')
}

/**
 * A stored ISO `YYYY-MM-DD` date in the pattern picked in Settings › Language &
 * region. Anything else is passed through unchanged: a half-typed date is not a
 * date yet and has to keep reading as what was typed.
 *
 * Deliberately string-in / string-out — routing a date-only value through
 * `Date` parses it as UTC midnight and shows the day before west of Greenwich.
 */
export const formatDate = (iso: string): string => {
  const match = ISO_DATE.exec(iso.trim())
  if (!match) return iso
  const [, year, month, day] = match

  switch (getFormat()) {
    case 'DD.MM.YYYY':
      return `${day}.${month}.${year}`
    case 'YYYY-MM-DD':
      return `${year}-${month}-${day}`
    default:
      return `${month}/${day}/${year}`
  }
}

/**
 * The inverse: a date typed in the user's pattern (or already ISO) normalized to
 * `YYYY-MM-DD`, which is the only form that gets stored. Anything that isn't a
 * plausible date is left exactly as typed rather than silently dropped.
 */
export const toIsoDate = (value: string): string => {
  const parts = value.trim().split(/\D+/).filter(Boolean)
  if (parts.length !== 3) return value

  const format = getFormat()
  const [day, month, year] =
    format === 'DD.MM.YYYY'
      ? parts
      : format === 'YYYY-MM-DD'
        ? [parts[2], parts[1], parts[0]]
        : [parts[1], parts[0], parts[2]]

  const plausible =
    year.length === 4 && +month >= 1 && +month <= 12 && +day >= 1 && +day <= 31
  return plausible ? `${year}-${pad(month)}-${pad(day)}` : value
}

// Anything older than a week — and every explicit timestamp in the UI — is
// rendered in the pattern picked in Settings › Language & region.
export const shortDate = (at: number | Date): string => {
  const date = new Date(at)
  const year = String(date.getFullYear()).padStart(4, '0')
  return formatDate(`${year}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`)
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
