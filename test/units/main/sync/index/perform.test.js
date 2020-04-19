import Sync from 'main/application/sync'
import Vault from 'main/application/vault'
import { DateTime } from 'luxon'

jest.unmock('main/application/sync')
jest.mock('main/application/sync/gdrive/index')
jest.mock('application/helpers/encryption')

describe('#perform', () => {
  let sync
  let vault = new Vault()
  const currentTime = DateTime.local()

  beforeEach(async () => {
    sync = new Sync()
    sync.initialize({}, vault)
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
      {}
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
