require('dotenv').config()
const { notarize } = require('@electron/notarize')
const os = require('os')

exports.default = async function notarizing(context) {
  const { electronPlatformName } = context

  if (electronPlatformName !== 'darwin' || process.env.NODE_ENV === 'test') {
    return
  }
  const dir = os.arch() === 'arm64' ? 'mac-arm64' : 'mac'

  try {
    return await notarize({
      tool: process.env.NOTARIZE_TOOL,
      teamId: process.env.APPLETEAMID,
      appBundleId: 'com.electron.swifty',
      appPath: `packages/${dir}/Swifty.app`,
      appleId: process.env.APPLEID,
      appleIdPassword: process.env.APPLEIDPASSWORD
    })
  } catch (error) {
    console.log(error)
  }
}
