const Vault = jest.fn(() => {
  return {
    isDecryptable: jest.fn().mockReturnValue(true),
    read: jest.fn().mockReturnValue({
      entries: [{ id: '2', password: 'qwerty' }]
    }),
    write: jest.fn()
  }
})
export default Vault
