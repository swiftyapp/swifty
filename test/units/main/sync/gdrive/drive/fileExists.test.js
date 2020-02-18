import Drive from 'application/sync/gdrive/drive'
import { google } from 'googleapis'
jest.mock('googleapis')

describe('Drive#fileExists', () => {
  const drive = new Drive({})
  const filename = 'vault.swftx'
  const parentId = '1upGfeNV9Vy5tzTQfk3jI7P5bZvnJCqwa'

  afterEach(() => jest.clearAllMocks())

  beforeEach(() => {
    google.__setListFilesResponse({ files: [] })
  })

  test('google api is called with correct params', async () => {
    await drive.fileExists(filename, parentId)
    expect(google.drive().files.list).toBeCalledWith({
      q: `name = '${filename}' and '${parentId}' in parents`,
      fields: 'files(id, name)'
    })
  })

  describe('File does not exist', () => {
    test('returns null', async () => {
      await expect(drive.fileExists(filename, parentId)).resolves.toEqual(null)
    })
  })

  describe('File exists', () => {
    beforeEach(() => {
      google.__setListFilesResponse({
        files: [
          {
            id: '3vnGfeNV9Vy5tzTQfk3jI7P5bZvnJCdas',
            name: filename
          }
        ]
      })
    })

    test('returns file id', async () => {
      await expect(drive.fileExists(filename, parentId)).resolves.toEqual(
        '3vnGfeNV9Vy5tzTQfk3jI7P5bZvnJCdas'
      )
    })
  })

  describe('Unexpected error', () => {
    beforeEach(() => google.__setListFilesError('Unauthorized'))

    test('throws error', async () => {
      await expect(drive.fileExists(filename, parentId)).rejects.toThrowError(
        'Unauthorized'
      )
    })
  })
})
