import Storage from 'application/storage'
import VaultManager from 'application/vault_manager'
import { Cryptor } from 'application/cryptor'

jest.unmock('application/cryptor')
jest.mock('application/storage')

let vault
let cryptor = new Cryptor()

describe('Vault', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('#authenticate', () => {
    describe('valid data and correct cryptor', () => {
      beforeEach(() => {
        Storage.mockImplementation(() => ({
          read: jest.fn(() => 'eyJwYXNzd29yZCI6ICJhc2RmcXdlcnR5In0=')
        }))
        vault = new VaultManager().vault
      })

      describe('valid cryptor', () => {
        test('returns true', () => {
          expect(vault.authenticate(cryptor)).toBe(true)
        })
      })

      describe('invalid cryptor', () => {
        let cryptor = {
          decrypt: jest.fn(() => {
            throw new Error()
          })
        }

        test('returns false', () => {
          expect(vault.authenticate(cryptor)).toBe(false)
        })
      })
    })

    describe('invalid data and correct cryptor', () => {
      beforeEach(() => {
        Storage.mockImplementation(() => ({
          read: jest.fn(() => 'eyJwYXXdlcnR5In0=')
        }))
        vault = new VaultManager().vault
      })

      test('returns false', () => {
        expect(vault.authenticate(cryptor)).toBe(false)
      })
    })
  })

  describe('#setup', () => {
    let result

    describe('successfull setup', () => {
      let write = jest.fn(() => true)

      beforeEach(() => {
        Storage.mockImplementation(() => ({ write }))
        vault = new VaultManager().vault
        result = vault.setup(cryptor)
      })
      test('returns true', () => {
        expect(result).toBe(true)
      })

      test('writes data to vault file', () => {
        expect(write).toHaveBeenCalledWith('eyJlbnRyaWVzIjpbXX0=')
      })
    })

    describe('unsuccessfull setup', () => {
      let write = jest.fn(() => false)
      beforeEach(() => {
        Storage.mockImplementation(() => ({ write }))
        vault = new VaultManager().vault
        result = vault.setup(cryptor)
      })
      test('returns true', () => {
        expect(result).toBe(false)
      })

      test('writes data to vault file', () => {
        expect(write).toHaveBeenCalledWith('eyJlbnRyaWVzIjpbXX0=')
      })
    })
  })

  describe('#isPristine', () => {
    describe('vault file empty', () => {
      let read = jest.fn(() => '')
      beforeEach(() => {
        Storage.mockImplementation(() => ({ read }))
        vault = new VaultManager().vault
      })

      test('returns true', () => {
        expect(vault.isPristine()).toBe(true)
      })
    })

    describe('vault file not empty', () => {
      let read = jest.fn(() => 'eyJlbnRyaWVzIjpbXX0=')
      beforeEach(() => {
        Storage.mockImplementation(() => ({ read }))
        vault = new VaultManager().vault
      })

      test('returns true', () => {
        expect(vault.isPristine()).toBe(false)
      })
    })
  })

  describe('#write', () => {
    let write = jest.fn()
    beforeEach(() => {
      Storage.mockImplementation(() => ({ write }))
      vault = new VaultManager().vault
      vault.write('data')
    })

    test('calls storage write method', () => {
      expect(write).toHaveBeenCalledWith('data')
    })
  })

  describe('#read', () => {
    let read = jest.fn()
    beforeEach(() => {
      Storage.mockImplementation(() => ({ read }))
      vault = new VaultManager().vault
      vault.read()
    })

    test('calls storage read method', () => {
      expect(read).toHaveBeenCalledTimes(1)
    })
  })

  describe('#import', () => {
    let result

    describe('valid backup', () => {
      let importMock = jest.fn(() => 'eyJwYXNzd29yZCI6ICJhc2RmcXdlcnR5In0=')
      let write = jest.fn(() => true)

      beforeEach(() => {
        Storage.mockImplementation(() => ({ import: importMock, write }))
        vault = new VaultManager().vault
        result = vault.import('/users/test', cryptor)
      })

      test('returns true', () => {
        expect(result).toBe(true)
      })

      test('calls storage import with path', () => {
        expect(importMock).toHaveBeenCalledWith('/users/test')
      })

      test('calls storage write with data', () => {
        expect(write).toHaveBeenCalledWith(
          'eyJwYXNzd29yZCI6ICJhc2RmcXdlcnR5In0='
        )
      })
    })

    describe('invalid backup', () => {
      let importMock = jest.fn(() => 'hello')
      let write = jest.fn(() => true)

      beforeEach(() => {
        Storage.mockImplementation(() => ({ import: importMock, write }))
        vault = new VaultManager().vault
        result = vault.import('/users/test', cryptor)
      })

      test('returns false', () => {
        expect(result).toBe(false)
      })

      test('calls storage import with path', () => {
        expect(importMock).toHaveBeenCalledWith('/users/test')
      })

      test('does not call storage write with data', () => {
        expect(write).not.toHaveBeenCalled()
      })
    })
  })

  describe('#export', () => {
    let exportMock = jest.fn()
    beforeEach(() => {
      Storage.mockImplementation(() => ({ export: exportMock }))
      vault = new VaultManager().vault
      vault.export('/users/test')
    })

    test('calls storage export method', () => {
      expect(exportMock).toHaveBeenCalledWith('/users/test')
    })
  })
})
