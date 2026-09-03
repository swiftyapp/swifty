import { describe, it, expect } from 'vitest'
import { relativeDuration, relativeTime, toTime } from './time'

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
