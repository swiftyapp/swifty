import FileStorage from 'main/storage/file.js'
import fs from 'fs'

jest.mock('fs')

const storage = new FileStorage()

describe('#write', () => {
  storage.write('data')

  afterEach(() => {
    jest.clearAllMocks()
  })

  test('calls fs module to perform write', () => {
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      '/Applications/Swifty/storage_default.swftx',
      'data',
      { flag: 'w' }
    )
  })
})

describe('#read', () => {
  describe('file exists', () => {
    let result
    beforeEach(() => {
      fs.fileExists = jest.fn(() => true)
      fs.readFileSync = jest.fn(() => 'initial data')
      result = storage.read()
    })

    test('calls fs module to read data', () => {
      expect(fs.readFileSync).toHaveBeenCalledWith(
        '/Applications/Swifty/storage_default.swftx'
      )
    })

    test('returns contents of file', () => {
      expect(result).toBe('initial data')
    })
  })

  describe('file does not exist', () => {
    beforeEach(() => {
      fs.fileExists = jest.fn(() => false)
      fs.readFileSync = jest.fn(() => true)
      storage.read()
    })

    test('creates file with default value', () => {
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        '/Applications/Swifty/storage_default.swftx',
        '',
        { flag: 'w' }
      )
    })

    test('calls fs module to read data', () => {
      expect(fs.readFileSync).toHaveBeenCalledWith(
        '/Applications/Swifty/storage_default.swftx'
      )
    })
  })
})

describe('#copy', () => {
  beforeEach(() => {
    fs.copyFileSync = jest.fn(() => true)
    storage.copy('/Desktop/default')
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  test('copies file to new destination', () => {
    expect(fs.copyFileSync).toHaveBeenCalledWith(
      '/Applications/Swifty/storage_default.swftx',
      '/Desktop/default.swftx'
    )
  })
})

describe('#readFile', () => {
  let result
  beforeEach(() => {
    fs.readFileSync = jest.fn(() => 'data from file')
    result = storage.readFile('/Desktop/default.swftx')
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  test('reads file at a given path', () => {
    expect(fs.readFileSync).toHaveBeenCalledWith('/Desktop/default.swftx')
  })

  test('returns contents of the file', () => {
    expect(result).toBe('data from file')
  })
})
