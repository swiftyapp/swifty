import Auth from 'application/sync/gdrive/auth'
import AuthWindow from 'window/authentication'
jest.mock('window/authentication')

describe('Auth#authenticate', () => {
  let auth
  const readTokens = jest.fn()
  const writeTokens = jest.fn()

  afterEach(() => jest.clearAllMocks())

  describe('user successfully authenticate', () => {
    beforeEach(async () => {
      auth = new Auth(readTokens, writeTokens)
      await auth.authenticate()
    })

    test('it opens auth window with auth url', () => {
      expect(AuthWindow).toBeCalledWith('https://example.com/google_oauth2')
    })

    test('it removes menu from auth window', () => {
      expect(AuthWindow().removeMenu).toHaveBeenCalled()
    })

    test('it closes auth window', () => {
      expect(AuthWindow().close).toHaveBeenCalled()
    })

    test('it gets token with code', () => {
      expect(auth.auth.getToken).toBeCalledWith('CODE')
    })
  })

  describe('user denies access', () => {
    beforeEach(() => {
      AuthWindow().__setAuthDenied()
      auth = new Auth(readTokens, writeTokens)
    })

    test('auth window should close', async () => {
      await expect(auth.authenticate()).resolves.toBe(null)
      expect(AuthWindow().close).toHaveBeenCalled()
    })

    test('token should not be requested', async () => {
      await expect(auth.authenticate()).resolves.toBe(null)
      expect(auth.auth.getToken).not.toHaveBeenCalled()
    })
  })

  describe('user closes window', () => {
    beforeEach(() => {
      AuthWindow().__setClose()
      auth = new Auth(readTokens, writeTokens)
    })

    test('window close should not be called', async () => {
      await expect(auth.authenticate()).rejects.toBe(undefined)
      expect(AuthWindow().close).not.toHaveBeenCalled()
    })

    test('token should not be requested', async () => {
      await expect(auth.authenticate()).rejects.toBe(undefined)
      expect(auth.auth.getToken).not.toHaveBeenCalled()
    })
  })
})
