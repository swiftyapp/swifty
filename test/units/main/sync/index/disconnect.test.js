import Sync from 'main/application/sync'

jest.mock('main/application/sync/gdrive/index')

describe('#disconnect', () => {
  let sync

  beforeEach(() => {
    sync = new Sync()
    sync.initialize({}, {})
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  test('calls provider disconnect', async () => {
    sync.disconnect()
    expect(sync.provider.disconnect).toHaveBeenCalled()
  })
})
