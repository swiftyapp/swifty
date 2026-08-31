import { describe, it, expect } from 'vitest'
import { filterEntries, isValid } from './entries'
import type { EntryMeta } from '@/lib/commands'

const login = (title: string, tags: string[] = [], urlHost = ''): EntryMeta =>
  ({ id: title, type: 'login', title, tags, urlHost })

const card = (title: string): EntryMeta => ({ id: title, type: 'card', title, tags: [], urlHost: '' })

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

  it('matches metadata fields (site host, tags)', () => {
    // Secret fields (username/notes) live in the encrypted payload, so search
    // covers only the non-secret list metadata: title, url_host, tags.
    const items = [
      login('GitHub', [], 'github.com'),
      login('Bank', ['money'], 'bank.example')
    ]
    const q = (query: string) =>
      filterEntries(items, { scope: 'login', query, tags: [] }).map(e => e.title)

    expect(q('github.com')).toEqual(['GitHub']) // url_host
    expect(q('money')).toEqual(['Bank']) // tag
  })

  it('is typo-tolerant (fuzzy)', () => {
    const items = [login('Facebook')]
    expect(filterEntries(items, { scope: 'login', query: 'facbook', tags: [] }).map(e => e.title)).toEqual(['Facebook'])
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

  it('saves a card without a PIN', () => {
    expect(isValid({ type: 'card', title: 'T', number: '1', cvc: '1', month: '1', year: '1' })).toBe(true)
  })
})
