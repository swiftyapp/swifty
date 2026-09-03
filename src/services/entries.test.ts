import { describe, it, expect } from 'vitest'
import { filterEntries } from './entries'
import type { EntryMeta } from '@/lib/commands'

const login = (title: string, tags: string[] = [], urlHost = ''): EntryMeta =>
  ({ id: title, type: 'login', title, tags, urlHost, favorite: false })

const card = (title: string): EntryMeta =>
  ({ id: title, type: 'card', title, tags: [], urlHost: '', favorite: false })

describe('filterEntries', () => {
  const entries = [login('Google', ['personal']), login('Airbnb'), login('Facebook', ['personal'])]

  // Order without a query belongs to the list's own sort control, so this only
  // asserts membership.
  it('keeps every entry of the filtered kind', () => {
    expect(filterEntries(entries, { type: 'login', query: '' }).map(e => e.title)).toEqual(
      expect.arrayContaining(['Airbnb', 'Facebook', 'Google'])
    )
  })

  it('filters by kind', () => {
    const mixed = [...entries, card('Visa')]
    expect(filterEntries(mixed, { type: 'card', query: '' }).map(e => e.title)).toEqual(['Visa'])
  })

  it('keeps every kind when no kind filter is set', () => {
    const mixed = [...entries, card('Visa')]
    expect(filterEntries(mixed, { type: null, query: '' })).toHaveLength(4)
  })

  it('narrows a query to the filtered kind', () => {
    // "Visa" matches a card by title; under the login filter it is not offered.
    const mixed = [...entries, card('Visa')]
    expect(filterEntries(mixed, { type: 'login', query: 'visa' })).toEqual([])
    expect(filterEntries(mixed, { type: null, query: 'visa' }).map(e => e.title)).toEqual(
      ['Visa']
    )
  })

  it('filters by query', () => {
    expect(filterEntries(entries, { type: 'login', query: 'fa' }).map(e => e.title)).toEqual(['Facebook'])
  })

  it('matches metadata fields (site host, tags)', () => {
    // Secret fields (username/notes) live in the encrypted payload, so search
    // covers only the non-secret list metadata: title, url_host, tags.
    const items = [
      login('GitHub', [], 'github.com'),
      login('Bank', ['money'], 'bank.example')
    ]
    const q = (query: string) =>
      filterEntries(items, { type: 'login', query }).map(e => e.title)

    expect(q('github.com')).toEqual(['GitHub']) // url_host
    expect(q('money')).toEqual(['Bank']) // tag
  })

  it('is typo-tolerant (fuzzy)', () => {
    const items = [login('Facebook')]
    expect(filterEntries(items, { type: 'login', query: 'facbook' }).map(e => e.title)).toEqual(['Facebook'])
  })
})
