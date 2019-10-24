import GDrive from 'main/application/sync/gdrive'

describe('#disconnect', () => {
  let sync, cryptor

  beforeEach(() => {
    cryptor = {
      decrypt: jest.fn(
        () => '{"access_token": "qwert","refresh_token": "asdf"}'
      ),
      encrypt: jest.fn()
    }
    sync = new GDrive()
    sync.initialize({}, cryptor)
    sync.disconnect()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  test('reads tokens from storage', () => {
    expect(cryptor.decrypt).toHaveBeenCalled()
  })

  test('removes access token from credentials', () => {
    expect(cryptor.encrypt).toHaveBeenCalledWith('{"refresh_token":"asdf"}')
  })
})
