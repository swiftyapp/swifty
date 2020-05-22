import GDrive from 'application/sync/gdrive'
import Drive from 'application/sync/gdrive/drive'
import { shell } from 'electron'

jest.mock('http')
jest.mock('application/sync/gdrive/drive')

let sync, drive

describe('#import', () => {
  beforeEach(() => {
    sync = new GDrive({})
    drive = new Drive()
  })

  test('initializes drive auth client', async () => {
    await sync.import()
    expect(Drive).toHaveBeenCalledWith(sync.auth)
  })

  test('opens auth url in browser tab', async () => {
    await sync.import()
    expect(shell.openExternal).toHaveBeenCalledWith(
      'https://example.com/google_oauth2'
    )
  })

  test('calls get token with auth code', async () => {
    await sync.import()
    expect(sync.auth.auth.getToken).toHaveBeenCalledWith('AUTH_CODE')
  })

  describe('folder does not exist', () => {
    beforeEach(async () => {
      drive.__setFolderExists(false)
    })

    test('rejects with error', async () => {
      await expect(sync.import()).rejects.toEqual(
        Error('Swifty folder was not found on GDrive')
      )
    })
  })

  describe('folder exists', () => {
    describe('file does not exist', () => {
      beforeEach(() => {
        drive.__setFolderExists(true)
        drive.__setFileExists(false)
      })

      test('rejects with error', async () => {
        await expect(sync.import()).rejects.toEqual(
          Error('Vault file was not found on GDrive')
        )
      })
    })

    describe('file exists', () => {
      let result
      beforeEach(async () => {
        drive.__setFileExists(true)
        result = await sync.import()
      })

      test('checks if folder exists on GDrive', () => {
        expect(drive.folderExists).toHaveBeenCalledWith('Swifty')
      })

      test('checks if vault file exists on GDrive', () => {
        expect(drive.fileExists).toHaveBeenCalledWith(
          'vault.swftx',
          'FOLDER_ID'
        )
      })

      test('reads file on GDrive', () => {
        expect(drive.readFile).toHaveBeenCalledWith('FILE_ID')
      })

      test('returns file contentx', () => {
        expect(result).toBe('DATA')
      })
    })
  })
})
