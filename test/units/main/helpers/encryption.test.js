import { hash, encrypt, decrypt } from 'main/application/helpers/encryption'

const cryptor = {
  encrypt: jest.fn(() => 'encrypted data'),
  decrypt: jest.fn(() => '{"entries":[{"a":"b"}]}')
}

describe('Encryption helpers', () => {
  describe('#hash', () => {
    test('returns hashed value', () => {
      expect(hash('password')).toEqual(
        'sQnzu7wkTrgkQZF+0G1hi5AI3Qmzvv0bXgc5THBqi7mAsdd4Xll27ASbRt9fEyavWi6m0QP9B8lThf+rDKy8hg=='
      )
    })
  })

  describe('#encrypt', () => {
    const data = { entries: [{ a: 'b' }] }
    let result

    beforeEach(() => {
      result = encrypt(data, cryptor)
    })

    test('calls cryptor encrypt method', () => {
      expect(cryptor.encrypt).toHaveBeenCalledWith('{"entries":[{"a":"b"}]}')
    })

    test('returns encrypted data in base64 format', () => {
      expect(result).toEqual('ZW5jcnlwdGVkIGRhdGE=')
    })
  })

  describe('#decrypt', () => {
    const data = 'ZW5jcnlwdGVkIGRhdGE='
    let result

    beforeEach(() => {
      result = decrypt(data, cryptor)
    })

    test('calls cryptor encrypt method', () => {
      expect(cryptor.decrypt).toHaveBeenCalledWith('encrypted data')
    })

    test('returns encrypted data in base64 format', () => {
      expect(result).toEqual({ entries: [{ a: 'b' }] })
    })
  })
})
