import { BrowserWindow, shell } from 'electron'

export default class AuthWindow extends BrowserWindow {
  constructor(url) {
    super({
      name: 'Connect Google Drive',
      width: 400,
      height: 520,
      webPreferences: {
        enableRemoteModule: false,
        nodeIntegration: false
      }
    })
    this.url = url
    this.URLWhitelist = [
      'https://accounts.google.com/o/oauth2/v2/auth',
      'https://accounts.google.com/signin/oauth',
      'https://getswifty.pro/google_oauth2/callback'
    ]
  }

  authenticate() {
    return new Promise(resolve => {
      this.loadURL(this.url, {
        extraHeaders: 'cookie: m_pixel_ratio=2'
      })
      this.webContents.on('will-navigate', (event, url) => {
        if (!this.isWhitelisted(url)) event.preventDefault()
      })

      this.webContents.on('new-window', async (event, navigationUrl) => {
        event.preventDefault()
        await shell.openExternal(navigationUrl)
      })

      this.webContents.on('did-navigate', (event, url) => {
        if (this.isAuthSuccess(url)) {
          return this.on('page-title-updated', (event, code) => {
            resolve(code)
          })
        }
      })
    })
  }

  isWhitelisted(url) {
    return this.URLWhitelist.find(item => url.match(item))
  }

  isAuthSuccess(url) {
    return url.match(`${CONFIG.apiHost}/google_oauth2/callback`)
  }
}
