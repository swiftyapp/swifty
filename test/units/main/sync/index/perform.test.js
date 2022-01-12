import { DateTime } from 'luxon'

import Sync from 'application/sync'
import VaultManager from 'application/vault_manager'
import { Cryptor } from 'application/cryptor'

jest.unmock('application/sync')
jest.mock('application/sync/gdrive/index')

describe('#perform', () => {
  let sync
  let vaultManager = new VaultManager()
  const cryptor = new Cryptor()
  const currentTime = DateTime.local()

  beforeEach(async () => {
    sync = new Sync()
    sync.initialize(cryptor, vaultManager.vault)
    await sync.perform()
  })

  test.skip('pulls data from cloud', () => {
    expect(sync.provider.pull).toHaveBeenCalled()
  })

  test.skip('it checks if pulled data is decryptable', () => {
    expect(vaultManager.vault.isDecryptable).toBeCalledWith(
      {
        entries: [{ id: '1', password: 'password' }],
        updatedAt: currentTime.toISO()
      },
      cryptor
    )
  })

  test.skip('writes merged data to vault', () => {
    expect(vaultManager.vault.write).toBeCalledWith({
      entries: [{ id: '2', password: 'qwerty', type: 'login' }],
      updatedAt: currentTime.toISO()
    })
  })

  test.skip('pushes merged data to cloud', () => {
    expect(sync.provider.push).toBeCalledWith({
      entries: [{ id: '2', password: 'qwerty', type: 'login' }],
      updatedAt: currentTime.toISO()
    })
  })
})
