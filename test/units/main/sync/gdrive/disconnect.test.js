import GDrive from 'main/application/sync/gdrive'
import Auth from 'main/application/sync/gdrive/auth'

jest.mock('main/application/sync/gdrive/auth')

describe('#disconnect', () => {
  let sync, auth

  beforeEach(() => {
    auth = new Auth()
    sync = new GDrive({})
    sync.disconnect()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  test('calls auth disconnect method', () => {
    expect(auth.disconnect).toHaveBeenCalled()
  })
})
