import Drive from 'application/sync/gdrive/drive'
import { google } from 'googleapis'
jest.mock('googleapis')

describe('Drive#updateFile', () => {
  const drive = new Drive({})
  const id = '1upGfeNV9Vy5tzTQfk3jI7P5bZvnJCqwa'
  const content = 'DATA'
  const mimeType = 'application/vnd.swftx'

  afterEach(() => jest.clearAllMocks())

  describe('Successful update', () => {
    beforeEach(() => {
      google.__setUpdateFileResponse({
        kind: 'drive#file',
        id: '3cpADaNV9Vy5tzTQfk3jI7P5bZvnJCdsa',
        name: name,
        mimeType: mimeType
      })
    })

    test('google api is called with correct params', async () => {
      await drive.updateFile(id, content)
      expect(google.drive().files.update).toBeCalledWith({
        fileId: id,
        media: {
          mimeType: mimeType,
          body: content
        }
      })
    })

    test('returns file id', async () => {
      await expect(drive.updateFile(name, content)).resolves.toEqual(
        '3cpADaNV9Vy5tzTQfk3jI7P5bZvnJCdsa'
      )
    })
  })

  describe('Unexpected error', () => {
    beforeEach(() => google.__setUpdateFileError('File not found'))

    test('throws error', async () => {
      await expect(drive.updateFile(id, content)).rejects.toThrowError(
        'File not found'
      )
    })
  })
})
