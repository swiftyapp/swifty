import GDrive from 'application/sync/gdrive'
import Auth from 'application/sync/gdrive/auth'

jest.mock('application/sync/gdrive/auth')

describe('#disconnect', () => {
  let sync, auth

  beforeEach(() => {
    auth = new Auth()
    sync = new GDrive({})
    sync.disconnect()
  })

  test('calls auth disconnect method', () => {
    expect(auth.disconnect).toHaveBeenCalled()
  })
})
