import { DateTime } from 'luxon'
import Sync from 'application/sync'
import LegacyVault from 'application/legacy_vault'
import { Cryptor } from 'application/cryptor'

jest.unmock('application/sync')
jest.mock('application/sync/gdrive/index')

describe('#setup', () => {
  let sync
  let vault = new LegacyVault()
  let currentTime = DateTime.local()
  const cryptor = new Cryptor()

  beforeEach(async () => {
    sync = new Sync()
    sync.initialize(cryptor, vault)
    await sync.setup()
  })

  test('calls provider setup', () => {
    expect(sync.provider.setup).toHaveBeenCalled()
  })

  test('pulls data from cloud', () => {
    expect(sync.provider.pull).toHaveBeenCalled()
  })

  test('it checks if pulled data is decryptable', () => {
    expect(vault.isDecryptable).toBeCalledWith(
      {
        entries: [{ id: '1', password: 'password' }],
        updatedAt: DateTime.local().toISO()
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
