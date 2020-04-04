process.env.GOOGLE_OAUTH_CLIENT_ID = 'google-api-client-key'
process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'google-api-client-secret'

global.CONFIG = {
  apiHost: 'https://example.com',
  googleOauth: {
    scope: 'user,email'
  }
}
