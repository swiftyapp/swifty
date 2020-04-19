import Sync from 'main/application/sync'

jest.unmock('main/application/sync')
jest.mock('main/application/sync/gdrive/index')

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
