import Sync from 'application/sync'

jest.unmock('application/sync')
jest.mock('application/sync/gdrive/index')

describe('#disconnect', () => {
  let sync

  beforeEach(() => {
    sync = new Sync()
    sync.initialize({}, {})
  })

  test('calls provider disconnect', async () => {
    sync.disconnect()
    expect(sync.provider.disconnect).toHaveBeenCalled()
  })
})
