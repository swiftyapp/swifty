import Sync from 'main/application/sync'

jest.mock('main/application/sync/gdrive/index')

describe('#import', () => {
  let sync

  beforeEach(() => {
    sync = new Sync()
    sync.initialize({}, {})
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  test('calls provider import', async () => {
    sync.import()
    expect(sync.provider.import).toHaveBeenCalled()
  })
})
