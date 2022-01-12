import Sync from 'application/sync'

jest.unmock('application/sync')
jest.mock('application/sync/gdrive/index')

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
