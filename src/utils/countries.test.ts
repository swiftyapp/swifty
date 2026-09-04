import { describe, it, expect } from 'vitest'
import { countryName } from './countries'

// The document prints an alpha-3 code; the read view names the country beside
// it. Anything that is not a code has to come back undefined — the field is
// free text, and a wrong name is worse than none.
describe('countryName', () => {
  it('names an alpha-3 code in the asked-for language', () => {
    expect(countryName('UKR', 'en-US')).toBe('Ukraine')
    expect(countryName('GBR', 'en-US')).toBe('United Kingdom')
    expect(countryName('DEU', 'de-DE')).toBe('Deutschland')
  })

  it('takes the code in any case, with stray space', () => {
    expect(countryName('ukr', 'en-US')).toBe('Ukraine')
    expect(countryName(' Ukr ', 'en-US')).toBe('Ukraine')
  })

  it('is undefined for anything that is not an alpha-3 code', () => {
    expect(countryName('', 'en-US')).toBeUndefined()
    expect(countryName('XXX', 'en-US')).toBeUndefined()
    // alpha-2 is what `Intl` speaks, not what a passport prints.
    expect(countryName('UA', 'en-US')).toBeUndefined()
    expect(countryName('British passport', 'en-US')).toBeUndefined()
  })
})
