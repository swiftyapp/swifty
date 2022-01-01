const fs = require('fs')
const ps = require('ps-node')
const path = require('path')

export const appPath = () => {
  switch (process.platform) {
    case 'darwin':
      return path.join(
        __dirname,
        '..',
        '..',
        '.tmp',
        'mac-arm64',
        'Swifty.app',
        'Contents',
        'MacOS',
        'Swifty'
      )
    case 'linux':
      return path.join(
        __dirname,
        '..',
        '..',
        '.tmp',
        'linux-unpacked',
        'swifty'
      )
    default:
      throw Error('Unsupported platform')
  }
}

export const storageFile = () => {
  return path.join(process.cwd(), 'test', '.storage', 'default.swftx')
}

export const prepareStorage = storage => {
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

export const cleanup = () => {
  return new Promise(resolve => {
    ps.lookup({ command: appPath() }, (_, items) => {
      kill(items)
      resolve()
    })
  })
}

const fixturePath = file => path.join(process.cwd(), 'test', 'fixtures', file)

const kill = pss => {
  const { platform } = process
  if (platform === 'darwin') {
    pss.forEach(item => ps.kill(item.pid))
  } else if (platform === 'linux') {
    const items = pss.filter(
      item => !item.arguments.find(i => /--type/.test(i))
    )
    const pid = items[0] && items[0].pid
    pid && ps.kill(pid)
  }
}
