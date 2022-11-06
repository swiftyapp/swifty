import GDrive from 'application/sync/gdrive'
import Drive from 'application/sync/gdrive/drive'

jest.mock('application/sync/gdrive/drive')
jest.mock('application/vault')

describe('#push', () => {
  const sync = new GDrive({})
  const drive = new Drive()

  describe('successful push', () => {
    let result = null

    beforeEach(async () => {
      result = await sync.push('DATA')
    })

    test('checks if folder exists on GDrive', () => {
      expect(drive.folderExists).toHaveBeenCalledWith('Swifty')
    })

    test('checks if vault file exists on GDrive', () => {
      expect(drive.fileExists).toHaveBeenCalledWith('vault.swftx', 'FOLDER_ID')
    })

    test('updates file on GDrive', () => {
      expect(drive.updateFile).toHaveBeenCalledWith('FILE_ID', 'DATA')
    })

    test('returns data', () => {
      expect(result).toBe('DATA')
    })
  })

  describe('folder does not exist', () => {
    let result = null

    describe('folder is creatable', () => {
      beforeEach(async () => {
        drive.__setFolderExists(false)
        drive.__setFileExists(false)
        result = await sync.push('DATA')
      })

      test('it creates folder on GDrive', () => {
        expect(drive.createFolder).toHaveBeenCalledWith('Swifty')
      })

      test('it creates file on GDrive', () => {
        expect(drive.createFile).toHaveBeenCalledWith(
          'vault.swftx',
          'FOLDER_ID',
          'DATA'
        )
      })

      test('returns file id', () => {
        expect(result).toBe('FILE_ID')
      })
    })

    describe('folder is not creatable', () => {
      beforeEach(async () => {
        drive.__setFolderExists(false)
        drive.__setFolderCreatable(false)
      })

      test('it resjects with error', async () => {
        await expect(sync.push('DATA')).rejects.toEqual(
          Error('Failed to create Swifty folder on GDrive')
        )
      })
    })
  })

  describe('file does not exist', () => {
    let result

    describe('file is creatable', () => {
      beforeEach(async () => {
        drive.__setFolderExists(true)
        drive.__setFileExists(false)
        result = await sync.push('DATA')
      })

      test('it creates file on GDrive', () => {
        expect(drive.createFile).toHaveBeenCalledWith(
          'vault.swftx',
          'FOLDER_ID',
          'DATA'
        )
      })

      test('returns file id', () => {
        expect(result).toBe('FILE_ID')
      })
    })

    describe('file is not creatable', () => {
      beforeEach(async () => {
        drive.__setFolderExists(true)
        drive.__setFileExists(false)
        drive.__setFileCreatable(false)
      })

      test('it resjects with error', async () => {
        await expect(sync.push('DATA')).rejects.toEqual(
          Error('Failed to create vault file on GDrive')
        )
      })
    })
  })

  describe('error while reading file', () => {
    beforeEach(() => {
      drive.__setFileExists(true)
      drive.__setFileReadable(false)
    })

    test('throws error while reading', async () => {
      await expect(sync.push('DATA')).rejects.toThrowError(
        'Could not update file'
      )
    })
  })
})
