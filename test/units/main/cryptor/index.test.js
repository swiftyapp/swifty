import { encrypt, decrypt } from '@swiftyapp/aes-256-gcm'
import { Cryptor } from 'application/cryptor'

const cryptor = new Cryptor('secret')
let result

jest.unmock('application/cryptor')

describe('Cryptor', () => {
  describe('#encryptData', () => {
    beforeEach(() => {
      result = cryptor.encryptData({ id: 1 })
    })

    it('calls cryptor with stringified data', () => {
      expect(encrypt).toHaveBeenCalledWith('{"id":1}', 'secret')
    })

    it('returns base64 encrypted string', () => {
      expect(result).toEqual('eyJpZCI6MX0=')
    })
  })

  describe('#decryptData', () => {
    beforeEach(() => {
      result = cryptor.decryptData('eyJpZCI6MX0=')
    })

    it('calls cryptor with with stringified data', () => {
      expect(decrypt).toHaveBeenCalledWith('{"id":1}', 'secret')
    })

    it('returns decrypted object', () => {
      expect(result).toEqual({ id: 1 })
    })
  })

  describe('#encrypt', () => {
    beforeEach(() => {
      result = cryptor.encrypt('unencrypted')
    })

    it('calls cryptor with data', () => {
      expect(encrypt).toHaveBeenCalledWith('unencrypted', 'secret')
    })
  })

  describe('#decrypt', () => {
    beforeEach(() => {
      result = cryptor.decrypt('encrypted')
    })

    it('calls cryptor with with data', () => {
      expect(decrypt).toHaveBeenCalledWith('encrypted', 'secret')
    })
  })
})
