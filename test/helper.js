require('./support/globals')
const fs = require('fs')

const assetPath = (file) => {
  return path.join(process.cwd(), 'test', 'assets', file)
}

const appPath = () => {
  switch (process.platform) {
    case 'darwin':
      return path.join(__dirname, '..', '.tmp', 'mac', 'Swifty.app', 'Contents', 'MacOS', 'Swifty')
    case 'linux':
      return path.join(__dirname, '..', '.tmp', 'linux-unpacked', 'swifty')
    default:
      throw 'Unsupported platform'
  }
}

const fixturePath = (file) => {
  return path.join(process.cwd(), 'test', 'fixtures', file)
}

const storageFile = () => {
  return path.join(process.cwd(), 'test', 'storage', 'default.swftx')
}

const restoreStorage = () => {
  fs.writeFileSync(helper.assetPath('empty.swftx'), '{"token":null,"entries":[]}', { flag: 'w' })
  fs.writeFileSync(
    helper.assetPath('storage.swftx'), '{"token":"2b9c597f97318e3598d7241f58a3fa54fcf610a17c11b1dfc7aecb8966c3eaeafb7e132e4dba56fdfaa7dd074857414ab918c4e52834c0c6","entries":[]}',
    { flag: 'w' }
  )
}

const prepareStorage = storage => {
  try {
    const data = JSON.parse(fs.readFileSync(fixturePath(`${storage}.txt`)))
    fs.writeFileSync(storageFile(), JSON.stringify(data), { flag: 'w' })
  } catch (error) {
    console.log(error)
  }
}

const beforeHelper = options => {
  if (options && options.storage) prepareStorage(options.storage)
  global.app = new Application({
    path: appPath(),
    env: { SPECTRON_STORAGE_PATH: storageFile() }
  })
  return app.start()
}

const afterHelper = () => {
  if (app && app.isRunning()) {
    return app.stop()
  }
}

module.exports = { assetPath, appPath, restoreStorage, beforeHelper, afterHelper }
