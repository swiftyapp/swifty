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
      'urn:ietf:wg:oauth:2.0:oob'
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
