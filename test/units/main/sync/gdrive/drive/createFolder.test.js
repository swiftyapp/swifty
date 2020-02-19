import Drive from 'application/sync/gdrive/drive'
import { google } from 'googleapis'
jest.mock('googleapis')

describe('Drive#createFolder', () => {
  const drive = new Drive({})
  const name = 'Swifty'
  const mimeType = 'application/vnd.google-apps.folder'

  afterEach(() => jest.clearAllMocks())

  describe('Successful creation', () => {
    beforeEach(() => {
      google.__setCreateFileResponse({
        kind: 'drive#folder',
        id: '1upGfeNV9Vy5tzTQfk3jI7P5bZvnJCqwa',
        name: name,
        mimeType: mimeType
      })
    })

    test('google api is called with correct params', async () => {
      await drive.createFolder(name)
      expect(google.drive().files.create).toBeCalledWith({
        requestBody: {
          name: name,
          mimeType: mimeType
        }
      })
    })

    test('returns file id', async () => {
      await expect(drive.createFolder(name)).resolves.toEqual(
        '1upGfeNV9Vy5tzTQfk3jI7P5bZvnJCqwa'
      )
    })
  })

  describe('Unexpected error', () => {
    beforeEach(() => google.__setCreateFileError('Unauthorized'))

    test('throws error', async () => {
      await expect(drive.createFolder(name)).rejects.toThrowError(
        'Unauthorized'
      )
    })
  })
})
