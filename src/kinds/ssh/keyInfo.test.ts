import { describe, expect, it } from 'vitest'
import { keyLabel, parsePublicKey, privateKeyFormat } from './keyInfo'

const ED25519 =
  'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIDbXJwpmdubb27hkcjffuYYnPiq/v+pAExBAhyMvpB+w alice@laptop'

// A real 3072-bit key: the size has to come out of the modulus.
const RSA =
  'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQCX3/8eOg9nZwKjHoSAEeoT50KTsbf/MOyEdpVCTv2HqpCq4Y+asTz0JjNEP92iCulPS7rvfhLHKiauzJ+hVSYzrL9C+hLmC4zRyiNXYgrVX1SWZraSUqJnffAHjew0oHmPyWSLSR4J4QCuognwNnFTzLxjnkBLvpwxMdoN49c9ukoJEzB4tnQ2KDxslM2mnrnBO3z9IzoTWo2jyJl9/n3vr0k3GxmbpTXgjK31vqLA68yWj/4mWnJdaBT6kYZA4LbSVUae8MiaV0TB0Oi5XyS/UvD+tPnMLXAoYg8gDVvk2TBhG7cG3fvLL0g//EbL2MrOjDzywtDO0fJkiw9yBKIXzJ+vzs1NVNK7llfg25I7QpZN90DRP6MntaP/7G7GGnDFDQW3neKR0dER8nlm+YJ2L2ka0LKR47+Vfq3bSdBoWoQLm0v4VDPubj7YrvCWiUhGB8Qwgp94uuoyco6/ljvhHJJBzZLY8CeTQPGVjK9YVNvrO8csGQ5DjbvEhOMxqQ8= bob@box'

describe('parsePublicKey', () => {
  it('names an ed25519 key and keeps its comment', () => {
    expect(parsePublicKey(ED25519)).toEqual({
      type: 'ED25519',
      bits: 256,
      comment: 'alice@laptop'
    })
  })

  it('reads an rsa key size out of the modulus', () => {
    expect(parsePublicKey(RSA)).toEqual({
      type: 'RSA',
      bits: 3072,
      comment: 'bob@box'
    })
  })

  it('takes the curve size from an ecdsa name', () => {
    expect(parsePublicKey('ecdsa-sha2-nistp384 AAAA')).toMatchObject({
      type: 'ECDSA',
      bits: 384
    })
  })

  it('keeps a comment with spaces whole', () => {
    expect(parsePublicKey('ssh-ed25519 AAAA deploy key for prod').comment).toBe(
      'deploy key for prod'
    )
  })

  it('has nothing to say about an empty or one-word line', () => {
    expect(parsePublicKey('')).toEqual({ type: '', comment: '' })
    expect(parsePublicKey('ssh-ed25519')).toEqual({ type: '', comment: '' })
  })

  it('does not choke on a garbled rsa blob', () => {
    expect(parsePublicKey('ssh-rsa AAAA')).toEqual({
      type: 'RSA',
      bits: undefined,
      comment: ''
    })
    expect(parsePublicKey('ssh-rsa not-base64!')).toEqual({
      type: 'RSA',
      bits: undefined,
      comment: ''
    })
  })
})

describe('keyLabel', () => {
  it('joins what is known, with a space or a separator of its own', () => {
    expect(keyLabel({ type: 'ED25519', bits: 256, comment: '' })).toBe('ED25519 256')
    expect(keyLabel({ type: 'ED25519', bits: 256, comment: '' }, ' · ')).toBe('ED25519 · 256')
    expect(keyLabel({ type: 'RSA', comment: '' })).toBe('RSA')
    expect(keyLabel({ type: '', comment: '' })).toBe('')
  })
})

describe('privateKeyFormat', () => {
  it('reads the format off the BEGIN line', () => {
    expect(privateKeyFormat('-----BEGIN OPENSSH PRIVATE KEY-----\nabc\n-----END')).toBe('OPENSSH')
    expect(privateKeyFormat('-----BEGIN RSA PRIVATE KEY-----')).toBe('RSA')
    expect(privateKeyFormat('\n  -----BEGIN EC PRIVATE KEY-----\n')).toBe('EC')
    expect(privateKeyFormat('not a key')).toBe('')
  })

  it('names no format for armor that is not on the first line', () => {
    expect(privateKeyFormat('my key:\n-----BEGIN OPENSSH PRIVATE KEY-----')).toBe('')
  })
})
