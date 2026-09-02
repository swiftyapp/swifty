import { describe, it, expect } from 'vitest'
import { scoreText, scoreFields, rank } from './search'

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
    const items = [{ label: 'Toggle theme' }, { label: 'Lock vault' }, { label: 'New entry' }]
    expect(labels(rank(items, 'lock', fieldsOf))).toEqual(['Lock vault'])
  })

  it('keeps the input order for equal scores', () => {
    const items = [{ label: 'Lock vault' }, { label: 'Lock screen' }]
    expect(labels(rank(items, 'lock', fieldsOf))).toEqual(['Lock vault', 'Lock screen'])
  })

  it('returns everything for an empty query', () => {
    const items = [{ label: 'b' }, { label: 'a' }]
    expect(labels(rank(items, '', fieldsOf))).toEqual(['b', 'a'])
  })

  it('does not mutate the input', () => {
    const items = [{ label: 'b' }, { label: 'a' }]
    rank(items, 'a', fieldsOf)
    expect(labels(items)).toEqual(['b', 'a'])
  })
})
