import { DateTime } from 'luxon'
const Vault = jest.fn(() => {
  return {
    isDecryptable: jest.fn().mockReturnValue(true),
    read: jest.fn().mockReturnValue({
      entries: [{ id: '2', password: 'qwerty', type: 'login' }],
      updatedAt: DateTime.local().toISO()
    }),
    write: jest.fn()
  }
})
export const vaultFile = jest.fn().mockReturnValue('vault.swftx')
export default Vault
