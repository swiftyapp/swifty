module.exports = {
  google: {
    drive: jest.fn(() => {
      return {
        files: {
          get: jest.fn(),
          list: jest.fn(() => Promise.resolve({ data: null })),
          create: jest.fn(() => Promise.resolve({ data: null }))
        }
      }
    }),
    auth: {
      OAuth2: jest.fn(() => {
        return {
          on: jest.fn(),
          generateAuthUrl: jest.fn(() => 'https://example.com/google_oauth2'),
          setCredentials: jest.fn(),
          getToken: jest.fn()
        }
      })
    }
  }
}
