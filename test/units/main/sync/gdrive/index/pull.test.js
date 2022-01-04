import GDrive from 'application/sync/gdrive'
import Drive from 'application/sync/gdrive/drive'

jest.mock('application/sync/gdrive/drive')
jest.mock('application/legacy_vault')

describe('#pull', () => {
  const sync = new GDrive({})
  const drive = new Drive()

  describe('successful pull', () => {
    let result = null

    beforeEach(async () => {
      result = await sync.pull()
    })

    test('checks if folder exists on GDrive', () => {
      expect(drive.folderExists).toHaveBeenCalledWith('Swifty')
    })

    test('checks if vault file exists on GDrive', () => {
      expect(drive.fileExists).toHaveBeenCalledWith('vault.swftx', 'FOLDER_ID')
    })

    test('reads file on GDrive', () => {
      expect(drive.readFile).toHaveBeenCalledWith('FILE_ID')
    })

    test('returns file contentx', () => {
      expect(result).toBe('DATA')
    })
  })

  describe('folder does not exist', () => {
    beforeEach(() => {
      drive.__setFolderExists(false)
    })

    test('throws Folder not found error', async () => {
      await expect(sync.pull()).rejects.toEqual(
        Error('Swifty folder was not found on GDrive')
      )
    })
  })

  describe('file does not exist', () => {
    beforeEach(() => {
      drive.__setFolderExists(true)
      drive.__setFileExists(false)
    })

    test('throws File not found error', async () => {
      await expect(sync.pull()).rejects.toThrowError(
        Error('Vault file was not found on GDrive')
      )
    })
  })

  describe('error while reading file', () => {
    beforeEach(() => {
      drive.__setFileExists(true)
      drive.__setFileReadable(false)
    })

    test('throws error while reading', async () => {
      await expect(sync.pull()).rejects.toThrowError('Could not read file')
    })
  })
})
