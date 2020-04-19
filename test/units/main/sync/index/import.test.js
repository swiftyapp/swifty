import Sync from 'main/application/sync'

jest.unmock('main/application/sync')
jest.mock('main/application/sync/gdrive/index')

describe('#import', () => {
  let sync

  beforeEach(() => {
    sync = new Sync()
    sync.initialize({}, {})
  })

  test('calls provider import', async () => {
    await sync.import()
    expect(sync.provider.import).toHaveBeenCalled()
  })
})
