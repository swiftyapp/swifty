import { describe, it, expect } from 'vitest'
import type { EntryMeta } from '@/api/types'
import { listSubtitle } from './meta'

const meta = (overrides: Partial<EntryMeta> = {}): EntryMeta => ({
  id: '1',
  type: 'login',
  title: 'Google',
  tags: [],
  urlHost: 'google.com',
  favorite: false,
  ...overrides
})

describe('login listSubtitle', () => {
  it('names the account by its username', () => {
    expect(listSubtitle(meta({ username: 'alex@example.com' }))).toBe('alex@example.com')
  })

  it('falls back to the host for a row not yet stamped', () => {
    expect(listSubtitle(meta())).toBe('google.com')
    expect(listSubtitle(meta({ username: '' }))).toBe('google.com')
  })
})
