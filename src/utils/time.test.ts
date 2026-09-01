import { describe, it, expect } from 'vitest'
import { relativeTime, recencyBucket, toTime } from './time'

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

  it('falls back to a short date past a week', () => {
    expect(relativeTime(new Date(2024, 2, 4, 9).toISOString(), now)).toBe('Mar 4')
  })

  it('keeps the year on dates outside the current one', () => {
    expect(relativeTime(new Date(2023, 0, 12, 9).toISOString(), now)).toBe('Jan 12, 2023')
  })
})

describe('recencyBucket', () => {
  it('buckets by calendar day', () => {
    expect(recencyBucket(new Date(2024, 2, 14, 1).toISOString(), now)).toBe('Today')
    expect(recencyBucket(new Date(2024, 2, 13, 23).toISOString(), now)).toBe('Yesterday')
    expect(recencyBucket(new Date(2024, 2, 10, 12).toISOString(), now)).toBe('This week')
    expect(recencyBucket(new Date(2024, 1, 20, 12).toISOString(), now)).toBe('Earlier')
  })

  it('treats an hour-old entry from yesterday as Yesterday', () => {
    // 13h ago is still the previous calendar day, not a rolling 24h window.
    expect(recencyBucket(ago(13 * HOUR), now)).toBe('Yesterday')
  })

  it('sends undated entries to Earlier', () => {
    expect(recencyBucket(undefined, now)).toBe('Earlier')
  })
})

describe('toTime', () => {
  it('parses or returns null', () => {
    expect(toTime('2024-03-14T00:00:00.000Z')).toBe(Date.parse('2024-03-14T00:00:00.000Z'))
    expect(toTime(undefined)).toBeNull()
    expect(toTime('nope')).toBeNull()
  })
})
