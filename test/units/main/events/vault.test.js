import { Cryptor } from 'application/cryptor'

import { onMasterPasswordChange } from 'application/events/vault'

import { app } from './setup'

const event = {}

const newCryptor = {
  __secret: 'newpassword',
  encrypt: expect.any(Function),
  decrypt: expect.any(Function),
  encryptData: expect.any(Function),
  decryptData: expect.any(Function),
  obscure: expect.any(Function),
  expose: expect.any(Function)
}

describe('onMasterPasswordChange', () => {
  const subject = () => {
    onMasterPasswordChange.call(app, event, {
      current: 'password',
      new: 'newpassword'
    })
  }

  beforeEach(() => {
    Cryptor.__setEncryption(true)
  })

  describe('invalid current password', () => {
    beforeEach(() => {
      app.vaultManager.isDecryptable.mockReturnValue(false)
      subject()
    })

    it('does not re-crypt vault', () => {
      expect(app.vaultManager.write).not.toHaveBeenCalled()
    })

    it('does not set new cryptor to application', () => {
      expect(app.cryptor).not.toEqual(newCryptor)
    })

    it('does not write re-crypted credentials to a file', () => {
      expect(app.sync.provider.writeTokens).not.toHaveBeenCalled()
    })

    it('sends error message to browser window', () => {
      expect(app.window.send).toHaveBeenCalledWith(
        'masterpassword:update:failure',
        {
          message: 'Current password is invalid'
        }
      )
    })
  })

  describe('valid current password', () => {
    describe('re-crypts vault', () => {
      beforeEach(() => {
        app.vaultManager.isDecryptable.mockReturnValue(true)
        subject()
      })

      it('creates 2 cryptors for each password', () => {
        expect(Cryptor).toHaveBeenNthCalledWith(1, 'password')
        expect(Cryptor).toHaveBeenNthCalledWith(2, 'newpassword')
      })

      it('writes re-crypted data to vault', () => {
        expect(app.vaultManager.write).toHaveBeenCalledWith(
          '{"entries":[{"id":"2","password":"qwerty.newpassword","type":"login"}],"updatedAt":"2030-06-01T10:00:00.000+02:00"}|newpassword'
        )
      })

      it('sets new cryptor to application', () => {
        expect(app.cryptor).toEqual(newCryptor)
      })

      it('sends success message to browser window', () => {
        expect(app.window.send).toHaveBeenCalledWith(
          'masterpassword:update:success'
        )
      })
    })

    describe('sync is configured', () => {
      beforeEach(() => subject())

      it('writes re-crypted credentials to a file', () => {
        expect(app.sync.provider.writeTokens).toHaveBeenCalledWith({
          access_token: 'access_token',
          refresh_token: 'refresh_token'
        })
      })

      it('sets new cryptor to sync module', () => {
        expect(app.sync.initialize).toHaveBeenCalledWith(newCryptor, app.vault)
      })
    })

    describe('sync is not configured', () => {
      beforeEach(() => {
        app.sync.isConfigured.mockReturnValue(false)
        subject()
      })

      it('does not write re-crypted credentials to a file', () => {
        expect(app.sync.provider.writeTokens).not.toHaveBeenCalled()
      })

      it('does not set new cryptor to sync module', () => {
        expect(app.sync.initialize).not.toHaveBeenCalled()
      })
    })
  })
})
