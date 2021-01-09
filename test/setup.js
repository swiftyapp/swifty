const { Application } = require('spectron')

const { appPath, storageFile, prepareStorage, cleanup } = require('./utils')

process.env.GOOGLE_OAUTH_CLIENT_ID = 'google-api-client-key'
process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'google-api-client-secret'

global.CONFIG = {
  apiHost: 'https://example.com',
  googleOauth: {
    scope: 'user,email'
  }
}

global.before = async ({ storage } = {}) => {
  if (storage) prepareStorage(storage)
  await app.start()
}

global.after = async () => {
  if (app.running) await app.stop()
  await cleanup()
}

global.app = new Application({
  path: appPath(),
  env: {
    SPECTRON_STORAGE_PATH: storageFile(),
    RUNNING_IN_SPECTRON: 1,
    APP_ENV: 'test'
  }
})
