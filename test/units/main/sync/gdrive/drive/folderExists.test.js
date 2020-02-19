import Drive from 'application/sync/gdrive/drive'
import { google } from 'googleapis'

jest.mock('googleapis')

describe('Drive#folderExists', () => {
  const drive = new Drive({})
  const name = 'Swifty'

  afterEach(() => jest.clearAllMocks())

  describe('Folder does not exist', () => {
    beforeEach(() => {
      google.__setListFilesResponse({ files: [] })
    })

    test('google api is called with correct params', async () => {
      await drive.folderExists(name)
      expect(google.drive().files.list).toBeCalledWith({
        q: `name = '${name}' and trashed = false`,
        fields: 'files(id, name)'
      })
    })

    test('returns null', async () => {
      await expect(drive.folderExists(name)).resolves.toEqual(null)
    })
  })

  describe('Folder exists', () => {
    beforeEach(() => {
      google.__setListFilesResponse({
        files: [
          {
            id: '1upGfeNV9Vy5tzTQfk3jI7P5bZvnJCqwa',
            name: name
          }
        ]
      })
    })

    test('returns folder id', async () => {
      await expect(drive.folderExists(name)).resolves.toEqual(
        '1upGfeNV9Vy5tzTQfk3jI7P5bZvnJCqwa'
      )
    })
  })

  describe('Unexpected error', () => {
    beforeEach(() => google.__setListFilesError('unauthorized'))

    test('throws error', async () => {
      await expect(drive.folderExists(name)).rejects.toThrowError(
        'unauthorized'
      )
    })
  })
})
