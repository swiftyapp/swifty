import { DateTime } from 'luxon'

const Vault = jest.fn(() => {
  return {
    isDecryptable: jest.fn().mockReturnValue(true),
    read: jest.fn().mockReturnValue({
      entries: [{ id: '2', password: 'qwerty' }],
      updatedAt: DateTime.local().toISO()
    }),
    write: jest.fn()
  }
})
export default Vault
