require('dotenv').config()
const { notarize } = require('electron-notarize')

exports.default = async function notarizing(context) {
  const { electronPlatformName } = context
  if (electronPlatformName !== 'darwin' || process.env.NODE_ENV === 'test') {
    return
  }

  return await notarize({
    appBundleId: 'com.electron.swifty',
    appPath: `packages/mac/Swifty.app`,
    appleId: process.env.APPLEID,
    appleIdPassword: process.env.APPLEIDPASSWORD
  })
}
