import { describe, it, expect } from 'vitest'
import type { IdentityKey } from '../templates'
import type { Doc } from './DocCell'
import { checkDigit, mrz } from './mrz'

// The specimen holder ICAO 9303 uses throughout its own examples, so the bands
// below can be compared against the printed standard character for character.
const ANNA: Partial<Record<IdentityKey, string>> = {
  name: 'ERIKSSON ANNA MARIA',
  country: 'UTO',
  nationality: 'UTO',
  birth_date: '1974-08-12',
  sex: 'F',
  expiry_date: '2012-04-15'
}

const doc = (fields: Partial<Record<IdentityKey, string>>, shown = true): Doc => ({
  value: key => fields[key] ?? '',
  shown,
  toggle: () => {}
})

describe('checkDigit', () => {
  // The digits printed on ICAO's own specimens for these fields.
  it('weights the field 7-3-1 and takes the remainder', () => {
    expect(checkDigit('L898902C3')).toBe('6')
    expect(checkDigit('D23145890')).toBe('7')
    expect(checkDigit('740812')).toBe('2')
    expect(checkDigit('120415')).toBe('9')
  })

  it('counts the filler as nothing', () => {
    expect(checkDigit('<<<<<<')).toBe('0')
  })
})

describe('mrz', () => {
  it('prints a passport as TD3', () => {
    const lines = mrz('passport', doc({ ...ANNA, number: 'L898902C3', personal_number: 'ZE184226B' }))

    expect(lines).toEqual([
      'P<UTOERIKSSON<ANNA<MARIA<<<<<<<<<<<<<<<<<<<<',
      'L898902C36UTO7408122F1204159ZE184226B<<<<<10'
    ])
  })

  it('prints an ID card as TD1', () => {
    const lines = mrz('id_card', doc({ ...ANNA, number: 'D23145890' }))

    expect(lines).toEqual([
      'I<UTOD231458907<<<<<<<<<<<<<<<',
      '7408122F1204159UTO<<<<<<<<<<<6',
      'ERIKSSON<ANNA<MARIA<<<<<<<<<<<'
    ])
  })

  it('marks a residence permit with its own document code', () => {
    const permit = mrz('residence_permit', doc({ ...ANNA, number: 'D23145890' }))
    expect(permit?.[0].slice(0, 2)).toBe('IR')
  })

  // Every line is a fixed width; a value too long for its column is cut and a
  // short one padded, so the columns after it never shift.
  it('holds each format to its width', () => {
    const long = { ...ANNA, name: 'X'.repeat(80), number: '1234567890123' }
    expect(mrz('passport', doc(long))?.every(line => line.length === 44)).toBe(true)
    expect(mrz('id_card', doc(long))?.every(line => line.length === 30)).toBe(true)
  })

  it('prints filler rather than a wrong date for a date not yet typed', () => {
    const lines = mrz('passport', doc({ ...ANNA, expiry_date: '2012-0', number: 'L898902C3' }))
    expect(lines?.[1].slice(21, 27)).toBe('<<<<<<')
  })

  // Upper-casing before the filter is what expands the eszett, which is the
  // substitution ICAO asks for — the same as its own ß → SS.
  it('folds an accented name onto the letters the band has', () => {
    const lines = mrz('id_card', doc({ ...ANNA, name: 'Zoë Müller-Voß', number: 'D23145890' }))
    expect(lines?.[2]).toBe('ZOE<MULLER<VOSS<<<<<<<<<<<<<<<')
  })

  it('lends the issuing country as the nationality when there is none', () => {
    const lines = mrz('passport', doc({ ...ANNA, nationality: '', number: 'L898902C3' }))
    expect(lines?.[1].slice(10, 13)).toBe('UTO')
  })

  it('has no band for a licence or an unclassified document', () => {
    expect(mrz('driver_license', doc(ANNA))).toBeNull()
    expect(mrz('other', doc(ANNA))).toBeNull()
  })

  /*
   * The document number and the personal number are the vault's two encrypted
   * identity fields. A band that printed them while the face masks them would
   * hand both straight back — and so would a check digit computed over them,
   * which is why the digits go under the mask with the fields they cover.
   */
  describe('while the number is masked', () => {
    const secrets = { number: 'L898902C3', personal_number: 'ZE184226B' }

    it('prints neither secret nor any digit derived from one, on TD3', () => {
      const [, line] = mrz('passport', doc({ ...ANNA, ...secrets }, false)) ?? []
      const open = mrz('passport', doc({ ...ANNA, ...secrets }))?.[1] ?? ''

      expect(line).toBe('••••••••••UTO7408122F1204159••••••••••••••••')
      // Whatever is still legible is legible on the revealed band too: the mask
      // only ever covers, it never rewrites what it leaves showing.
      expect(line).toHaveLength(open.length)
      expect(line?.slice(10, 28)).toBe(open.slice(10, 28))
    })

    it('prints neither secret nor any digit derived from one, on TD1', () => {
      const lines = mrz('id_card', doc({ ...ANNA, ...secrets, number: 'D23145890' }, false))

      expect(lines).toEqual([
        'I<UTO•••••••••••••••••••••••••',
        '7408122F1204159UTO<<<<<<<<<<<•',
        'ERIKSSON<ANNA<MARIA<<<<<<<<<<<'
      ])
    })

    it('keeps no trace of the number in the masked band', () => {
      const masked = (mrz('passport', doc({ ...ANNA, ...secrets }, false)) ?? []).join('')
      expect(masked).not.toContain('L898902C3')
      expect(masked).not.toContain('ZE184226B')
    })
  })
})
