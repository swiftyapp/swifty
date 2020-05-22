import GDrive from 'application/sync/gdrive'
import { shell } from 'electron'

jest.mock('http')

describe('#setup', () => {
  let sync = new GDrive({})

  test('opens auth url in browser tab', () => {
    return sync.setup().then(() => {
      expect(shell.openExternal).toHaveBeenCalledWith(
        'https://example.com/google_oauth2'
      )
    })
  })

  test('calls get token with auth code', () => {
    return sync.setup().then(() => {
      expect(sync.auth.auth.getToken).toHaveBeenCalledWith('AUTH_CODE')
    })
  })
})
