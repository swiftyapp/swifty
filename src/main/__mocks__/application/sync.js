const Sync = jest.fn(() => {
  return {
    initialize: jest.fn(),
    isConfigured: jest.fn().mockReturnValue(true),
    provider: {
      readTokens: jest.fn(() => {
        return {
          access_token: 'access_token',
          refresh_token: 'refresh_token'
        }
      }),
      writeTokens: jest.fn(),
      push: jest.fn().mockResolvedValue(true)
    }
  }
})
export default Sync
