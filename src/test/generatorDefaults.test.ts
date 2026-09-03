import { describe, it, expect, beforeEach } from 'vitest'
import { getProps, setProps } from '@/defaults/generator'

const KEY = 'swifty:generatorDefaults'

const DEFAULTS = {
  length: 20,
  numbers: true,
  symbols: true,
  uppercase: true,
  exclude: ''
}

beforeEach(() => localStorage.clear())

describe('generator defaults', () => {
  it('falls back to the defaults when nothing is stored', () => {
    expect(getProps()).toEqual(DEFAULTS)
  })

  it('does not write on read', () => {
    getProps()
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('survives a corrupt blob', () => {
    localStorage.setItem(KEY, '{')
    expect(getProps()).toEqual(DEFAULTS)
  })

  it('merges a partial blob over the defaults', () => {
    localStorage.setItem(KEY, '{"symbols":false}')
    expect(getProps()).toEqual({ ...DEFAULTS, symbols: false })
  })

  it('replaces a non-numeric length', () => {
    localStorage.setItem(KEY, '{"length":"nope"}')
    expect(getProps().length).toBe(20)
  })

  it('round-trips what it writes', () => {
    setProps({ ...DEFAULTS, length: 32, excludeSimilarCharacters: true })
    expect(getProps()).toEqual({ ...DEFAULTS, length: 32, excludeSimilarCharacters: true })
  })
})
