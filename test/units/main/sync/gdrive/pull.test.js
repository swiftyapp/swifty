import GDrive from 'main/application/sync/gdrive'
import { google } from 'googleapis'

describe('#pull', () => {
  let sync, credentials

  beforeEach(() => {
    const cryptor = { decrypt: () => credentials }
    const vault = {
      write: jest.fn(),
      isDecryptable: () => true
    }
    sync = new GDrive()
    sync.initialize(vault, cryptor)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('credentials are not configured', () => {
    beforeEach(() => {
      credentials = ''
    })

    test('does not pull data', () => {
      return sync.pull().then(result => {
        expect(result).toEqual(false)
      })
    })

    test('does not initialize drive client', () => {
      return sync.pull().then(() => {
        expect(google.drive).not.toHaveBeenCalled()
      })
    })
  })

  describe('credentials are configured', () => {
    beforeEach(() => {
      credentials = '{"access_token": "qwert","refresh_token": "asdf"}'
    })

    test('initializes drive client', () => {
      return sync.pull().then(() => {
        expect(google.drive).toHaveBeenCalledWith({
          version: 'v3',
          auth: sync.client.auth
        })
      })
    })
  })
})
