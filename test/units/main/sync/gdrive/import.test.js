import GDrive from 'main/application/sync/gdrive'
import AuthWindow from 'main/window/auth'
import Drive from 'main/application/sync/gdrive/drive'
jest.mock('main/application/sync/gdrive/drive')

const mockCloseAuth = jest.fn()
const mockRemoveMenu = jest.fn()

jest.mock('main/window/auth', () => {
  return jest.fn().mockImplementation(() => {
    return {
      removeMenu: mockRemoveMenu,
      authenticate: jest.fn(() => Promise.resolve('AUTH_CODE')),
      close: mockCloseAuth
    }
  })
})

describe('#import', () => {
  const sync = new GDrive({})
  const drive = new Drive()

  afterEach(() => {
    Drive.mockClear()
    jest.clearAllMocks()
  })

  test('initializes drive auth client', async () => {
    await sync.import()
    expect(Drive).toHaveBeenCalledWith(sync.auth)
  })

  test('opens auth window with auth url', async () => {
    await sync.import()
    expect(AuthWindow).toHaveBeenCalledWith('https://example.com/google_oauth2')
  })

  test('removes menu from auth window', async () => {
    await sync.import()
    expect(mockRemoveMenu).toHaveBeenCalledTimes(1)
  })

  test('closes auth window on authentication done', async () => {
    await sync.import()
    expect(mockCloseAuth).toHaveBeenCalledTimes(1)
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
