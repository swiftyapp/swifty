import { describe, it, expect, afterEach } from 'vitest'
import { DEFAULT_DATE_FORMAT, setFormat, type DateFormat } from '@/defaults/dateFormat'
import { formatDate, relativeDuration, relativeTime, toIsoDate, toTime } from './time'

// A fixed "now" so every case is deterministic: 2024-03-14, midday local time.
const now = new Date(2024, 2, 14, 12, 0, 0).getTime()
const ago = (ms: number) => new Date(now - ms).toISOString()

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

describe('relativeTime', () => {
  it('is empty without a timestamp', () => {
    expect(relativeTime(undefined, now)).toBe('')
    expect(relativeTime('not-a-date', now)).toBe('')
  })

  it('reads "now" under a minute', () => {
    expect(relativeTime(ago(0), now)).toBe('now')
    expect(relativeTime(ago(59 * 1000), now)).toBe('now')
  })

  it('counts minutes, then hours, then days', () => {
    expect(relativeTime(ago(3 * MINUTE), now)).toBe('3m')
    expect(relativeTime(ago(59 * MINUTE), now)).toBe('59m')
    expect(relativeTime(ago(HOUR), now)).toBe('1h')
    expect(relativeTime(ago(23 * HOUR), now)).toBe('23h')
    expect(relativeTime(ago(2 * DAY), now)).toBe('2d')
    expect(relativeTime(ago(6 * DAY), now)).toBe('6d')
  })

  // Past a week the label becomes a real date, in the pattern chosen in
  // Settings › Language & region (MM/DD/YYYY by default).
  it('falls back to a formatted date past a week', () => {
    expect(relativeTime(new Date(2024, 2, 4, 9).toISOString(), now)).toBe('03/04/2024')
  })

  it('keeps the year on dates outside the current one', () => {
    expect(relativeTime(new Date(2023, 0, 12, 9).toISOString(), now)).toBe('01/12/2023')
  })
})

describe('relativeDuration', () => {
  it('counts the same ladder as relativeTime inside the week', () => {
    expect(relativeDuration(ago(0), now)).toBe('now')
    expect(relativeDuration(ago(3 * MINUTE), now)).toBe('3m')
    expect(relativeDuration(ago(3 * HOUR), now)).toBe('3h')
    expect(relativeDuration(ago(6 * DAY), now)).toBe('6d')
  })

  // A duration is all this returns, so past the week it returns nothing and
  // the caller phrases it as a date instead.
  it('is empty past a week, and without a timestamp', () => {
    expect(relativeDuration(ago(120 * DAY), now)).toBe('')
    expect(relativeDuration(undefined, now)).toBe('')
    expect(relativeDuration('not-a-date', now)).toBe('')
  })
})

describe('toTime', () => {
  it('parses or returns null', () => {
    expect(toTime('2024-03-14T00:00:00.000Z')).toBe(Date.parse('2024-03-14T00:00:00.000Z'))
    expect(toTime(undefined)).toBeNull()
    expect(toTime('nope')).toBeNull()
  })
})

// A stored date is ISO and a shown date is the user's pattern; the pair has to
// be a true round trip or an edit silently rewrites the date it was showing.
describe('formatDate / toIsoDate', () => {
  afterEach(() => setFormat(DEFAULT_DATE_FORMAT))

  const patterns: [DateFormat, string][] = [
    ['MM/DD/YYYY', '06/01/2035'],
    ['DD.MM.YYYY', '01.06.2035'],
    ['YYYY-MM-DD', '2035-06-01']
  ]

  it('reads an ISO date in every pattern, and back', () => {
    for (const [pattern, shown] of patterns) {
      setFormat(pattern)
      expect(formatDate('2035-06-01')).toBe(shown)
      expect(toIsoDate(shown)).toBe('2035-06-01')
      // Already-stored input is left alone rather than re-read as the pattern.
      expect(toIsoDate('2035-06-01')).toBe('2035-06-01')
    }
  })

  it('pads a date typed without leading zeros', () => {
    expect(toIsoDate('6/1/2035')).toBe('2035-06-01')
    expect(toIsoDate(' 6 / 1 / 2035 ')).toBe('2035-06-01')
  })

  // A half-typed date is not a date yet: it has to keep reading as what was
  // typed, in both directions, or the field fights the user mid-entry.
  it('passes anything that is not a date through unchanged', () => {
    expect(formatDate('')).toBe('')
    expect(formatDate('06/0')).toBe('06/0')
    expect(formatDate('2035-6-1')).toBe('2035-6-1')
    expect(toIsoDate('')).toBe('')
    expect(toIsoDate('06/0')).toBe('06/0')
    expect(toIsoDate('13/45/2035')).toBe('13/45/2035')
    expect(toIsoDate('06/01/35')).toBe('06/01/35')
  })
})
