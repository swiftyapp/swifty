import { Cryptor as BaseCryptor } from '@swiftyapp/cryptor'
import { Cryptor } from 'main/application/cryptor'

const cryptor = new Cryptor('secret')
let result

describe('Cryptor', () => {
  describe('#encrypt', () => {
    beforeEach(() => {
      result = cryptor.encrypt({ id: 1 })
    })

    it('calls cryptor with stringified data', () => {
      expect(BaseCryptor.encrypt).toHaveBeenCalledWith('{"id":1}')
    })

    it('returns base64 encrypted string', () => {
      expect(result).toEqual('eyJpZCI6MX0=')
    })
  })

  describe('#decrypt', () => {
    beforeEach(() => {
      result = cryptor.decrypt('eyJpZCI6MX0=')
    })

    it('calls ryptor with with stringified data', () => {
      expect(BaseCryptor.decrypt).toHaveBeenCalledWith('{"id":1}')
    })

    it('returns decrypted object', () => {
      expect(result).toEqual({ id: 1 })
    })
  })
})
