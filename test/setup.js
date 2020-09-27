const fs = require('fs')
const path = require('path')

const { Application } = require('spectron')

process.env.GOOGLE_OAUTH_CLIENT_ID = 'google-api-client-key'
process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'google-api-client-secret'

global.CONFIG = {
  apiHost: 'https://example.com',
  googleOauth: {
    scope: 'user,email'
  }
}

const fixturePath = file => {
  return path.join(process.cwd(), 'test', 'fixtures', file)
}

const storageFile = () => {
  return path.join(process.cwd(), 'test', '.storage', 'default.swftx')
}

const prepareStorage = storage => {
  try {
    let data = ''
    if (storage !== 'pristine') {
      data = fs.readFileSync(fixturePath(`${storage}.txt`)).toString('utf-8')
    }
    fs.writeFileSync(storageFile(), data, { flag: 'w' })
  } catch (error) {
    console.log(error)
  }
}

const appPath = () => {
  switch (process.platform) {
    case 'darwin':
      return path.join(
        __dirname,
        '..',
        '.tmp',
        'mac',
        'Swifty.app',
        'Contents',
        'MacOS',
        'Swifty'
      )
    case 'linux':
      return path.join(__dirname, '..', '.tmp', 'linux-unpacked', 'swifty')
    default:
      throw Error('Unsupported platform')
  }
}

global.before = async options => {
  if (options && options.storage) prepareStorage(options.storage)
  return await app.start()
}

global.after = async () => await app.stop()

global.app = new Application({
  path: appPath(),
  env: {
    SPECTRON_STORAGE_PATH: storageFile(),
    RUNNING_IN_SPECTRON: 1,
    APP_ENV: 'test'
  }
})
