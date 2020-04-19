import { Cryptor } from 'application/cryptor'

import { onMasterPasswordChange } from 'application/events/vault'

import { app } from './setup'

const event = {}

const newCryptor = {
  __secret: 'newpassword',
  encrypt: expect.any(Function),
  decrypt: expect.any(Function),
  encryptData: expect.any(Function),
  decryptData: expect.any(Function)
}

describe('onMasterPasswordChange', () => {
  beforeEach(() => {
    Cryptor.__setEncryption(true)
    onMasterPasswordChange.call(app, event, {
      current: 'password',
      new: 'newpassword'
    })
  })

  it('creates 2 cryptors for each password', () => {
    expect(Cryptor).toHaveBeenNthCalledWith(1, 'password')
    expect(Cryptor).toHaveBeenNthCalledWith(2, 'newpassword')
  })

  it('writes re-crypted data to vault', () => {
    expect(app.vault.write).toHaveBeenCalledWith(
      '{"entries":[{"id":"2","password":"qwerty.newpassword","type":"login"}],"updatedAt":"2030-06-01T10:00:00.000+02:00"}|newpassword'
    )
  })

  it('writes re-crypted credentials to a file', () => {
    expect(app.sync.provider.writeTokens).toHaveBeenCalledWith({
      access_token: 'access_token',
      refresh_token: 'refresh_token'
    })
  })

  it('sets new cryptor to application', () => {
    expect(app.cryptor).toEqual(newCryptor)
  })

  it('sets new cryptor to sync module', () => {
    expect(app.sync.initialize).toHaveBeenCalledWith(newCryptor, app.vault)
  })
})
