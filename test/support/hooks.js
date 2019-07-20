const helper = require('../helper')

const before = () => {
  global.app = new Application({
    path: helper.appPath(),
    env: { SPECTRON_STORAGE_PATH: helper.assetPath('storage.swftx') }
  })
  return app.start()
}

const after = () => {
  helper.restoreStorage()
  if (app && app.isRunning()) {
    return app.stop()
  }
}
module.exports = { before, after }
