import { shell } from 'electron'
import Auth from 'application/sync/gdrive/auth'
jest.mock('http')

describe('Auth#authenticate', () => {
  let auth
  const readTokens = jest.fn()
  const writeTokens = jest.fn()

  describe('user successfully authenticate', () => {
    beforeEach(async () => {
      auth = new Auth(readTokens, writeTokens)
      await auth.authenticate()
    })

    test('it opens auth window with auth url', () => {
      expect(shell.openExternal).toBeCalledWith(
        'https://example.com/google_oauth2'
      )
    })

    test('it gets token with code', () => {
      expect(auth.auth.getToken).toBeCalledWith('AUTH_CODE')
    })
  })
})
