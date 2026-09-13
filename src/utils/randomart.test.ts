import { describe, expect, it } from 'vitest'
import { randomart } from './randomart'

// Both pictures are what `ssh-keygen -lv` printed for these keys.
describe('randomart', () => {
  it('draws an ed25519 key as ssh-keygen does', () => {
    expect(randomart('SHA256:yq4WhqtjhSWoWZW2bkgxK9fflZopigYMOa/Xsyu5PxE', 'ED25519 256')).toEqual([
      '+--[ED25519 256]--+',
      '|     .           |',
      '|  o +            |',
      '|.. B .     .     |',
      '|*.=.E     o      |',
      '|+O++ o .S=       |',
      '|+o+.*.o.=        |',
      '| o.B +o.         |',
      '|o.B *.           |',
      '|o=.==*.          |',
      '+----[SHA256]-----+'
    ])
  })

  it('draws an rsa key as ssh-keygen does', () => {
    expect(randomart('SHA256:35ij89QtXLhKTLv2/jylM4dBRKufw3QYpw3G4FuqRCM', 'RSA 3072')).toEqual([
      '+---[RSA 3072]----+',
      '|            ...  |',
      '|           . o.. |',
      '|        E o ..B .|',
      '|         o . B.B |',
      '|        S o =.= o|',
      '|         = O B.o.|',
      '|          @ * *= |',
      '|        .+.+ o*..|',
      '|        .++oo.o= |',
      '+----[SHA256]-----+'
    ])
  })

  it('leaves the top border bare without a title', () => {
    const art = randomart('SHA256:yq4WhqtjhSWoWZW2bkgxK9fflZopigYMOa/Xsyu5PxE', '')
    expect(art?.[0]).toBe('+-----------------+')
  })

  it('draws nothing for a fingerprint it cannot read', () => {
    expect(randomart('MD5:16:27:ac:a5:76:28:2d:36', '')).toBeNull()
    expect(randomart('SHA256:GeneratedFingerprint', '')).toBeNull()
    expect(randomart('SHA256:not base64!', '')).toBeNull()
    expect(randomart('', '')).toBeNull()
  })
})
