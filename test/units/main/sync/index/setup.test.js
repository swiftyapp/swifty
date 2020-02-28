import Sync from 'main/application/sync'

jest.mock('main/application/sync/gdrive/index')
jest.mock('application/helpers/encryption')

describe('#setup', () => {
  let sync
  const cryptor = {}
  const vault = {
    read: jest.fn().mockReturnValue({
      entries: [{ id: '2', password: 'qwerty' }]
    }),
    write: jest.fn(),
    isDecryptable: jest.fn().mockReturnValue(true)
  }

  beforeEach(async () => {
    sync = new Sync()
    sync.initialize(cryptor, vault)
    await sync.setup()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  test('calls provider setup', () => {
    expect(sync.provider.setup).toHaveBeenCalled()
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
