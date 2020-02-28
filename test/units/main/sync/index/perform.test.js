import Sync from 'main/application/sync'

jest.mock('main/application/sync/gdrive/index')
jest.mock('application/helpers/encryption')

describe('#perform', () => {
  let sync
  const vault = {
    isDecryptable: jest.fn().mockReturnValue(true),
    read: jest.fn().mockReturnValue({
      entries: [{ id: '2', password: 'qwerty' }]
    }),
    write: jest.fn()
  }

  beforeEach(async () => {
    sync = new Sync()
    sync.initialize({}, vault)
    await sync.perform()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  test('pulls data from cloud', () => {
    expect(sync.provider.pull).toHaveBeenCalled()
  })

  test('it checks if pulled data is decryptable', () => {
    expect(vault.isDecryptable).toBeCalledWith(
      { entries: [{ id: '1', password: 'password' }] },
      {}
    )
  })

  test('writes merged data to vault', () => {
    expect(vault.write).toBeCalledWith({
      entries: [
        { id: '1', password: 'password' },
        { id: '2', password: 'qwerty' }
      ]
    })
  })

  test('pushes merged data to cloud', () => {
    expect(sync.provider.push).toBeCalledWith({
      entries: [
        { id: '1', password: 'password' },
        { id: '2', password: 'qwerty' }
      ]
    })
  })
})
