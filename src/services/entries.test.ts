import { describe, it, expect } from 'vitest'
import { filterEntries, isValid } from './entries'
import type { Entry } from '@/lib/commands'

const login = (title: string, tags?: string[]): Entry =>
  ({ id: title, type: 'login', title, username: 'u', password: 'p', tags }) as Entry

const card = (title: string): Entry =>
  ({ id: title, type: 'card', title, number: '4242' }) as Entry

describe('filterEntries', () => {
  const entries = [login('Google', ['personal']), login('Airbnb'), login('Facebook', ['personal'])]

  it('sorts by title', () => {
    expect(filterEntries(entries, { scope: 'login', query: '', tags: [] }).map(e => e.title)).toEqual([
      'Airbnb',
      'Facebook',
      'Google'
    ])
  })

  it('filters by scope', () => {
    const mixed = [...entries, card('Visa')]
    expect(filterEntries(mixed, { scope: 'card', query: '', tags: [] }).map(e => e.title)).toEqual(['Visa'])
  })

  it('filters by query', () => {
    expect(filterEntries(entries, { scope: 'login', query: 'fa', tags: [] }).map(e => e.title)).toEqual(['Facebook'])
  })

  it('filters by tag', () => {
    expect(filterEntries(entries, { scope: 'login', query: '', tags: ['personal'] }).map(e => e.title)).toEqual([
      'Facebook',
      'Google'
    ])
  })
})

describe('isValid', () => {
  it('validates a login', () => {
    expect(isValid({ type: 'login', title: 'T', username: 'u', password: 'p' })).toBe(true)
    expect(isValid({ type: 'login', title: 'T', username: '', password: 'p' })).toBe(false)
  })

  it('validates a note', () => {
    expect(isValid({ type: 'note', title: 'T', note: 'body' })).toBe(true)
    expect(isValid({ type: 'note', title: 'T', note: '' })).toBe(false)
  })

  it('validates a card', () => {
    expect(
      isValid({ type: 'card', title: 'T', number: '1', pin: '1', cvc: '1', month: '1', year: '1' })
    ).toBe(true)
    expect(isValid({ type: 'card', title: 'T', number: '1' })).toBe(false)
  })
})
