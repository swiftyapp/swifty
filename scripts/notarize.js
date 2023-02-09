require('dotenv').config()
const { spawn } = require('child_process')
const { notarize } = require('@electron/notarize')
const os = require('os')

exports.default = async function notarizing(context) {
  const { electronPlatformName } = context

  if (electronPlatformName !== 'darwin' || process.env.NODE_ENV === 'test') {
    return
  }
  const dir = os.arch() === 'arm64' ? 'mac-arm64' : 'mac'
  const appPath = `packages/${dir}/Swifty.app`

  try {
    return await notarize({
      appPath,
      tool: process.env.NOTARIZE_TOOL,
      teamId: process.env.APPLETEAMID,
      appBundleId: 'com.electron.swifty',
      appleId: process.env.APPLEID,
      appleIdPassword: process.env.APPLEIDPASSWORD
    })
  } catch (error) {
    if (error.message.includes('Failed to staple')) {
      spawn(`xcrun`, ['stapler', 'staple', appPath])
    } else {
      throw error
    }
  }
}
