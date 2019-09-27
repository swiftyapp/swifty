import GDrive from 'main/application/sync/gdrive'
import { google } from 'googleapis'

describe('#push', () => {
  let sync

  beforeEach(() => {
    const cryptor = {
      decrypt: () => '{"access_token": "qwert","refresh_token": "asdf"}'
    }
    const vault = {
      read: jest.fn(),
      write: jest.fn(),
      isDecryptable: () => true
    }
    sync = new GDrive()
    sync.initialize(vault, cryptor)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  test('pushes data', () => {
    return sync.push().then(result => {
      expect(result).toEqual(null)
    })
  })

  test('initializes drive client', () => {
    return sync.push().then(() => {
      expect(google.drive).toHaveBeenCalledWith({
        version: 'v3',
        auth: sync.client.auth
      })
    })
  })
})
