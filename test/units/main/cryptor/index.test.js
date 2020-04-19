import { Cryptor as BaseCryptor } from '@swiftyapp/cryptor'
import { Cryptor } from 'main/application/cryptor'

const cryptor = new Cryptor('secret')
let result

describe('Cryptor', () => {
  describe('#encryptData', () => {
    beforeEach(() => {
      result = cryptor.encryptData({ id: 1 })
    })

    it('calls cryptor with stringified data', () => {
      expect(BaseCryptor.encrypt).toHaveBeenCalledWith('{"id":1}')
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
      expect(BaseCryptor.decrypt).toHaveBeenCalledWith('{"id":1}')
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
      expect(BaseCryptor.encrypt).toHaveBeenCalledWith('unencrypted')
    })
  })

  describe('#decrypt', () => {
    beforeEach(() => {
      result = cryptor.decrypt('encrypted')
    })

    it('calls cryptor with with data', () => {
      expect(BaseCryptor.decrypt).toHaveBeenCalledWith('encrypted')
    })
  })
})
