import Auth from 'application/sync/gdrive/auth'

describe('Auth#authenticate', () => {
  let auth
  const readTokens = jest.fn().mockReturnValue({
    access_token: 'ACCESS_TOKEN',
    refresh_token: 'REFRESH_TOKEN',
    expiry_date: 'DATE'
  })
  const writeTokens = jest.fn().mockReturnValue(true)

  beforeEach(async () => {
    auth = new Auth(readTokens, writeTokens)
  })

  afterEach(() => jest.clearAllMocks())

  test('returns true', () => {
    expect(auth.disconnect()).toBe(true)
  })

  test('updates credentials with only refresh token', () => {
    auth.disconnect()
    expect(writeTokens).toBeCalledWith({ refresh_token: 'REFRESH_TOKEN' })
  })
})
