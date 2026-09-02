import { describe, it, expect } from 'vitest'
import { scoreText, scoreFields, rank, searchEntries } from './search'
import type { EntryMeta } from '@/lib/commands'

const login = (title: string, urlHost = '', tags: string[] = []): EntryMeta => ({
  id: title,
  type: 'login',
  title,
  tags,
  urlHost
})

describe('scoreText', () => {
  it('matches everything on an empty query', () => {
    expect(scoreText('GitHub', '')).toBe(0)
  })

  it('returns null when the query is absent', () => {
    expect(scoreText('GitHub', 'zzz')).toBeNull()
    expect(scoreText('', 'g')).toBeNull()
  })

  it('is case-insensitive', () => {
    expect(scoreText('GitHub', 'github')).toBe(scoreText('github', 'GITHUB'))
  })

  it('ranks a prefix above a substring above a subsequence', () => {
    const prefix = scoreText('bastion-prod', 'bast')!
    const substring = scoreText('prod-bastion', 'bast')!
    const subsequence = scoreText('backup station', 'bast')!

    expect(prefix).toBeGreaterThan(substring)
    expect(substring).toBeGreaterThan(subsequence)
  })

  it('prefers an earlier substring', () => {
    expect(scoreText('a-key', 'key')!).toBeGreaterThan(scoreText('a-long-key', 'key')!)
  })

  it('prefers a tighter subsequence span', () => {
    expect(scoreText('abc', 'ac')!).toBeGreaterThan(scoreText('a-------c', 'ac')!)
  })

  it('requires subsequence characters in order', () => {
    expect(scoreText('abc', 'ca')).toBeNull()
  })
})

describe('scoreFields', () => {
  it('takes the best field', () => {
    const fields = [{ text: 'nope' }, { text: 'github' }]
    expect(scoreFields(fields, 'git')).toBe(scoreText('github', 'git'))
  })

  it('returns null when no field matches', () => {
    expect(scoreFields([{ text: 'a' }, { text: 'b' }], 'z')).toBeNull()
  })

  it('weights fields', () => {
    const heavy = scoreFields([{ text: 'git', weight: 3 }], 'git')!
    const light = scoreFields([{ text: 'git', weight: 1 }], 'git')!
    expect(heavy).toBe(light * 3)
  })
})

describe('rank', () => {
  const labels = (items: { label: string }[]) => items.map(item => item.label)
  const fieldsOf = (item: { label: string }) => [{ text: item.label }]

  it('drops non-matches and orders by score', () => {
    const items = [{ label: 'Toggle theme' }, { label: 'Lock vault' }, { label: 'Add a secret' }]
    expect(labels(rank(items, 'lock', fieldsOf))).toEqual(['Lock vault'])
  })

  it('keeps the input order for equal scores', () => {
    const items = [{ label: 'Lock vault' }, { label: 'Lock vault after' }]
    expect(labels(rank(items, 'lock', fieldsOf))).toEqual(['Lock vault', 'Lock vault after'])
  })

  it('returns everything for an empty query', () => {
    const items = [{ label: 'b' }, { label: 'a' }]
    expect(labels(rank(items, '', fieldsOf))).toEqual(['b', 'a'])
  })
})

describe('searchEntries', () => {
  const entries = [
    login('Google', 'google.com'),
    login('Airbnb', 'airbnb.com', ['travel']),
    login('GitHub', 'github.com', ['work'])
  ]

  it('sorts alphabetically with no query', () => {
    expect(searchEntries(entries, '').map(e => e.title)).toEqual(['Airbnb', 'GitHub', 'Google'])
  })

  it('matches the title', () => {
    expect(searchEntries(entries, 'git').map(e => e.title)).toEqual(['GitHub'])
  })

  it('matches the site host and tags', () => {
    expect(searchEntries(entries, 'airbnb.com').map(e => e.title)).toEqual(['Airbnb'])
    expect(searchEntries(entries, 'travel').map(e => e.title)).toEqual(['Airbnb'])
  })

  it('ranks a title hit above a tag hit', () => {
    const items = [login('Bank', 'bank.example', ['work']), login('Work log', '')]
    expect(searchEntries(items, 'work').map(e => e.title)).toEqual(['Work log', 'Bank'])
  })

  it('tolerates gaps (subsequence)', () => {
    expect(searchEntries(entries, 'ggl').map(e => e.title)).toEqual(['Google'])
  })

  it('does not mutate the input', () => {
    const items = [login('B'), login('A')]
    searchEntries(items, '')
    expect(items.map(e => e.title)).toEqual(['B', 'A'])
  })
})
