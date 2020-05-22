import Auth from 'application/sync/gdrive/auth'
import { google } from 'googleapis'
jest.mock('googleapis')
const readTokens = jest.fn().mockReturnValue({ access_token: 'ACCESS_TOKEN' })
const writeTokens = () => jest.fn()

describe('Auth', () => {
  beforeEach(() => new Auth(readTokens, writeTokens))

  test('it cerates google auth', () => {
    expect(google.auth.OAuth2).toBeCalledWith(
      'google-api-client-key',
      'google-api-client-secret',
      'http://127.0.0.1:4567/auth/callback'
    )
  })

  test('it reads and sets credentials', () => {
    expect(google.auth.OAuth2().setCredentials).toBeCalledWith({
      access_token: 'ACCESS_TOKEN'
    })
  })

  test('it subscribes for updating tokens', () => {
    expect(google.auth.OAuth2().on).toBeCalledWith(
      'tokens',
      expect.any(Function)
    )
  })
})
