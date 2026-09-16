import { describe, it, expect } from 'vitest'
import { otpSecret, otpStored } from './secret'

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
    ['a counter-based link', `otpauth://hotp/Acme?secret=${SECRET}&counter=0`, ''],
    ['a link of a type nobody supports', `otpauth://steam/Acme?secret=${SECRET}`, ''],
    ['a link shouting TOTP', `otpauth://TOTP/Acme?secret=${SECRET}`, SECRET],
    ['a link asking for too few digits', `otpauth://totp/Acme?secret=${SECRET}&digits=4`, ''],
    ['a link with a zero-second window', `otpauth://totp/Acme?secret=${SECRET}&period=0`, ''],
    ['a link naming an unknown hash', `otpauth://totp/Acme?secret=${SECRET}&algorithm=md5`, ''],
    ['a link with a supported non-default set', `otpauth://totp/Acme?secret=${SECRET}&digits=8&period=60&algorithm=SHA512`, SECRET],
    // The backend reads the last of a repeated parameter and this check used to
    // read the first; a link that repeats one now decides nothing on either side.
    ['a link with a good secret and then a bad one', `otpauth://totp/Acme?secret=${SECRET}&secret=NOTBASE32&digits=8`, ''],
    ['a link with the same secret twice', `otpauth://totp/Acme?secret=${SECRET}&Secret=${SECRET}`, ''],
    ['a link asking for two digit counts', `otpauth://totp/Acme?secret=${SECRET}&digits=6&digits=8`, ''],
    ['a link asking for two windows', `otpauth://totp/Acme?secret=${SECRET}&period=30&period=60`, ''],
    ['a link naming two hashes', `otpauth://totp/Acme?secret=${SECRET}&algorithm=SHA1&algorithm=SHA256`, ''],
    ['a link naming the issuer twice', `otpauth://totp/Acme?secret=${SECRET}&issuer=Acme&issuer=ACME`, SECRET],
    ['a too-short secret', 'JBSWY3D', ''],
    ['a non-base32 string', 'not-a-secret', ''],
    ['base32 with the digits base32 has no room for', 'JBSWY3DPEHPK3PX1', '']
  ]

  for (const [what, input, expected] of cases) {
    it(`reads ${what}`, () => expect(otpSecret(input)).toBe(expected))
  }
})

// What the field saves. A link whose parameters are the ones we would have
// assumed anyway collapses to its seed; one that asks for anything else is kept
// whole, because the seed alone would generate codes its site rejects.
describe('otpStored', () => {
  const uri = (query: string) => `otpauth://totp/Acme:me@acme.io?secret=${SECRET}&${query}`

  const cases: [string, string, string][] = [
    ['nothing', '', ''],
    ['a bare secret', SECRET, SECRET],
    ['a secret typed in groups', 'JBSW Y3DP EHPK 3PXP', SECRET],
    ['a link with nothing but the secret', `otpauth://totp/Acme?secret=${SECRET}`, SECRET],
    ['a link spelling out the defaults', uri('digits=6&period=30&algorithm=SHA1'), SECRET],
    ['a link naming only the issuer', uri('issuer=Acme'), SECRET],
    ['a link asking for 8 digits', uri('digits=8'), uri('digits=8')],
    ['a link asking for a 60s window', uri('period=60'), uri('period=60')],
    ['a link asking for SHA-256', uri('algorithm=SHA256'), uri('algorithm=SHA256')],
    // The parameter names are no more case-sensitive here than in `otpSecret`.
    ['a link shouting DIGITS', uri('DIGITS=8'), uri('DIGITS=8')],
    // A link we cannot read a seed out of is no more storable than junk.
    ['a link with no secret', 'otpauth://totp/Acme?digits=8', ''],
    ['a link the backend would refuse', uri('digits=4'), ''],
    ['a link with a good secret and then a bad one', uri('secret=NOTBASE32&digits=8'), ''],
    ['a counter-based link', `otpauth://hotp/Acme?secret=${SECRET}`, ''],
    ['a non-base32 string', 'not-a-secret', '']
  ]

  for (const [what, input, expected] of cases) {
    it(`stores ${what}`, () => expect(otpStored(input)).toBe(expected))
  }
})
