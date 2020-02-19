import GDrive from 'main/application/sync/gdrive'

describe('#isConfigured', () => {
  let sync, data

  beforeEach(() => {
    const cryptor = { decrypt: () => data }
    sync = new GDrive()
    sync.initialize(cryptor)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('access_token is present', () => {
    beforeEach(() => {
      data = '{"access_token": "qwert","refresh_token": "asdf"}'
    })

    test('returns true', () => {
      expect(sync.isConfigured()).toEqual(true)
    })
  })

  describe('access_token is not present', () => {
    beforeEach(() => {
      data = '{"refresh_token": "asdf"}'
    })

    test('returns false', () => {
      expect(sync.isConfigured()).toEqual(false)
    })
  })
})
