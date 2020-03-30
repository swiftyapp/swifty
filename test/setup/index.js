process.env.GOOGLE_OAUTH_CLIENT_ID = 'google-api-client-key'
process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'google-api-client-secret'

global.CONFIG = {
  apiHost: 'https://example.com',
  googleOauth: {
    scope: 'user,email'
  }
}
global.mockDate = () => {
  let currentDate = new Date()
  const RealDate = Date
  global.Date = jest.fn(() => new RealDate(currentDate.toISOString()))
  return currentDate
}
