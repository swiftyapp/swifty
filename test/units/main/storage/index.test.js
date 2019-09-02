import Storage from 'main/storage/index.js'
import fs from 'fs'

jest.mock('fs')

const storage = new Storage()

describe('Storage', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('#read', () => {
    let result

    describe('file exists', () => {
      beforeEach(() => {
        fs.existsSync = jest.fn(() => true)
        fs.readFileSync = jest.fn(() => 'data')
      })

      describe('relative path', () => {
        beforeEach(() => {
          result = storage.read('storage_default.swftx')
        })

        test('reads file content', () => {
          expect(fs.readFileSync).toHaveBeenCalledWith(
            '/Applications/Swifty/storage_default.swftx'
          )
        })

        test('returns file content', () => {
          expect(result).toBe('data')
        })
      })

      describe('absolute path', () => {
        beforeEach(() => {
          result = storage.read('/Desktop/storage_default.swftx')
        })

        test('reads file content', () => {
          expect(fs.readFileSync).toHaveBeenCalledWith(
            '/Desktop/storage_default.swftx'
          )
        })

        test('returns file content', () => {
          expect(result).toBe('data')
        })
      })
    })

    describe('file do not exist', () => {
      beforeEach(() => {
        fs.existsSync = jest.fn(() => false)
        fs.readFileSync = jest.fn(() => '')
        result = storage.read('storage_default.swftx')
      })

      test('creates file content', () => {
        expect(fs.writeFileSync).toHaveBeenCalledWith(
          '/Applications/Swifty/storage_default.swftx',
          '',
          { flag: 'w' }
        )
      })

      test('returns file content', () => {
        expect(result).toBe('')
      })
    })
  })

  describe('#write', () => {
    let result
    fs.writeFileSync = jest.fn(() => true)

    describe('successfull', () => {
      describe('relative path', () => {
        beforeEach(() => {
          result = storage.write('storage_default.swftx', 'data')
        })
        test('calls fs module to perform write', () => {
          expect(fs.writeFileSync).toHaveBeenCalledWith(
            '/Applications/Swifty/storage_default.swftx',
            'data',
            { flag: 'w' }
          )
        })

        test('returns true on success', () => {
          expect(result).toBe(true)
        })
      })

      describe('absolute path', () => {
        beforeEach(() => {
          result = storage.write('/Desktop/storage_default.swftx', 'data')
        })
        test('calls fs module to perform write', () => {
          expect(fs.writeFileSync).toHaveBeenCalledWith(
            '/Desktop/storage_default.swftx',
            'data',
            { flag: 'w' }
          )
        })

        test('returns true on success', () => {
          expect(result).toBe(true)
        })
      })
    })

    describe('unsuccessfull', () => {
      beforeEach(() => {
        fs.writeFileSync.mockImplementation(() => {
          throw new Error()
        })
        result = storage.write('storage_default.swftx', 'data')
      })

      test('calls fs module to perform write', () => {
        expect(fs.writeFileSync).toHaveBeenCalledWith(
          '/Applications/Swifty/storage_default.swftx',
          'data',
          { flag: 'w' }
        )
      })

      test('returns false on fail', () => {
        expect(result).toBe(false)
      })
    })
  })

  describe('#export', () => {
    let result
    beforeEach(() => {
      fs.copyFileSync = jest.fn(() => true)
    })

    describe('relative path', () => {
      describe('contains extension', () => {
        beforeEach(() => {
          result = storage.export(
            'storage_default.swftx',
            '/Desktop/storage_default.swftx'
          )
        })
        test('copies file', () => {
          expect(fs.copyFileSync).toHaveBeenCalledWith(
            '/Applications/Swifty/storage_default.swftx',
            '/Desktop/storage_default.swftx'
          )
        })

        test('returns true', () => {
          expect(result).toBe(true)
        })
      })

      describe('does not contain extension', () => {
        beforeEach(() => {
          result = storage.export(
            'storage_default.swftx',
            '/Desktop/storage_default'
          )
        })
        test('copies file', () => {
          expect(fs.copyFileSync).toHaveBeenCalledWith(
            '/Applications/Swifty/storage_default.swftx',
            '/Desktop/storage_default.swftx'
          )
        })
      })
    })

    describe('absolute path', () => {
      beforeEach(() => {
        result = storage.export(
          '/Users/dev/storage_default.swftx',
          '/Desktop/storage_default.swftx'
        )
      })
      test('copies file', () => {
        expect(fs.copyFileSync).toHaveBeenCalledWith(
          '/Users/dev/storage_default.swftx',
          '/Desktop/storage_default.swftx'
        )
      })

      test('returns true', () => {
        expect(result).toBe(true)
      })
    })
  })

  describe('#remove', () => {
    let result
    beforeEach(() => {
      fs.unlinkSync = jest.fn(() => true)
      result = storage.remove('/Desktop/storage_default.swftx')
    })
    test('calls fs module to remove file', () => {
      expect(fs.unlinkSync).toHaveBeenCalledWith(
        '/Desktop/storage_default.swftx'
      )
    })

    test('returns true on success', () => {
      expect(result).toBe(true)
    })
  })
})
