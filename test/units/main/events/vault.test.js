import { BrowserWindow } from 'electron'
import { DateTime } from 'luxon'
import Vault from 'main/application/vault'
import Sync from 'main/application/sync'
import { Cryptor } from 'main/application/cryptor'

import { onMasterPasswordChange } from 'application/events/vault'

const event = {}
const currentTime = DateTime.local()
const vault = new Vault()
const sync = new Sync()
const window = new BrowserWindow()
const newCryptor = {
  __secret: 'newpassword',
  encrypt: expect.any(Function),
  decrypt: expect.any(Function),
  encryptData: expect.any(Function),
  decryptData: expect.any(Function)
}

const app = {
  vault: vault,
  window: window,
  sync: sync
}

describe('onMasterPasswordChange', () => {
  beforeEach(() => {
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
    expect(vault.write).toHaveBeenCalledWith({
      entries: [
        {
          id: '2',
          password: 'qwerty',
          type: 'login'
        }
      ],
      updatedAt: currentTime.toISO()
    })
  })

  it('writes re-crypted credentials to a file', () => {
    expect(sync.provider.writeTokens).toHaveBeenCalledWith({
      access_token: 'access_token',
      refresh_token: 'refresh_token'
    })
  })

  it('sets new cryptor to application', () => {
    expect(app.cryptor).toEqual(newCryptor)
  })

  it('sets new cryptor to sync module', () => {
    expect(sync.initialize).toHaveBeenCalledWith(newCryptor, vault)
  })
})
