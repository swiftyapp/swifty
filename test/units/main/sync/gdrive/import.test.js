import GDrive from 'main/application/sync/gdrive'
import AuthWindow from 'main/window/auth'
import { google } from 'googleapis'

const mockCloseAuth = jest.fn()
const mockRemoveMenu = jest.fn()
jest.mock('main/window/auth', () => {
  return jest.fn().mockImplementation(() => {
    return {
      removeMenu: mockRemoveMenu,
      authenticate: jest.fn(() => Promise.resolve('AUTH_CODE')),
      close: mockCloseAuth
    }
  })
})

describe('#import', () => {
  let sync

  beforeEach(() => {
    sync = new GDrive()
    sync.initialize({}, {})
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  test('opens auth window with auth url', () => {
    return sync.import().then(() => {
      expect(AuthWindow).toHaveBeenCalledWith(
        'https://example.com/google_oauth2'
      )
    })
  })

  test('removes menu from auth window', () => {
    return sync.import().then(() => {
      expect(mockRemoveMenu).toHaveBeenCalledTimes(1)
    })
  })

  test('closes auth window on authentication done', () => {
    return sync.import().then(() => {
      expect(mockCloseAuth).toHaveBeenCalledTimes(1)
    })
  })

  test('calls get token with auth code', () => {
    return sync.import().then(() => {
      expect(sync.client.auth.getToken).toHaveBeenCalledWith('AUTH_CODE')
    })
  })

  test('initializes drive client', () => {
    return sync.import().then(() => {
      expect(google.drive).toHaveBeenCalledWith({
        version: 'v3',
        auth: sync.client.auth
      })
    })
  })
})
