import { describe, it, expect } from 'vitest'
import { DOC_TYPES } from '../templates'
import { CARD_PALETTES, coverOf, passportPalette } from './palette'

describe('CARD_PALETTES', () => {
  it('prints every card-shaped document', () => {
    for (const type of DOC_TYPES) {
      if (type === 'passport') continue
      expect(CARD_PALETTES[type]).toBeDefined()
    }
  })
})

describe('coverOf', () => {
  it('binds a passport in its country’s cover', () => {
    expect(coverOf('GBR')).toBe(coverOf('USA'))
    expect(coverOf('SAU')).not.toBe(coverOf('GBR'))
    expect(coverOf('NZL')).not.toBe(coverOf('GBR'))
  })

  // The country is free text: what someone typed, in whatever case.
  it('reads the code however it was typed', () => {
    expect(coverOf(' gbr ')).toBe(coverOf('GBR'))
  })

  // Burgundy is the EU's and the most common, so a country the table does not
  // name — and no country at all — gets that rather than nothing.
  it('falls back to burgundy', () => {
    expect(coverOf('DEU')).toBe(coverOf(''))
    expect(coverOf('Narnia')).toBe(coverOf('DEU'))
  })
})

describe('passportPalette', () => {
  it('changes only the cover with the country', () => {
    const { band: gb, ...gbPage } = passportPalette('GBR')
    const { band: de, ...dePage } = passportPalette('DEU')
    expect(gb).not.toBe(de)
    expect(gbPage).toEqual(dePage)
  })
})
