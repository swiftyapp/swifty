import Storage from 'main/application/storage'
import fs from 'fs-extra'

jest.mock('fs')

let storage

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
          storage = new Storage('storage_default.swftx')
          result = storage.read()
        })

        test('reads file content', () => {
          expect(fs.readFileSync).toHaveBeenCalledWith(
            '/tmp/Swifty/storage_default.swftx'
          )
        })

        test('returns file content', () => {
          expect(result).toBe('data')
        })
      })

      describe('absolute path', () => {
        beforeEach(() => {
          storage = new Storage('/Desktop/storage_default.swftx')
          result = storage.read()
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
        fs.ensureFileSync = jest.fn(() => true)
        fs.readFileSync = jest.fn(() => '')
        storage = new Storage('storage_default.swftx')
        result = storage.read()
      })

      test('creates file content', () => {
        expect(fs.ensureFileSync).toHaveBeenCalledWith(
          '/tmp/Swifty/storage_default.swftx'
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
          storage = new Storage('storage_default.swftx')
          result = storage.write('data')
        })
        test('calls fs module to perform write', () => {
          expect(fs.writeFileSync).toHaveBeenCalledWith(
            '/tmp/Swifty/storage_default.swftx',
            'data',
            {
              flag: 'w'
            }
          )
        })

        test('returns true on success', () => {
          expect(result).toBe(true)
        })
      })

      describe('absolute path', () => {
        beforeEach(() => {
          storage = new Storage('/Desktop/storage_default.swftx')
          result = storage.write('data')
        })
        test('calls fs module to perform write', () => {
          expect(fs.writeFileSync).toHaveBeenCalledWith(
            '/Desktop/storage_default.swftx',
            'data',
            {
              flag: 'w'
            }
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
        storage = new Storage('storage_default.swftx')
        result = storage.write('data')
      })

      test('calls fs module to perform write', () => {
        expect(fs.writeFileSync).toHaveBeenCalledWith(
          '/tmp/Swifty/storage_default.swftx',
          'data',
          {
            flag: 'w'
          }
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
          storage = new Storage('storage_default.swftx')
          result = storage.export('/Desktop/storage_default.swftx')
        })
        test('copies file', () => {
          expect(fs.copyFileSync).toHaveBeenCalledWith(
            '/tmp/Swifty/storage_default.swftx',
            '/Desktop/storage_default.swftx'
          )
        })

        test('returns true', () => {
          expect(result).toBe(true)
        })
      })

      describe('does not contain extension', () => {
        beforeEach(() => {
          storage = new Storage('storage_default.swftx')
          result = storage.export('/Desktop/storage_default')
        })
        test('copies file', () => {
          expect(fs.copyFileSync).toHaveBeenCalledWith(
            '/tmp/Swifty/storage_default.swftx',
            '/Desktop/storage_default.swftx'
          )
        })
      })
    })

    describe('absolute path', () => {
      beforeEach(() => {
        storage = new Storage('/Users/dev/storage_default.swftx')
        result = storage.export('/Desktop/storage_default.swftx')
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
})
