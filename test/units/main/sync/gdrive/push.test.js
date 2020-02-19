import GDrive from 'main/application/sync/gdrive'
import { google } from 'googleapis'

describe('#push', () => {
  // let sync,
  //   folderExistsMock,
  //   fileExistsMock,
  //   folderCreateMock,
  //   fileCreateMock,
  //   fileUpdateMock

  // const drive = {
  //   files: {
  //     list: jest.fn(options => {
  //       if (options.q === "name = 'Swifty' and trashed = false") {
  //         return folderExistsMock()
  //       } else {
  //         return fileExistsMock()
  //       }
  //     }),
  //     create: jest.fn(options => {
  //       if (!options.media) {
  //         return folderCreateMock()
  //       } else {
  //         return fileCreateMock()
  //       }
  //     }),
  //     update: jest.fn(() => fileUpdateMock())
  //   }
  // }
  // google.drive = jest.fn(() => drive)

  // beforeEach(() => {
  //   folderCreateMock = () =>
  //     Promise.resolve({ status: 200, data: { id: 'asdfg' } })
  //   fileCreateMock = () =>
  //     Promise.resolve({ status: 200, data: { id: 'qwerty' } })
  //   fileUpdateMock = () => Promise.resolve(true)
  //   folderExistsMock = () =>
  //     Promise.resolve({ data: { files: [{ id: 'asdfg' }] } })
  //   fileExistsMock = () =>
  //     Promise.resolve({ data: { files: [{ id: 'qwerty' }] } })
  //   const cryptor = {
  //     decrypt: () => '{"access_token": "qwert","refresh_token": "asdf"}'
  //   }
  //   // const vault = {
  //   //   read: jest.fn(() => 'VAULT DATA'),
  //   //   write: jest.fn(),
  //   //   isDecryptable: () => true
  //   // }
  //   sync = new GDrive()
  //   sync.initialize(cryptor)
  // })

  // afterEach(() => {
  //   jest.clearAllMocks()
  // })

  // test('initializes drive client', () => {
  //   return sync.push().then(() => {
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
  //     return sync.push().then(() => {
  //       expect(drive.files.list).toHaveBeenCalledWith({
  //         q: "name = 'Swifty' and trashed = false",
  //         fields: 'files(id, name)'
  //       })
  //     })
  //   })

  //   test('creates swifty folder', () => {
  //     return sync.push().then(() => {
  //       expect(drive.files.create).toHaveBeenCalledWith({
  //         requestBody: {
  //           name: 'Swifty',
  //           mimeType: 'application/vnd.google-apps.folder'
  //         }
  //       })
  //     })
  //   })

  //   test('does not check for vault file', () => {
  //     return sync.push().then(() => {
  //       expect(drive.files.list).not.toHaveBeenCalledWith({
  //         q: "name = 'vault.swftx' and 'asdfg' in parents",
  //         fields: 'files(id, name)'
  //       })
  //     })
  //   })

  //   test('creates vault file', () => {
  //     return sync.push().then(() => {
  //       expect(drive.files.create).toHaveBeenCalledWith({
  //         requestBody: {
  //           name: 'vault.swftx',
  //           mimeType: 'application/vnd.swftx',
  //           parents: ['asdfg']
  //         },
  //         media: { body: 'VAULT DATA' }
  //       })
  //     })
  //   })

  //   test('resolves with truthy result', () => {
  //     return sync.push().then(result => {
  //       expect(result).toEqual(true)
  //     })
  //   })
  // })

  // describe('folder exists', () => {
  //   describe('file does not exist', () => {
  //     beforeEach(() => {
  //       fileExistsMock = () => Promise.resolve({})
  //     })

  //     test('checks for presence of swifty folder', () => {
  //       return sync.push().then(() => {
  //         expect(drive.files.list).toHaveBeenCalledWith({
  //           q: "name = 'Swifty' and trashed = false",
  //           fields: 'files(id, name)'
  //         })
  //       })
  //     })

  //     test('does not try to create swifty folder', () => {
  //       return sync.push().then(() => {
  //         expect(drive.files.create).not.toHaveBeenCalledWith({
  //           requestBody: {
  //             name: 'Swifty',
  //             mimeType: 'application/vnd.google-apps.folder'
  //           }
  //         })
  //       })
  //     })

  //     test('checks for presence of vault file', () => {
  //       return sync.push().then(() => {
  //         expect(drive.files.list).toHaveBeenCalledWith({
  //           q: "name = 'vault.swftx' and 'asdfg' in parents",
  //           fields: 'files(id, name)'
  //         })
  //       })
  //     })

  //     test('creates vault file', () => {
  //       return sync.push().then(() => {
  //         expect(drive.files.create).toHaveBeenCalledWith({
  //           requestBody: {
  //             name: 'vault.swftx',
  //             mimeType: 'application/vnd.swftx',
  //             parents: ['asdfg']
  //           },
  //           media: { body: 'VAULT DATA' }
  //         })
  //       })
  //     })

  //     test('resolves with truthy result', () => {
  //       return sync.push().then(result => {
  //         expect(result).toEqual(true)
  //       })
  //     })
  //   })

  //   describe('file exists', () => {
  //     test('checks for presence of swifty folder', () => {
  //       return sync.push().then(() => {
  //         expect(drive.files.list).toHaveBeenCalledWith({
  //           q: "name = 'Swifty' and trashed = false",
  //           fields: 'files(id, name)'
  //         })
  //       })
  //     })

  //     test('does not try to create swifty folder', () => {
  //       return sync.push().then(() => {
  //         expect(drive.files.create).not.toHaveBeenCalledWith({
  //           requestBody: {
  //             name: 'Swifty',
  //             mimeType: 'application/vnd.google-apps.folder'
  //           }
  //         })
  //       })
  //     })

  //     test('checks for presence of vault file', () => {
  //       return sync.push().then(() => {
  //         expect(drive.files.list).toHaveBeenCalledWith({
  //           q: "name = 'vault.swftx' and 'asdfg' in parents",
  //           fields: 'files(id, name)'
  //         })
  //       })
  //     })

  //     test('does not try to create vault file', () => {
  //       return sync.push().then(() => {
  //         expect(drive.files.create).not.toHaveBeenCalledWith({
  //           requestBody: {
  //             name: 'vault.swftx',
  //             mimeType: 'application/vnd.swftx',
  //             parents: ['asdfg']
  //           },
  //           media: { body: 'VAULT DATA' }
  //         })
  //       })
  //     })

  //     test('updates file', () => {
  //       return sync.push().then(() => {
  //         expect(drive.files.update).toHaveBeenCalledWith({
  //           fileId: 'qwerty',
  //           mimeType: 'application/vnd.swftx',
  //           media: { body: 'VAULT DATA' }
  //         })
  //       })
  //     })

  //     test('resolves with truthy result', () => {
  //       return sync.push().then(result => {
  //         expect(result).toEqual(true)
  //       })
  //     })
  //   })
  // })
})
