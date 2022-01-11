import { DateTime } from 'luxon'
const LegacyVault = jest.fn(() => {
  return {
    isDecryptable: jest.fn().mockReturnValue(true),
    read: jest.fn().mockReturnValue({
      entries: [{ id: '2', password: 'qwerty', type: 'login' }],
      updatedAt: DateTime.local().toISO()
    }),
    write: jest.fn()
  }
})
export const legacyVaultPath = jest.fn().mockReturnValue('vault.swftx')
export default LegacyVault
