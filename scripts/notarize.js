require('dotenv').config()
const { notarize } = require('electron-notarize')

exports.default = async function notarizing(context) {
  const { electronPlatformName } = context
  if (electronPlatformName !== 'darwin' || process.env.NODE_ENV === 'test') {
    return
  }
  return await notarize({
    tool: process.env.NOTARIZE_TOOL,
    appPath: process.env.MAC_APP_PATH,
    appleId: process.env.APPLEID,
    appleIdPassword: process.env.APPLEIDPASSWORD,
    teamId: process.env.APPLETEAMID
  })
}
