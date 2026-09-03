import { describe, it, expect } from 'vitest'
import { formatExpiry, splitExpiry } from './expiry'

describe('formatExpiry', () => {
  it('joins the stored pair, dropping a legacy 4-digit year', () => {
    expect(formatExpiry('04', '29')).toBe('04/29')
    expect(formatExpiry('04', '2029')).toBe('04/29')
  })

  it('leaves a month that is still being typed alone', () => {
    expect(formatExpiry('', '')).toBe('')
    expect(formatExpiry('1', '')).toBe('1')
    expect(formatExpiry('12', '')).toBe('12')
  })
})

describe('splitExpiry', () => {
  it('splits the box back into the pair', () => {
    expect(splitExpiry('12/30')).toEqual({ month: '12', year: '30' })
    expect(splitExpiry('1')).toEqual({ month: '1', year: '' })
  })

  // A pre-redesign card stores month "3" / year "2027". Without the pad the box
  // showed "3/27", which split back into month "32" on the first keystroke.
  it('round-trips a legacy unpadded month', () => {
    expect(splitExpiry(formatExpiry('3', '2027'))).toEqual({ month: '03', year: '27' })
  })
})
