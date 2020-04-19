import { hash } from 'application/helpers/encryption'

jest.unmock('application/helpers/encryption')

describe('Encryption helpers', () => {
  describe('#hash', () => {
    test('returns hashed value', () => {
      expect(hash('password')).toEqual(
        'sQnzu7wkTrgkQZF+0G1hi5AI3Qmzvv0bXgc5THBqi7mAsdd4Xll27ASbRt9fEyavWi6m0QP9B8lThf+rDKy8hg=='
      )
    })
  })
})
