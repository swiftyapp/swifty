import Sync from 'application/sync'

jest.unmock('application/sync')
jest.mock('application/sync/gdrive/index')

describe('#isConfigured', () => {
  let sync

  beforeEach(() => {
    sync = new Sync()
    sync.initialize({}, {})
  })

  test('check if provider is configured', async () => {
    expect(sync.isConfigured()).toBe(true)
    expect(sync.provider.isConfigured).toHaveBeenCalled()
  })
})
