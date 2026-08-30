import Drive from 'application/sync/gdrive/drive'
import { google } from 'googleapis'
jest.mock('googleapis')

describe('Drive#createFile', () => {
  const drive = new Drive({})
  const name = 'vault.swftx'
  const parentId = '1upGfeNV9Vy5tzTQfk3jI7P5bZvnJCqwa'
  const content = 'DATA'
  const mimeType = 'application/vnd.swftx'

  describe('Successful creation', () => {
    beforeEach(() => {
      google.__setCreateFileResponse({
        kind: 'drive#file',
        id: '3cpADaNV9Vy5tzTQfk3jI7P5bZvnJCdsa',
        name: name,
        mimeType: mimeType
      })
    })

    test('google api is called with correct params', async () => {
      await drive.createFile(name, parentId, content)
      expect(google.drive().files.create).toBeCalledWith({
        media: {
          mimeType: mimeType,
          body: 'DATA'
        },
        requestBody: {
          name: name,
          mimeType: mimeType,
          parents: [parentId]
        }
      })
    })

    test('returns file id', async () => {
      await expect(drive.createFile(name, parentId, content)).resolves.toEqual(
        '3cpADaNV9Vy5tzTQfk3jI7P5bZvnJCdsa'
      )
    })
  })

  describe('Unexpected error', () => {
    beforeEach(() => google.__setCreateFileError('unauthorized_client'))

    test('throws error', async () => {
      await expect(
        drive.createFile(name, parentId, content)
      ).rejects.toThrowError('unauthorized_client')
    })
  })
})
