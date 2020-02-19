import Drive from 'application/sync/gdrive/drive'
import { google } from 'googleapis'
jest.mock('googleapis')

describe('Drive#readFile', () => {
  const drive = new Drive({})
  const id = '1upGfeNV9Vy5tzTQfk3jI7P5bZvnJCqwa'

  afterEach(() => jest.clearAllMocks())

  describe('File exists', () => {
    test('google api is called with correct params', async () => {
      await drive.readFile(id)
      expect(google.drive().files.get).toBeCalledWith({
        fileId: id,
        alt: 'media'
      })
    })

    test('returns file content', async () => {
      await expect(drive.readFile(id)).resolves.toEqual('CONTENT')
    })
  })

  describe('File not founc', () => {
    test('throws error', async () => {
      await expect(drive.readFile('NON_EXISTING_ID')).rejects.toThrowError(
        'File not found'
      )
    })
  })
})
