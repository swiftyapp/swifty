import Auth from 'application/sync/gdrive/auth'

describe('Auth#isConfigured', () => {
  let auth
  const validCredentials = { access_token: 'ACCESS_TOKEN' }
  const invalidCredentials = { refresh_token: 'REFRESH_TOKEN' }
  const writeTokens = jest.fn()

  afterEach(() => jest.clearAllMocks())

  describe('auth credentials exist', () => {
    beforeEach(() => {
      const readTokens = jest.fn().mockReturnValue(validCredentials)
      auth = new Auth(readTokens, writeTokens)
    })

    test('it cerates google auth', () => {
      expect(auth.isConfigured()).toBe(true)
    })
  })

  describe('auth credentials do not exist', () => {
    beforeEach(() => {
      const readTokens = jest.fn().mockReturnValue(invalidCredentials)
      auth = new Auth(readTokens, writeTokens)
    })

    test('it cerates google auth', () => {
      expect(auth.isConfigured()).toBe(false)
    })
  })
})
