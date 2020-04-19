import { DateTime } from 'luxon'

import Sync from 'application/sync'
import Vault from 'application/vault'
import { Cryptor } from 'application/cryptor'

jest.unmock('application/sync')
jest.mock('application/sync/gdrive/index')

describe('#perform', () => {
  let sync
  const cryptor = new Cryptor()
  let vault = new Vault()
  const currentTime = DateTime.local()

  beforeEach(async () => {
    sync = new Sync()
    sync.initialize(cryptor, vault)
    await sync.perform()
  })

  test('pulls data from cloud', () => {
    expect(sync.provider.pull).toHaveBeenCalled()
  })

  test('it checks if pulled data is decryptable', () => {
    expect(vault.isDecryptable).toBeCalledWith(
      {
        entries: [{ id: '1', password: 'password' }],
        updatedAt: currentTime.toISO()
      },
      cryptor
    )
  })

  test('writes merged data to vault', () => {
    expect(vault.write).toBeCalledWith({
      entries: [{ id: '2', password: 'qwerty', type: 'login' }],
      updatedAt: currentTime.toISO()
    })
  })

  test('pushes merged data to cloud', () => {
    expect(sync.provider.push).toBeCalledWith({
      entries: [{ id: '2', password: 'qwerty', type: 'login' }],
      updatedAt: currentTime.toISO()
    })
  })
})
