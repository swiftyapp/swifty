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
  // let sync, folderExistsMock, fileExistsMock, fileContentMock
  // const drive = {
  //   files: {
  //     get: jest.fn(() => fileContentMock()),
  //     list: jest.fn(options => {
  //       if (options.q === "name = 'Swifty' and trashed = false") {
  //         return folderExistsMock()
  //       } else {
  //         return fileExistsMock()
  //       }
  //     }),
  //     create: jest.fn()
  //   }
  // }
  // google.drive = jest.fn(() => drive)

  // beforeEach(() => {
  //   fileContentMock = () => Promise.resolve({ data: 'VAULT DATA' })
  //   folderExistsMock = () =>
  //     Promise.resolve({ data: { files: [{ id: 'asdfg' }] } })
  //   fileExistsMock = () =>
  //     Promise.resolve({ data: { files: [{ id: 'qwerty' }] } })
  //   sync = new GDrive()
  //   sync.initialize({})
  // })

  // afterEach(() => {
  //   jest.clearAllMocks()
  // })

  // test('opens auth window with auth url', () => {
  //   return sync.import().then(() => {
  //     expect(AuthWindow).toHaveBeenCalledWith(
  //       'https://example.com/google_oauth2'
  //     )
  //   })
  // })

  // test('removes menu from auth window', () => {
  //   return sync.import().then(() => {
  //     expect(mockRemoveMenu).toHaveBeenCalledTimes(1)
  //   })
  // })

  // test('closes auth window on authentication done', () => {
  //   return sync.import().then(() => {
  //     expect(mockCloseAuth).toHaveBeenCalledTimes(1)
  //   })
  // })

  // test('calls get token with auth code', () => {
  //   return sync.import().then(() => {
  //     expect(sync.client.auth.getToken).toHaveBeenCalledWith('AUTH_CODE')
  //   })
  // })

  // test('initializes drive client', () => {
  //   return sync.import().then(() => {
  //     expect(google.drive).toHaveBeenCalledWith({
  //       version: 'v3',
  //       auth: sync.client.auth
  //     })
  //   })
  // })

  // describe('folder does not exist', () => {
  //   beforeEach(() => {
  //     folderExistsMock = () => Promise.resolve({})
  //   })

  //   test('checks for presence of swifty folder', () => {
  //     return sync.import().then(() => {
  //       expect(drive.files.list).toHaveBeenCalledWith({
  //         q: "name = 'Swifty' and trashed = false",
  //         fields: 'files(id, name)'
  //       })
  //     })
  //   })

  //   test('does not create swifty folder', () => {
  //     return sync.import().then(() => {
  //       expect(drive.files.create).not.toHaveBeenCalled()
  //     })
  //   })

  //   // test('does not write data to vault', () => {
  //   //   return sync.import().then(() => {
  //   //     expect(vault.write).not.toHaveBeenCalled()
  //   //   })
  //   // })

  //   test('resolves with null result', () => {
  //     return sync.import().then(result => expect(result).toEqual(null))
  //   })
  // })

  // describe('folder exists', () => {
  //   describe('file does not exist', () => {
  //     beforeEach(() => {
  //       fileExistsMock = () => Promise.resolve({})
  //     })

  //     test('checks for presence of swifty folder', () => {
  //       return sync.import().then(() => {
  //         expect(drive.files.list).toHaveBeenCalledWith({
  //           q: "name = 'Swifty' and trashed = false",
  //           fields: 'files(id, name)'
  //         })
  //       })
  //     })

  //     test('checks for presence of vault file', () => {
  //       return sync.import().then(() => {
  //         expect(drive.files.list).toHaveBeenCalledWith({
  //           q: "name = 'vault.swftx' and 'asdfg' in parents",
  //           fields: 'files(id, name)'
  //         })
  //       })
  //     })

  //     test('does not read vault file', () => {
  //       return sync.import().then(() => {
  //         expect(drive.files.get).not.toHaveBeenCalled()
  //       })
  //     })
  //   })
  //   describe('file exists', () => {
  //     test('checks for presence of swifty folder', () => {
  //       return sync.import().then(() => {
  //         expect(drive.files.list).toHaveBeenCalledWith({
  //           q: "name = 'Swifty' and trashed = false",
  //           fields: 'files(id, name)'
  //         })
  //       })
  //     })

  //     test('checks for presence of vault file', () => {
  //       return sync.import().then(() => {
  //         expect(drive.files.list).toHaveBeenCalledWith({
  //           q: "name = 'vault.swftx' and 'asdfg' in parents",
  //           fields: 'files(id, name)'
  //         })
  //       })
  //     })

  //     test('reads vault file', () => {
  //       return sync.import().then(() => {
  //         expect(drive.files.get).toHaveBeenCalledWith({
  //           fileId: 'qwerty',
  //           alt: 'media'
  //         })
  //       })
  //     })

  //     test('resolves with imported data', () => {
  //       return sync.import().then(result => {
  //         expect(result).toEqual('VAULT DATA')
  //       })
  //     })
  //   })
  // })
})
