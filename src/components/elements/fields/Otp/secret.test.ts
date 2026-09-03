import { describe, it, expect } from 'vitest'
import { otpSecret } from './secret'

const SECRET = 'JBSWY3DPEHPK3PXP'

describe('otpSecret', () => {
  const cases: [string, string, string][] = [
    ['nothing', '', ''],
    ['a bare secret', SECRET, SECRET],
    ['a lower-case secret', SECRET.toLowerCase(), SECRET],
    ['a secret typed in groups', 'JBSW Y3DP EHPK 3PXP', SECRET],
    // The Rust decoder reads unpadded base32 only, so padding is dropped.
    ['a padded secret', `${SECRET}======`, SECRET],
    ['padding in the middle', 'JBSWY3DP=EHPK3PXP', ''],
    ['an otpauth link', `otpauth://totp/Acme:me@acme.io?secret=${SECRET}&issuer=Acme`, SECRET],
    // Some exporters capitalise the parameter; URI parameters are not keywords.
    ['an otpauth link spelling it Secret', `otpauth://totp/Acme?Secret=${SECRET}`, SECRET],
    ['an otpauth link spelling it SECRET', `otpauth://totp/Acme?SECRET=${SECRET}`, SECRET],
    ['an otpauth link with a padded secret', `otpauth://totp/Acme?secret=${SECRET}%3D%3D`, SECRET],
    ['an otpauth link with no secret', 'otpauth://totp/Acme?issuer=Acme', ''],
    ['an otpauth link with no query at all', 'otpauth://totp/Acme', ''],
    ['a too-short secret', 'JBSWY3D', ''],
    ['a non-base32 string', 'not-a-secret', ''],
    ['base32 with the digits base32 has no room for', 'JBSWY3DPEHPK3PX1', '']
  ]

  for (const [what, input, expected] of cases) {
    it(`reads ${what}`, () => expect(otpSecret(input)).toBe(expected))
  }
})
