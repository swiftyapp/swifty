import { DateTime } from 'luxon'
const VaultManager = jest.fn(() => {
  return {
    isDecryptable: jest.fn().mockReturnValue(true),
    read: jest.fn().mockReturnValue({
      entries: [{ id: '2', password: 'qwerty', type: 'login' }],
      updatedAt: DateTime.local().toISO()
    }),
    write: jest.fn()
  }
})
export default VaultManager
