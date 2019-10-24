import GDrive from 'main/application/sync/gdrive'
import { google } from 'googleapis'

describe('#pull', () => {
  let sync, credentials, vault

  beforeEach(() => {
    const cryptor = { decrypt: () => credentials }
    vault = {
      write: jest.fn(),
      isDecryptable: data => data !== null
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
    let folderExistsMock, fileExistsMock, fileContentMock
    const drive = {
      files: {
        get: jest.fn(() => fileContentMock()),
        list: jest.fn(options => {
          if (options.q === "name = 'Swifty' and trashed = false") {
            return folderExistsMock()
          } else {
            return fileExistsMock()
          }
        }),
        create: jest.fn()
      }
    }
    google.drive = jest.fn(() => drive)

    beforeEach(() => {
      fileContentMock = () => Promise.resolve({ data: 'VAULT DATA' })
      folderExistsMock = () =>
        Promise.resolve({ data: { files: [{ id: 'asdfg' }] } })
      fileExistsMock = () =>
        Promise.resolve({ data: { files: [{ id: 'qwerty' }] } })

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

    describe('folder does not exist', () => {
      beforeEach(() => {
        folderExistsMock = () => Promise.resolve({})
      })

      test('checks for presence of swifty folder', () => {
        return sync.pull().then(() => {
          expect(drive.files.list).toHaveBeenCalledWith({
            q: "name = 'Swifty' and trashed = false",
            fields: 'files(id, name)'
          })
        })
      })

      test('does not create swifty folder', () => {
        return sync.pull().then(() => {
          expect(drive.files.create).not.toHaveBeenCalled()
        })
      })

      test('does not write data to vault', () => {
        return sync.pull().then(() => {
          expect(vault.write).not.toHaveBeenCalled()
        })
      })

      test('resolves with falsey result', () => {
        return sync.pull().then(result => expect(result).toEqual(false))
      })
    })

    describe('folder exists', () => {
      describe('file does not exist', () => {
        beforeEach(() => {
          fileExistsMock = () => Promise.resolve({})
        })

        test('checks for presence of swifty folder', () => {
          return sync.pull().then(() => {
            expect(drive.files.list).toHaveBeenCalledWith({
              q: "name = 'Swifty' and trashed = false",
              fields: 'files(id, name)'
            })
          })
        })

        test('checks for presence of vault file', () => {
          return sync.pull().then(() => {
            expect(drive.files.list).toHaveBeenCalledWith({
              q: "name = 'vault.swftx' and 'asdfg' in parents",
              fields: 'files(id, name)'
            })
          })
        })

        test('does not read vault file', () => {
          return sync.pull().then(() => {
            expect(drive.files.get).not.toHaveBeenCalled()
          })
        })
      })
      describe('file exists', () => {
        test('checks for presence of swifty folder', () => {
          return sync.pull().then(() => {
            expect(drive.files.list).toHaveBeenCalledWith({
              q: "name = 'Swifty' and trashed = false",
              fields: 'files(id, name)'
            })
          })
        })

        test('checks for presence of vault file', () => {
          return sync.pull().then(() => {
            expect(drive.files.list).toHaveBeenCalledWith({
              q: "name = 'vault.swftx' and 'asdfg' in parents",
              fields: 'files(id, name)'
            })
          })
        })

        test('reads vault file', () => {
          return sync.pull().then(() => {
            expect(drive.files.get).toHaveBeenCalledWith({
              fileId: 'qwerty',
              alt: 'media'
            })
          })
        })

        describe('invalid data in vault', () => {
          beforeEach(() => {
            fileContentMock = () => Promise.resolve({ data: null })
          })

          test('does not write data to vault', () => {
            return sync.pull().then(() => {
              expect(vault.write).not.toHaveBeenCalled()
            })
          })

          test('resolves with falsy result', () => {
            return sync.pull().then(result => expect(result).toEqual(false))
          })
        })

        describe('valid data in vault', () => {
          test('writes data to vault', () => {
            return sync.pull().then(() => {
              expect(vault.write).toHaveBeenCalledWith('VAULT DATA')
            })
          })

          test('resolves with truthy result', () => {
            return sync.pull().then(result => expect(result).toEqual(true))
          })
        })
      })
    })
  })
})
